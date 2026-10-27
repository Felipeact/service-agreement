-- import-extract: C505, C507, C513, C525, C532, C533, C536, C547-C550. Run after fixture.sql in the same execute_sql call
-- (npm run test:db import_extract). Fixture: jobA (org A, siteA) and jobB (org B, siteB) are `uploading`, with one row each.

-- Setup, as the table owner: parsed jobs of A (one per case), and one job per other status.
reset role;
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, read_at)
select tests.id(n), tests.id('orgA'), tests.id('siteA'), n || '.csv', 'text/csv', 100, 'parsed', 1, 48, now()
from unnest(array['jP1','jP2','jP3','jP4','jP5','jP6','jP7','jV','jK','jK2','jN','jD']) as n;
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status)
values (tests.id('jU'), tests.id('orgA'), tests.id('siteA'), 'uploaded.csv', 'text/csv', 100, 'uploaded');
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, read_error, read_at)
values (tests.id('jUR'), tests.id('orgA'), tests.id('siteA'), 'bad.csv', 'text/csv', 100, 'unreadable', 'corrupt', now());
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, read_at, extract_cursor, extract_total, extracted_at)
values (tests.id('jEX'), tests.id('orgA'), tests.id('siteA'), 'done.csv', 'text/csv', 100, 'extracted', 1, 48, now(), 1, 1, now());
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, read_at, extract_cursor, extract_total)
values (tests.id('jX'), tests.id('orgA'), tests.id('siteA'), 'mid.csv', 'text/csv', 100, 'extracting', 1, 48, now(), 1, 3);

-- n rows as the adapter sends them; every row names p_type when given.
create function tests.chunk_rows(p_n integer, p_type uuid default null) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_type_raw', 'Rooftop unit', 'unit_no', 'RTU-' || g, 'type_model', null, 'location', null,
    'confidence', 'high', 'source_ref', 'Units!' || (g + 1), 'asset_type_id', p_type)), '[]'::jsonb)
  from generate_series(1, p_n) as g
$$;
grant execute on function tests.chunk_rows(integer, uuid) to authenticated;

-- C505 and C507: the first call, then positions continuing under the cursor.
select tests.act_as('uE');
do $$
declare v integer; j text;
begin
  j := tests.id('jP1')::text;
  v := public.record_extraction_chunk(j::uuid, null, 4, tests.chunk_rows(2));
  perform tests.ok('C505 returns 1', v = 1, 'returned ' || v);
  perform tests.ok('C505 job', (select status = 'extracting' and extract_cursor = 1 and extract_total = 4 and extracted_at is null
    from public.import_jobs where id = j::uuid), 'job is not extracting 1/4');
  perform tests.ok('C505 rows', (select count(*) from public.import_rows where job_id = j::uuid) = 2, 'rows are not 2');

  j := tests.id('jP2')::text;
  perform public.record_extraction_chunk(j::uuid, null, 4, tests.chunk_rows(2));
  perform public.record_extraction_chunk(j::uuid, 1, 4, tests.chunk_rows(2));
  perform tests.ok('C507 positions', (select array_agg(position order by position) from public.import_rows where job_id = j::uuid) = array[1, 2, 3, 4],
    'positions are not 1..4');
  v := public.record_extraction_chunk(j::uuid, 2, 4, '[]'::jsonb);
  perform tests.ok('C507 empty chunk', v = 3 and (select count(*) from public.import_rows where job_id = j::uuid) = 4
    and (select extract_cursor from public.import_jobs where id = j::uuid) = 3, 'an empty chunk changed rows or missed the cursor');
end $$;

-- C513: the last chunk ends the job, with or without rows.
do $$
declare v integer; j text;
begin
  j := tests.id('jP3')::text;
  v := public.record_extraction_chunk(j::uuid, null, 1, '[]'::jsonb);
  perform tests.ok('C513 single empty chunk', v = 1 and (select status = 'extracted' and extract_cursor = 1 and extract_total = 1 and extracted_at is not null
    from public.import_jobs where id = j::uuid) and (select count(*) from public.import_rows where job_id = j::uuid) = 0, 'job is not extracted with 0 rows');

  j := tests.id('jP4')::text;
  perform public.record_extraction_chunk(j::uuid, null, 2, tests.chunk_rows(1));
  v := public.record_extraction_chunk(j::uuid, 1, 2, tests.chunk_rows(1));
  perform tests.ok('C513 second chunk', v = 2 and (select status = 'extracted' and extract_cursor = 2 and extracted_at is not null
    from public.import_jobs where id = j::uuid), 'job is not extracted at 2/2');
end $$;

-- C525: the same chunk twice is stored once; the loser is told it is stale.
do $$
declare v integer; j text;
begin
  j := tests.id('jP5')::text;
  v := public.record_extraction_chunk(j::uuid, null, 2, tests.chunk_rows(2));
  perform tests.ok('C525 first', v = 1, 'returned ' || v);
  perform tests.expect_error('C525 second', format('select public.record_extraction_chunk(%L, null, 2, tests.chunk_rows(2))', j), '40001');
  perform tests.ok('C525 stored once', (select count(*) from public.import_rows where job_id = j::uuid) = 2
    and (select extract_cursor from public.import_jobs where id = j::uuid) = 1, 'rows or cursor changed');
  v := public.record_extraction_chunk(j::uuid, 1, 2, '[]'::jsonb);
  perform tests.ok('C525 third', v = 2, 'returned ' || v);
