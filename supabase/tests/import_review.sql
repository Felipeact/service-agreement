-- import-review: C627-C631, C633, C637, C639, C640, C642-C645. Run after fixture.sql in the same execute_sql call
-- (npm run test:db import_review). Fixture: siteA has assetA (typeA, RTU, unit RTU-1); typeA is org A's RTU.

-- Setup, as the table owner: a second type of org A, and jobs in the states each check needs.
reset role;
insert into public.asset_types (id, org_id, code, name) values (tests.id('typeMUA'), tests.id('orgA'), 'MUA', 'Make-up air unit');

create function tests.job(p_name text, p_status text) returns uuid
language plpgsql as $$
begin
  insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status,
                                  table_count, row_count, read_at, extract_cursor, extract_total, extracted_at)
  values (tests.id(p_name), tests.id('orgA'), tests.id('siteA'), p_name || '.csv', 'text/csv', 100, p_status,
          case when p_status in ('parsed', 'extracting', 'extracted') then 1 end,
          case when p_status in ('parsed', 'extracting', 'extracted') then 5 end,
          case when p_status in ('parsed', 'extracting', 'extracted') then now() end,
          case when p_status in ('extracting', 'extracted') then 1 end,
          case p_status when 'extracting' then 2 when 'extracted' then 1 end,
          case when p_status = 'extracted' then now() end);
  return tests.id(p_name);
end $$;

create function tests.row(p_job text, p_position integer, p_type uuid, p_unit text,
                          p_skipped boolean default false, p_model text default null, p_location text default null) returns void
language sql as $$
  insert into public.import_rows (org_id, job_id, position, confidence, asset_type_id, unit_no, type_model, location, skipped)
  values (tests.id('orgA'), tests.id(p_job), p_position, 'high', p_type, p_unit, p_model, p_location, p_skipped)
$$;

create function tests.site_assets() returns bigint
language sql as $$ select count(*) from public.assets where site_id = tests.id('siteA') $$;

select tests.job('jC', 'extracted');
select tests.row('jC', 1, tests.id('typeA'), 'RTU-1', false, 'Carrier', 'Roof');
select tests.row('jC', 2, tests.id('typeMUA'), null);
select tests.row('jC', 3, tests.id('typeA'), 'RTU-9', true);

select tests.job('jF', 'extracted');
select tests.row('jF', 1, tests.id('typeA'), 'RTU-5');
select tests.row('jF', 2, tests.id('typeA'), 'BOOM');

select tests.job('jI1', 'extracted');
select tests.row('jI1', 1, null, 'RTU-6');
select tests.job('jI2', 'extracted');
select tests.row('jI2', 1, tests.id('typeA'), repeat('u', 41));
select tests.job('jI3', 'extracted');
select tests.row('jI3', 1, tests.id('typeA'), 'RTU-7', false, repeat('m', 121));
select tests.job('jI4', 'extracted');
select tests.row('jI4', 1, tests.id('typeA'), 'RTU-8', false, null, repeat('l', 301));

select tests.job('jS', 'extracted');
select tests.row('jS', 1, tests.id('typeA'), 'RTU-10', true);
select tests.row('jS', 2, null, 'RTU-11', true);
select tests.job('jZ', 'extracted');

select tests.job('jE2', 'extracted');
select tests.row('jE2', 1, tests.id('typeA'), 'RTU-12');
select tests.job('jD3', 'extracted');
select tests.row('jD3', 1, null, 'a');
select tests.row('jD3', 2, null, 'b');
select tests.row('jD3', 3, null, 'c');
select tests.job('jXr', 'extracting');
select tests.row('jXr', 1, null, 'x');

select tests.job('jV2', 'extracted');
select tests.row('jV2', 1, tests.id('typeA'), 'RTU-13');

select tests.job('jPa', 'parsed');
select tests.job('jUp', 'uploaded');

-- A trigger that fails the commit part way through, for C628 only.
create function tests.boom() returns trigger
language plpgsql as $$ begin raise exception 'boom'; end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- C627: the commit adds the included rows to the job's site, links them, and closes the job.
select tests.act_as('uE');
do $$
declare v integer; before bigint := tests.site_assets(); j uuid := tests.id('jC');
begin
  v := public.commit_import(j);
  perform tests.ok('C627 returns 2', v = 2, 'returned ' || v);
  perform tests.ok('C627 site gains 2', tests.site_assets() = before + 2, 'site asset count changed by ' || (tests.site_assets() - before));
  perform tests.ok('C627 row 1 asset', (select a.asset_type_id = tests.id('typeA') and a.unit_no = 'RTU-1' and a.type_model = 'Carrier'
    and a.location = 'Roof' and a.source = 'import' and a.site_id = tests.id('siteA')
    from public.import_rows r join public.assets a on a.id = r.asset_id where r.job_id = j and r.position = 1), 'row 1 asset is wrong');
  perform tests.ok('C627 row 2 asset', (select a.asset_type_id = tests.id('typeMUA') and a.unit_no is null and a.source = 'import'
    and a.site_id = tests.id('siteA')
    from public.import_rows r join public.assets a on a.id = r.asset_id where r.job_id = j and r.position = 2), 'row 2 asset is wrong');
  perform tests.ok('C627 skipped row', (select asset_id is null from public.import_rows where job_id = j and position = 3), 'skipped row has an asset');
  perform tests.ok('C627 job', (select status = 'committed' and committed_at is not null and committed_by = tests.id('uE') and committed_count = 2
    from public.import_jobs where id = j), 'job is not committed 2 by uE');
