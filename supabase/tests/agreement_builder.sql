-- agreement-builder: C704, C706-C709, C712, C717, C730, C735, C736, C738, C742, C751. Run after fixture.sql in the same
-- execute_sql call (npm run test:db agreement_builder). Fixture: agrA (draft, versions 1 and 2) on siteA, agrB on siteB.
-- Setup runs as the table owner with no signed-in user, so the line trigger stands aside (door 4).

reset role;
select set_config('request.jwt.claims', '', true);

-- A site of its own for each agreement, so door 2's index never decides a setup insert.
create function tests.ab_site(p_name text, p_org text default 'A') returns uuid
language sql as $$
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id('cust' || p_org), p_name)
  returning id
$$;

-- An agreement <name> with version 1 (<name>:v1) on its own site <name>:site.
create function tests.ab_agr(p_name text, p_status text, p_number text default null, p_org text default 'A') returns uuid
language plpgsql as $$
begin
  perform tests.ab_site(p_name || ':site', p_org);
  insert into public.agreements (id, org_id, site_id, number, status)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), p_number, p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1);
  return tests.id(p_name);
end $$;

create function tests.ab_version(p_agr text, p_no integer) returns uuid
language sql as $$
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  select tests.id(p_agr || ':v' || p_no), a.org_id, a.id, p_no from public.agreements a where a.id = tests.id(p_agr)
  returning id
$$;

-- A line at p_position on version <version>, with id <version>:l<position>.
create function tests.ab_line(p_version text, p_position integer, p_description text default 'Quarterly PM',
                              p_visits integer default 4, p_cost bigint default 89250) returns uuid
language sql as $$
  insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
  select tests.id(p_version || ':l' || p_position), v.org_id, v.id, p_position, p_description,
         (select array_agg(m::smallint order by m) from generate_series(1, p_visits) m), p_visits, p_cost
  from public.agreement_versions v where v.id = tests.id(p_version)
  returning id
$$;