end $$;

-- C532: a bad row anywhere in a chunk leaves neither rows nor cursor.
do $$
declare j text := tests.id('jP6')::text;
begin
  perform tests.expect_error('C532 bad confidence',
    format('select public.record_extraction_chunk(%L, null, 1, %L::jsonb)', j,
      (tests.chunk_rows(1) || jsonb_build_array(jsonb_set(tests.chunk_rows(1) -> 0, '{confidence}', '"certain"')))::text), '23514');
  perform tests.ok('C532 after bad confidence', (select status = 'parsed' and extract_cursor is null from public.import_jobs where id = j::uuid)
    and (select count(*) from public.import_rows where job_id = j::uuid) = 0, 'job or rows changed');
  perform tests.expect_error('C532 other org type',
    format('select public.record_extraction_chunk(%L, null, 1, %L::jsonb)', j,
      (tests.chunk_rows(1) || tests.chunk_rows(1, tests.id('typeB')))::text), '23503');
  perform tests.ok('C532 after other org type', (select status = 'parsed' and extract_cursor is null from public.import_jobs where id = j::uuid)
    and (select count(*) from public.import_rows where job_id = j::uuid) = 0, 'job or rows changed');
end $$;

-- C533: discarding a job takes its rows and nobody else's.
reset role;
insert into public.import_rows (org_id, job_id, position, confidence)
select tests.id('orgA'), tests.id('jP7'), g, 'low' from generate_series(1, 3) as g;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C533 delete job', format('delete from public.import_jobs where id = %L', tests.id('jP7')), 1);
  perform tests.ok('C533 rows gone', (select count(*) from public.import_rows where job_id = tests.id('jP7')) = 0, 'rows remain');
  perform tests.ok('C533 others kept', (select count(*) from public.import_rows where id = tests.id('rowA')) = 1, 'another job lost its row');
end $$;

-- C536: a viewer and another org change nothing and see nothing.
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C536 viewer rpc',
    format('select public.record_extraction_chunk(%L, null, 1, ''[]'')', tests.id('jV')), '42501');
  perform tests.expect_error('C536 viewer insert',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 50, ''low'')', tests.id('orgA'), tests.id('jV')), '42501');
  perform tests.ok('C536 viewer reads', (select count(*) from public.import_rows where id = tests.id('rowA')) = 1, 'viewer cannot read rows');
end $$;
reset role;
select tests.act_as('uB');
do $$ begin
  perform tests.expect_error('C536 other org rpc',
    format('select public.record_extraction_chunk(%L, null, 1, ''[]'')', tests.id('jV')), 'P0002');
  perform tests.ok('C536 other org reads nothing', (select count(*) from public.import_rows where org_id = tests.id('orgA')) = 0, 'uB reads org A rows');
end $$;
reset role;
do $$ begin
  perform tests.ok('C536 job unchanged', (select status = 'parsed' and extract_cursor is null from public.import_jobs where id = tests.id('jV')), 'job changed');
end $$;

-- C547: the import_rows rules (door 1), as the table owner, then the policies.
do $$
declare j uuid := tests.id('jK'); o uuid := tests.id('orgA');
begin
  perform tests.expect_error('C547 position 0',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 0, ''low'')', o, j), '23514');
  perform tests.expect_rows('C547 first row', format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 1, ''low'')', o, j), 1);
  perform tests.expect_error('C547 duplicate position',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 1, ''low'')', o, j), '23505');
  perform tests.expect_error('C547 confidence certain',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 2, ''certain'')', o, j), '23514');
  perform tests.expect_error('C547 confidence null',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 2, null)', o, j), '23502');
  perform tests.expect_error('C547 type of org B',
    format('insert into public.import_rows (org_id, job_id, position, confidence, asset_type_id) values (%L, %L, 2, ''low'', %L)', o, j, tests.id('typeB')), '23503');
  perform tests.expect_error('C547 job of org B',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 2, ''low'')', o, tests.id('jobB')), '23503');
  perform tests.expect_rows('C547 null type accepted',
    format('insert into public.import_rows (org_id, job_id, position, confidence, asset_type_id) values (%L, %L, 2, ''medium'', null)', o, j), 1);
  perform tests.expect_rows('C547 three confidences accepted',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%1$L, %2$L, 3, ''low''), (%1$L, %2$L, 4, ''medium''), (%1$L, %2$L, 5, ''high'')', o, j), 3);
end $$;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C547 estimator insert',
    format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, 6, ''low'')', tests.id('orgA'), tests.id('jK')), 1);
end $$;
reset role;
select tests.act_as('uA');
do $$ begin
  perform tests.expect_rows('C547 owner update',
    format('update public.import_rows set unit_no = ''X'' where job_id = %L and position = 1', tests.id('jK')), 1);