end $$;

-- C631: a second commit adds nothing and is told the job moved on.
do $$
declare before bigint := tests.site_assets();
begin
  perform tests.expect_error('C631 second commit', format('select public.commit_import(%L)', tests.id('jC')), '40001');
  perform tests.ok('C631 nothing added', tests.site_assets() = before, 'assets were added twice');
end $$;

-- C628: a failure part way leaves no asset, no link and the job extracted.
reset role;
create trigger tests_boom before insert on public.assets for each row when (new.unit_no = 'BOOM') execute function tests.boom();
select tests.act_as('uE');
do $$
declare before bigint := tests.site_assets(); j uuid := tests.id('jF');
begin
  perform tests.expect_error('C628 commit fails', format('select public.commit_import(%L)', j), 'P0001');
  perform tests.ok('C628 no asset', tests.site_assets() = before, 'an asset was left behind');
  perform tests.ok('C628 no link', (select count(*) from public.import_rows where job_id = j and asset_id is not null) = 0, 'a row was linked');
  perform tests.ok('C628 job extracted', (select status = 'extracted' and committed_at is null from public.import_jobs where id = j), 'job moved');
end $$;
reset role;
drop trigger tests_boom on public.assets;

-- C629 and C630: what the form would refuse, the commit refuses too, writing nothing.
select tests.act_as('uE');
do $$
declare before bigint := tests.site_assets(); n text;
begin
  foreach n in array array['jI1', 'jI2', 'jI3', 'jI4'] loop
    perform tests.expect_error('C629 ' || n, format('select public.commit_import(%L)', tests.id(n)), '23514');
    perform tests.ok('C629 ' || n || ' job', (select status = 'extracted' from public.import_jobs where id = tests.id(n)), 'job moved');
  end loop;
  foreach n in array array['jS', 'jZ'] loop
    perform tests.expect_error('C630 ' || n, format('select public.commit_import(%L)', tests.id(n)), '23514');
    perform tests.ok('C630 ' || n || ' job', (select status = 'extracted' from public.import_jobs where id = tests.id(n)), 'job moved');
  end loop;
  perform tests.ok('C629 C630 nothing added', tests.site_assets() = before, 'an asset was added');
end $$;

-- C633: deleting an imported asset keeps its row and the job's count.
do $$
declare a uuid := (select asset_id from public.import_rows where job_id = tests.id('jC') and position = 1);
begin
  perform tests.expect_rows('C633 delete asset', format('delete from public.assets where id = %L', a), 1);
  perform tests.ok('C633 row kept', (select asset_id is null and org_id = tests.id('orgA') from public.import_rows
    where job_id = tests.id('jC') and position = 1), 'row lost or still linked');
  perform tests.ok('C633 job count', (select status = 'committed' and committed_count = 2 from public.import_jobs where id = tests.id('jC')),
    'job count changed');
end $$;

-- C637: rows change only while their job is extracted; a discard still cascades.
do $$ begin
  perform tests.expect_error('C637 update committed',
    format('update public.import_rows set unit_no = ''Z'' where job_id = %L and position = 2', tests.id('jC')), '55000');
  perform tests.expect_error('C637 delete committed',
    format('delete from public.import_rows where job_id = %L and position = 2', tests.id('jC')), '55000');
  perform tests.expect_error('C637 update extracting',
    format('update public.import_rows set unit_no = ''Z'' where job_id = %L', tests.id('jXr')), '55000');
  perform tests.expect_rows('C637 update extracted',
    format('update public.import_rows set unit_no = ''Z'' where job_id = %L', tests.id('jE2')), 1);
  perform tests.expect_rows('C637 discard extracted', format('delete from public.import_jobs where id = %L', tests.id('jD3')), 1);
  perform tests.ok('C637 rows cascaded', (select count(*) from public.import_rows where job_id = tests.id('jD3')) = 0, 'rows remain');
