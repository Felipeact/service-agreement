-- import-parse: C466, C475, C482, C488. Run after fixture.sql in the same execute_sql call
-- (npm run test:db import_parse). Fixture: jobA (org A, siteA) and jobB (org B, siteB) are `uploading`.

-- Setup, as the table owner: three uploaded jobs of A.
reset role;
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status)
values (tests.id('jobP'), tests.id('orgA'), tests.id('siteA'), 'units.xlsx', 'text/csv', 100, 'uploaded'),
       (tests.id('jobU'), tests.id('orgA'), tests.id('siteA'), 'bad.csv', 'text/csv', 100, 'uploaded'),
       (tests.id('jobV'), tests.id('orgA'), tests.id('siteA'), 'other.csv', 'text/csv', 100, 'uploaded');

-- C482: a viewer of A and the owner of B change nothing, and B cannot see A's job.
select tests.act_as('uV');
do $$ begin
  perform tests.expect_rows('C482 viewer update',
    format('update public.import_jobs set status = ''parsed'', table_count = 1, row_count = 1, read_at = now() where id = %L', tests.id('jobV')), 0);
end $$;

reset role;
select tests.act_as('uB');
do $$ begin
  perform tests.expect_rows('C482 other org update',
    format('update public.import_jobs set status = ''parsed'', table_count = 1, row_count = 1, read_at = now() where id = %L', tests.id('jobV')), 0);
  perform tests.ok('C482 other org reads nothing', (select count(*) from public.import_jobs where id = tests.id('jobV')) = 0, 'uB reads org A job');
end $$;

-- C466: an estimator records both outcomes, each on an uploaded job.
reset role;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C466 parsed',
    format('update public.import_jobs set status = ''parsed'', table_count = 1, row_count = 48, read_at = now() where id = %L and status = ''uploaded''', tests.id('jobP')), 1);
  perform tests.expect_rows('C466 unreadable',
    format('update public.import_jobs set status = ''unreadable'', read_error = ''no_table'', read_at = now() where id = %L and status = ''uploaded''', tests.id('jobU')), 1);
end $$;

-- C475: the compare-and-set on uploaded does not touch a job already read.
do $$ begin
  perform tests.expect_rows('C475 second write',
    format('update public.import_jobs set status = ''unreadable'', read_error = ''corrupt'', table_count = null, row_count = null, read_at = now() where id = %L and status = ''uploaded''', tests.id('jobP')), 0);
  perform tests.ok('C475 kept', (select row_count from public.import_jobs where id = tests.id('jobP')) = 48, 'row_count changed');
end $$;

-- C488: the read rules on import_jobs (door 1).
do $$
declare v text := tests.id('jobV')::text;
begin
  perform tests.expect_error('C488 parsing refused',
    format('update public.import_jobs set status = ''parsing'' where id = %L', v), '23514');
  perform tests.expect_error('C488 unreadable without reason',
    format('update public.import_jobs set status = ''unreadable'', read_at = now() where id = %L', v), '23514');
  perform tests.expect_error('C488 parsed with reason',
    format('update public.import_jobs set status = ''parsed'', read_error = ''corrupt'', table_count = 1, row_count = 1, read_at = now() where id = %L', v), '23514');
  perform tests.expect_error('C488 parsed without read_at',
    format('update public.import_jobs set status = ''parsed'', table_count = 1, row_count = 1 where id = %L', v), '23514');
  perform tests.expect_error('C488 uploaded with read_at',
    format('update public.import_jobs set read_at = now() where id = %L', v), '23514');
  perform tests.expect_error('C488 uploading with counts',
    format('update public.import_jobs set status = ''uploading'', table_count = 1, row_count = 1 where id = %L', v), '23514');
  perform tests.expect_error('C488 unknown reason',
    format('update public.import_jobs set status = ''unreadable'', read_error = ''other'', read_at = now() where id = %L', v), '23514');
  perform tests.expect_error('C488 negative rows',
    format('update public.import_jobs set status = ''parsed'', table_count = 1, row_count = -1, read_at = now() where id = %L', v), '23514');
  perform tests.expect_error('C488 unreadable with counts',
    format('update public.import_jobs set status = ''unreadable'', read_error = ''corrupt'', table_count = 1, row_count = 3, read_at = now() where id = %L', v), '23514');
end $$;
reset role;

rollback;
select 'import_parse: pass' as result;