end $$;
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_rows('C547 viewer update',
    format('update public.import_rows set unit_no = ''Y'' where job_id = %L and position = 1', tests.id('jK')), 0);
end $$;
reset role;

-- C548: the extraction rules on import_jobs (door 2) and the import-parse rules that were replaced.
do $$
declare k text := tests.id('jK2')::text;
begin
  perform tests.expect_error('C548 extracted without time',
    format('update public.import_jobs set status = ''extracted'', extract_cursor = 1, extract_total = 1 where id = %L', k), '23514');
  perform tests.expect_error('C548 extracting without total',
    format('update public.import_jobs set status = ''extracting'' where id = %L', k), '23514');
  perform tests.expect_error('C548 cursor above total',
    format('update public.import_jobs set status = ''extracting'', extract_cursor = 2, extract_total = 1 where id = %L', k), '23514');
  perform tests.expect_error('C548 extracted cursor not total',
    format('update public.import_jobs set status = ''extracted'', extract_cursor = 1, extract_total = 2, extracted_at = now() where id = %L', k), '23514');
  perform tests.expect_error('C548 total 0',
    format('update public.import_jobs set status = ''extracting'', extract_cursor = 0, extract_total = 0 where id = %L', k), '23514');
  perform tests.expect_error('C548 cursor without total',
    format('update public.import_jobs set extract_cursor = 1 where id = %L', k), '23514');
  perform tests.expect_error('C548 parsed with time',
    format('update public.import_jobs set extracted_at = now() where id = %L', k), '23514');
  perform tests.expect_error('C548 status queued',
    format('update public.import_jobs set status = ''queued'' where id = %L', k), '23514');
  perform tests.expect_rows('C548 extracting keeps counts',
    format('update public.import_jobs set status = ''extracting'', extract_cursor = 1, extract_total = 2 where id = %L', k), 1);
  perform tests.expect_error('C548 uploaded with count',
    format('update public.import_jobs set table_count = 1, row_count = 3 where id = %L', tests.id('jU')), '23514');
  perform tests.expect_error('C548 parsed without read time',
    format('update public.import_jobs set read_at = null where id = %L', tests.id('jD')), '23514');
  perform tests.expect_error('C548 unreadable with count',
    format('update public.import_jobs set status = ''unreadable'', read_error = ''corrupt'', table_count = 1, row_count = 3, read_at = now() where id = %L', tests.id('jN')), '23514');
end $$;

-- C549: the chunk write (door 4) refuses every other state, and is an invoker function.
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C549 uploaded', format('select public.record_extraction_chunk(%L, null, 1, ''[]'')', tests.id('jU')), '40001');
  perform tests.expect_error('C549 uploading', format('select public.record_extraction_chunk(%L, null, 1, ''[]'')', tests.id('jobA')), '40001');
  perform tests.expect_error('C549 unreadable', format('select public.record_extraction_chunk(%L, null, 1, ''[]'')', tests.id('jUR')), '40001');
  perform tests.expect_error('C549 extracted', format('select public.record_extraction_chunk(%L, 1, 1, ''[]'')', tests.id('jEX')), '40001');
  perform tests.expect_error('C549 wrong cursor', format('select public.record_extraction_chunk(%L, 2, 3, ''[]'')', tests.id('jX')), '40001');
  perform tests.expect_error('C549 wrong total', format('select public.record_extraction_chunk(%L, 1, 4, ''[]'')', tests.id('jX')), '40001');
  perform tests.expect_error('C549 unknown job', 'select public.record_extraction_chunk(''00000000-0000-4000-8000-0000000000ff'', null, 1, ''[]'')', 'P0002');
end $$;
reset role;
do $$
declare f oid := 'public.record_extraction_chunk(uuid,integer,integer,jsonb)'::regprocedure;
begin
  perform tests.ok('C549 invoker', not (select prosecdef from pg_proc where oid = f), 'the function is security definer');
  perform tests.ok('C549 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
  perform tests.ok('C549 anon', not has_function_privilege('anon', f, 'execute'), 'anon may execute it');
end $$;

-- C550: the counts view (door 7), read as the caller.
insert into public.import_rows (org_id, job_id, position, confidence, asset_type_id)
select tests.id('orgA'), tests.id('jN'), g, 'high', case when g <= 3 then tests.id('typeA') end from generate_series(1, 5) as g;
select tests.act_as('uE');
do $$ begin
  perform tests.ok('C550 counts', (select rows = 5 and unmatched = 2 from public.import_row_counts where job_id = tests.id('jN')), 'counts are not 5 and 2');
  perform tests.ok('C550 empty job', (select count(*) from public.import_row_counts where job_id = tests.id('jD')) = 0, 'a job with no rows has a count row');
end $$;
reset role;
select tests.act_as('uB');
do $$ begin
  perform tests.ok('C550 other org', (select count(*) from public.import_row_counts where job_id = tests.id('jN')) = 0, 'uB reads org A counts');
end $$;
reset role;
do $$ begin
  perform tests.ok('C550 anon', not has_table_privilege('anon', 'public.import_row_counts', 'select'), 'anon may select the view');
end $$;

rollback;
select 'import_extract: pass' as result;