end $$;
reset role;
do $$
declare f oid := 'private.import_rows_frozen()'::regprocedure;
begin
  perform tests.ok('C637 definer', (select prosecdef from pg_proc where oid = f), 'the trigger function is not security definer');
  perform tests.ok('C637 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;

-- C639: a viewer can neither commit nor edit.
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C639 viewer commit', format('select public.commit_import(%L)', tests.id('jV2')), '42501');
  perform tests.expect_rows('C639 viewer update',
    format('update public.import_rows set unit_no = ''V'' where job_id = %L', tests.id('jV2')), 0);
end $$;

-- C640: another org cannot see the job or its rows.
reset role;
select tests.act_as('uB');
do $$ begin
  perform tests.expect_error('C640 other org commit', format('select public.commit_import(%L)', tests.id('jV2')), 'P0002');
  perform tests.expect_rows('C640 other org update',
    format('update public.import_rows set unit_no = ''B'' where job_id = %L', tests.id('jV2')), 0);
end $$;

-- C645: only an extracted job commits (door 3).
reset role;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C645 parsed', format('select public.commit_import(%L)', tests.id('jPa')), '40001');
  perform tests.expect_error('C645 extracting', format('select public.commit_import(%L)', tests.id('jXr')), '40001');
  perform tests.expect_error('C645 uploaded', format('select public.commit_import(%L)', tests.id('jUp')), '40001');
  perform tests.expect_error('C645 unknown', format('select public.commit_import(%L)', tests.id('nothing')), 'P0002');
end $$;
reset role;
do $$
declare f oid := 'public.commit_import(uuid)'::regprocedure;
begin
  perform tests.ok('C645 invoker', not (select prosecdef from pg_proc where oid = f), 'the function is security definer');
  perform tests.ok('C645 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
  perform tests.ok('C645 anon', not has_function_privilege('anon', f, 'execute'), 'anon may execute it');
  perform tests.ok('C642 one argument', (select pronargs = 1 from pg_proc where oid = f), 'commit_import takes more than the job id');
end $$;

-- C643: the row-to-asset link (door 1), as the table owner.
insert into public.assets (id, org_id, site_id, asset_type_id, unit_no) values (tests.id('assetX'), tests.id('orgA'), tests.id('siteA'), tests.id('typeA'), 'X-1');
select tests.job('jK3', 'extracted');
do $$
declare j uuid := tests.id('jK3'); o uuid := tests.id('orgA');
begin
  perform tests.ok('C643 assets unique (id, org_id)', (select count(*) from pg_constraint
    where conrelid = 'public.assets'::regclass and contype = 'u' and conname = 'assets_id_org_id_key') = 1, 'no unique (id, org_id) on assets');
  perform tests.expect_error('C643 skipped with asset',
    format('insert into public.import_rows (org_id, job_id, position, confidence, skipped, asset_id) values (%L, %L, 1, ''low'', true, %L)', o, j, tests.id('assetX')), '23514');
  perform tests.expect_rows('C643 first link',
    format('insert into public.import_rows (org_id, job_id, position, confidence, asset_id) values (%L, %L, 1, ''low'', %L)', o, j, tests.id('assetX')), 1);
  perform tests.expect_error('C643 same asset twice',
    format('insert into public.import_rows (org_id, job_id, position, confidence, asset_id) values (%L, %L, 2, ''low'', %L)', o, j, tests.id('assetX')), '23505');
  perform tests.expect_error('C643 asset of org B',
    format('insert into public.import_rows (org_id, job_id, position, confidence, asset_id) values (%L, %L, 3, ''low'', %L)', o, j, tests.id('assetB')), '23503');
  perform tests.expect_rows('C643 default row',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 4, ''low'')', o, j), 1);
  perform tests.ok('C643 skipped defaults to false', (select not skipped from public.import_rows where job_id = j and position = 4), 'skipped is not false');
end $$;

-- C644: the commit state on import_jobs (door 2), as the table owner.
do $$
declare
  base text := 'insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, '
    || 'read_at, extract_cursor, extract_total, extracted_at, committed_at, committed_by, committed_count) values (%L, %L, ''c.csv'', ''text/csv'', 100, %L, 1, 5, now(), 1, 1, now(), %s, %s, %s)';
  o uuid := tests.id('orgA'); s uuid := tests.id('siteA'); u text := quote_literal(tests.id('uE'));
begin
  perform tests.expect_error('C644 committed without time', format(base, o, s, 'committed', 'null', u, '2'), '23514');
  perform tests.expect_error('C644 count 0', format(base, o, s, 'committed', 'now()', u, '0'), '23514');
  perform tests.expect_error('C644 extracted with time', format(base, o, s, 'extracted', 'now()', 'null', 'null'), '23514');
  perform tests.expect_rows('C644 committed accepted', format(base, o, s, 'committed', 'now()', u, '2'), 1);
  perform tests.expect_error('C644 status queued', format(base, o, s, 'queued', 'null', 'null', 'null'), '23514');
end $$;

rollback;
select 'import_review: pass' as result;