create function tests.ab_line_sql(p_op text, p_version text, p_line uuid) returns text
language sql as $$
  select case p_op
    when 'insert' then format(
      'insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'select org_id, id, ''New line'', ''{4,10}'', 2, 15000 from public.agreement_versions where id = %L', tests.id(p_version))
    when 'update' then format('update public.service_lines set description = ''Changed'' where id = %L', p_line)
    when 'delete' then format('delete from public.service_lines where id = %L', p_line)
  end
$$;

create function tests.ab_count_on_site(p_site uuid) returns bigint
language sql security definer as $$ select count(*) from public.agreements where site_id = p_site $$;

select tests.ab_site('s706a');
select tests.ab_site('s706b');
select tests.ab_site('s706c');
select tests.ab_site('s706d');
select tests.ab_site('s738');
grant execute on all functions in schema tests to anon, authenticated;

-- C706 (first part): org A has no numbered agreement (agrA's number is null), so the first create is AG-1001.
select tests.act_as('uE');
do $$
declare v uuid;
begin
  v := public.create_agreement(tests.id('s706a'));
  perform tests.ok('C706 empty org', (select number from public.agreements where id = v) = 'AG-1001',
    'first number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  perform set_config('tests.first', v::text, true);
end $$;

-- C704: the create wrote a draft on the site with version 1, an empty snapshot, no lines and no event.
do $$
declare v uuid := current_setting('tests.first')::uuid;
begin
  perform tests.ok('C704 agreement', (select status = 'draft' and site_id = tests.id('s706a') and org_id = tests.id('orgA')
    from public.agreements where id = v), 'agreement is not a draft of org A on the site');
  perform tests.ok('C704 one version', (select count(*) = 1 and min(version_no) = 1 and bool_and(snapshot = '{}'::jsonb)
    from public.agreement_versions where agreement_id = v), 'not exactly version 1 with an empty snapshot');
  perform tests.ok('C704 no lines', (select count(*) from public.service_lines l join public.agreement_versions w
    on w.id = l.agreement_version_id where w.agreement_id = v) = 0, 'the new version has lines');
  perform tests.ok('C704 no event', (select count(*) from public.events where entity_id = v) = 0, 'an event was written');
end $$;

-- C706 (rest): the next number follows the highest AG-<digits> of the org only.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('n1048', 'accepted', 'AG-1048');
select tests.ab_agr('n1051', 'refused', 'AG-1051');
select tests.ab_agr('nX9', 'expired', 'X-9');
select tests.ab_agr('nNull', 'withdrawn', null);
select tests.ab_agr('nB5000', 'accepted', 'AG-5000', 'B');
select tests.act_as('uE');
do $$
declare v uuid;
begin
  v := public.create_agreement(tests.id('s706b'));
  perform tests.ok('C706 after highest', (select number from public.agreements where id = v) = 'AG-1052',
    'next number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  v := public.create_agreement(tests.id('s706c'));
  perform tests.ok('C706 second call', (select number from public.agreements where id = v) = 'AG-1053',
    'second number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  v := public.create_agreement(tests.id('s706d'));
  perform tests.ok('C706 other org ignored', (select number from public.agreements where id = v) = 'AG-1054',
    'org B''s AG-5000 changed org A''s next number: ' || coalesce((select number from public.agreements where id = v), 'null'));
end $$;

-- C707: a number is unique in its org; another org and nulls are free.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_site('s707a');
select tests.ab_site('s707b', 'B');
select tests.ab_site('s707c');
select tests.ab_site('s707d');
do $$ begin
  perform tests.expect_error('C707 duplicate in org A',
    format('insert into public.agreements (org_id, site_id, number, status) values (%L, %L, ''AG-1048'', ''refused'')',
      tests.id('orgA'), tests.id('s707a')), '23505');
  perform tests.expect_rows('C707 same number in org B',
    format('insert into public.agreements (org_id, site_id, number, status) values (%L, %L, ''AG-1048'', ''refused'')',
      tests.id('orgB'), tests.id('s707b')), 1);
  perform tests.expect_rows('C707 null number',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''refused'')', tests.id('orgA'), tests.id('s707c')), 1);
  perform tests.expect_rows('C707 second null number',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''refused'')', tests.id('orgA'), tests.id('s707d')), 1);
  perform tests.ok('C707 constraint', exists (select 1 from pg_constraint where conname = 'agreements_org_id_number_key'
    and conrelid = 'public.agreements'::regclass and contype = 'u'), 'agreements_org_id_number_key is missing');
end $$;

-- C708: the number is read under the org's advisory lock.
do $$
declare d text := pg_get_functiondef('public.create_agreement(uuid)'::regprocedure);
begin
  perform tests.ok('C708 lock', position('pg_advisory_xact_lock(hashtextextended(''agreement_number:'' ||' in d) > 0,
    'create_agreement takes no advisory lock on the org''s numbers');
  perform tests.ok('C708 lock first', position('pg_advisory_xact_lock' in d) < position('max(' in d),
    'the lock is taken after the highest number is read');
end $$;

-- C709: a site with a live agreement refuses a second one; the other four statuses free it.
do $$
declare s text;
begin
  foreach s in array array['draft','sent','accepted','refused','changes_requested','expired','withdrawn'] loop
    perform tests.ab_agr('live:' || s, s);
  end loop;
end $$;
select tests.act_as('uE');
do $$
declare s text; before bigint; site uuid;
begin
  foreach s in array array['draft','sent','changes_requested'] loop
    site := tests.id('live:' || s || ':site');
    before := tests.ab_count_on_site(site);
    perform tests.expect_error('C709 ' || s, format('select public.create_agreement(%L)', site), '23505');
    perform tests.ok('C709 ' || s || ' adds nothing', tests.ab_count_on_site(site) = before, 'an agreement was added');
  end loop;
  foreach s in array array['accepted','refused','expired','withdrawn'] loop
    site := tests.id('live:' || s || ':site');
    before := tests.ab_count_on_site(site);
    perform public.create_agreement(site);
    perform tests.ok('C709 ' || s, tests.ab_count_on_site(site) = before + 1, 'no agreement was added');
  end loop;
end $$;

-- C712: a missing site and another org's site are not found, and nothing is added.
do $$
declare before bigint := (select count(*) from public.agreements);
begin
  perform tests.expect_error('C712 missing site', format('select public.create_agreement(%L)', tests.id('no such site')), 'P0002');
  perform tests.expect_error('C712 org B site', format('select public.create_agreement(%L)', tests.id('siteB')), 'P0002');
  perform tests.ok('C712 nothing added', (select count(*) from public.agreements) = before, 'an agreement was added');
  perform tests.ok('C712 org B unchanged', tests.ab_count_on_site(tests.id('siteB')) = 1, 'org B''s site gained an agreement');
end $$;

-- C717: on the current version of a draft, a writer inserts, updates and deletes a line.
do $$
declare v uuid := current_setting('tests.first')::uuid; ver uuid; line uuid;
begin
  ver := (select id from public.agreement_versions where agreement_id = v and version_no = 1);
  perform tests.expect_rows('C717 insert',
    format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'values (%L, %L, ''Filter changes'', ''{4,10}'', 2, 15000)', tests.id('orgA'), ver), 1);
  line := (select id from public.service_lines where agreement_version_id = ver);
  perform tests.expect_rows('C717 update', format('update public.service_lines set description = ''Filters'' where id = %L', line), 1);
  perform tests.expect_rows('C717 delete', format('delete from public.service_lines where id = %L', line), 1);
end $$;

-- C730: a revise copies version n's lines into version n + 1 and leaves version n as it was.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('rev', 'changes_requested');
select tests.ab_line('rev:v1', 0, 'Preventive maintenance visit', 4, 89250);
select tests.ab_line('rev:v1', 1, 'Filter changes', 2, 15000);
create table tests.ab_rev_v1 as
  select id, position, description, visits_per_year, cost_per_visit_cents from public.service_lines
  where agreement_version_id = tests.id('rev:v1');
grant select on tests.ab_rev_v1 to authenticated;
select tests.act_as('uE');
do $$
declare v2 uuid;
begin
  perform public.apply_agreement_transition(tests.id('rev'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":2}');
  perform tests.ok('C730 status', (select status from public.agreements where id = tests.id('rev')) = 'draft', 'not draft');
  v2 := (select id from public.agreement_versions where agreement_id = tests.id('rev') and version_no = 2);
  perform tests.ok('C730 version 2', v2 is not null, 'no version 2');
  perform tests.ok('C730 copied lines',
    (select array_agg((position, description, visits_per_year, cost_per_visit_cents)::text order by position)
     from public.service_lines where agreement_version_id = v2)
    = (select array_agg((position, description, visits_per_year, cost_per_visit_cents)::text order by position) from tests.ab_rev_v1),
    'version 2''s lines differ from version 1''s');
  perform tests.ok('C730 new ids', not exists (select 1 from public.service_lines where agreement_version_id = v2
    and id in (select id from tests.ab_rev_v1)), 'a copied line kept its id');
  perform tests.ok('C730 version 1 kept',
    (select array_agg((id, position, description, visits_per_year, cost_per_visit_cents)::text order by position)
     from public.service_lines where agreement_version_id = tests.id('rev:v1'))
    = (select array_agg((id, position, description, visits_per_year, cost_per_visit_cents)::text order by position) from tests.ab_rev_v1),
    'version 1''s lines changed');
end $$;

-- C735: a member cannot change a past version of a draft, nor any version of an agreement that is not a draft.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('frz:draft', 'draft');
select tests.ab_line('frz:draft:v1', 0);
select tests.ab_version('frz:draft', 2);
do $$
declare s text;
begin
  foreach s in array array['sent','accepted','refused','changes_requested','expired','withdrawn'] loop
    perform tests.ab_agr('frz:' || s, s);
    perform tests.ab_line('frz:' || s || ':v1', 0);
  end loop;
end $$;
select tests.act_as('uE');
do $$
declare s text; op text;
begin
  foreach op in array array['insert','update','delete'] loop
    perform tests.expect_error('C735 older version ' || op,
      tests.ab_line_sql(op, 'frz:draft:v1', tests.id('frz:draft:v1:l0')), '55000');
    foreach s in array array['sent','accepted','refused','changes_requested','expired','withdrawn'] loop
      perform tests.expect_error('C735 ' || s || ' ' || op,
        tests.ab_line_sql(op, 'frz:' || s || ':v1', tests.id('frz:' || s || ':v1:l0')), '55000');
    end loop;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.expect_rows('C735 table owner on sent', tests.ab_line_sql('insert', 'frz:sent:v1', null), 1);
end $$;

-- C736: the trigger follows a status change made earlier in the same session.
select tests.ab_agr('wd', 'draft');
select tests.ab_line('wd:v1', 0);
select tests.ab_agr('rv', 'changes_requested');
select tests.ab_line('rv:v1', 0);
select tests.act_as('uE');
do $$ begin
  perform public.apply_agreement_transition(tests.id('wd'), 'draft', 'withdrawn', 'agreement.withdrawn', '{"from":"draft","to":"withdrawn"}');
  perform tests.expect_error('C736 after withdraw', tests.ab_line_sql('update', 'wd:v1', tests.id('wd:v1:l0')), '55000');
  perform public.apply_agreement_transition(tests.id('rv'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":2}');
  perform tests.expect_error('C736 version n after revise', tests.ab_line_sql('update', 'rv:v1', tests.id('rv:v1:l0')), '55000');
  perform tests.expect_rows('C736 version n + 1 after revise',
    format('update public.service_lines set description = ''Changed'' where agreement_version_id = %L',
      (select id from public.agreement_versions where agreement_id = tests.id('rv') and version_no = 2)), 1);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare f oid := 'private.service_lines_frozen()'::regprocedure;
begin
  perform tests.ok('C736 for share', position('for share' in lower(pg_get_functiondef(f))) > 0,
    'the trigger does not read the agreement for share');
  perform tests.ok('C736 definer', (select prosecdef from pg_proc where oid = f), 'the trigger function is not security definer');
  perform tests.ok('C736 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;

-- C738: a viewer creates nothing and changes no line of org A's current draft.
select tests.ab_agr('vw', 'draft');
select tests.ab_line('vw:v1', 0);
select tests.act_as('uV');
do $$
declare before bigint := tests.ab_count_on_site(tests.id('s738'));
begin
  perform tests.expect_error('C738 create', format('select public.create_agreement(%L)', tests.id('s738')), '42501');
  perform tests.ok('C738 nothing added', tests.ab_count_on_site(tests.id('s738')) = before, 'an agreement was added');
  perform tests.expect_error('C738 insert', tests.ab_line_sql('insert', 'vw:v1', null), '42501');
  perform tests.expect_rows('C738 update', tests.ab_line_sql('update', 'vw:v1', tests.id('vw:v1:l0')), 0);
  perform tests.expect_rows('C738 delete', tests.ab_line_sql('delete', 'vw:v1', tests.id('vw:v1:l0')), 0);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C738 line kept', (select description = 'Quarterly PM' from public.service_lines where id = tests.id('vw:v1:l0')),
    'the viewer changed or deleted the line');
end $$;

-- C742: org A's estimator reaches nothing of org B's agreement.
select tests.act_as('uE');
do $$ begin
  perform tests.ok('C742 agreement', (select count(*) from public.agreements where id = tests.id('agrB')) = 0, 'org B''s agreement is visible');
  perform tests.ok('C742 versions', (select count(*) from public.agreement_versions where agreement_id = tests.id('agrB')) = 0,
    'org B''s versions are visible');
  perform tests.ok('C742 lines', (select count(*) from public.service_lines where org_id = tests.id('orgB')) = 0, 'org B''s lines are visible');
  perform tests.expect_rows('C742 update', format('update public.service_lines set description = ''A'' where id = %L', tests.id('lineB')), 0);
  perform tests.expect_rows('C742 delete', format('delete from public.service_lines where id = %L', tests.id('lineB')), 0);
  begin
    execute format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'values (%L, %L, ''x'', ''{1}'', 1, 0)', tests.id('orgB'), tests.id('ver2B'));
    raise exception 'C742 insert: statement succeeded';
  exception when others then
    if sqlstate not in ('42501', '23503') then
      raise exception 'C742 insert: expected 42501 or 23503, got % (%)', sqlstate, sqlerrm;
    end if;
  end;
  perform tests.expect_error('C742 revise', format('select public.apply_agreement_transition(%L, ''changes_requested'', ''draft'', '
    || '''agreement.revised'', ''{}'')', tests.id('agrB')), 'P0002');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C742 org B line kept', (select description = 'Quarterly PM' from public.service_lines where id = tests.id('lineB')),
    'org B''s line changed');
end $$;

-- C751: both RPCs are closed to anon and open to authenticated.
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C751 anon revise', format('select public.apply_agreement_transition(%L, ''changes_requested'', ''draft'', '
    || '''agreement.revised'', ''{}'')', tests.id('agrA')), '42501');
  perform tests.expect_error('C751 anon create', format('select public.create_agreement(%L)', tests.id('siteA')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare f oid := 'public.create_agreement(uuid)'::regprocedure;
begin
  perform tests.ok('C751 authenticated create', has_function_privilege('authenticated', 'public.create_agreement(uuid)', 'execute'),
    'authenticated cannot execute create_agreement');
  perform tests.ok('C751 authenticated revise',
    has_function_privilege('authenticated', 'public.apply_agreement_transition(uuid, text, text, text, jsonb)', 'execute'),
    'authenticated cannot execute apply_agreement_transition');
  perform tests.ok('C751 invoker', not (select prosecdef from pg_proc where oid = f), 'create_agreement is security definer');
  perform tests.ok('C751 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;

rollback;
select 'agreement_builder: pass' as result;
