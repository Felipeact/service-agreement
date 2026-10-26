-- import-upload: C405, C413, C423, C428, C429, C432. Run after fixture.sql in the same execute_sql call
-- (npm run test:db import_upload). Fixture: jobA (org A, siteA) and jobB (org B, siteB) are `uploading`.
-- storage.objects rows are inserted straight in SQL as the acting role; a delete needs storage.allow_delete_query,
-- because storage.protect_delete raises otherwise. RLS still decides which rows a statement touches.

-- Setup, as the table owner: one uploaded job of A, and one stored object per fixture job.
reset role;
insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status)
values (tests.id('jobUpA'), tests.id('orgA'), tests.id('siteA'), 'done.csv', 'text/csv', 100, 'uploaded');
insert into storage.objects (bucket_id, name)
values ('imports', tests.id('orgA') || '/' || tests.id('jobUpA')),
       ('imports', tests.id('orgB') || '/' || tests.id('jobB'));

-- C413: the private bucket, its size limit and its four content types.
do $$ begin
  perform tests.ok('C413 one bucket', (select count(*) from storage.buckets where id = 'imports') = 1, 'no imports bucket');
  perform tests.ok('C413 private', (select not public from storage.buckets where id = 'imports'), 'bucket is public');
  perform tests.ok('C413 size', (select file_size_limit from storage.buckets where id = 'imports') = 20971520, 'size limit is not 20971520');
  perform tests.ok('C413 types',
    (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'imports')
      = array['application/pdf',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/csv'],
    'allowed types are not the four');
end $$;

-- C405: an estimator starts a job (uploading, created_by and created_by_email from the JWT), then stores its file.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', tests.id('uE'), 'role', 'authenticated', 'email', 'uE@example.test')::text, true);
select set_config('role', 'authenticated', true);
do $$
declare j public.import_jobs;
begin
  insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes)
  values (tests.id('orgA'), tests.id('siteA'), 'units.csv', 'text/csv', 2048)
  returning * into j;
  perform tests.ok('C405 status', j.status = 'uploading', 'status is ' || j.status);
  perform tests.ok('C405 created_by', j.created_by = tests.id('uE'), 'created_by is not uE');
  perform tests.ok('C405 created_by_email', j.created_by_email = 'uE@example.test', 'created_by_email is not the JWT email');
  perform tests.expect_rows('C405 store the file',
    format('insert into storage.objects (bucket_id, name) values (''imports'', %L)', tests.id('orgA') || '/' || j.id), 1);
end $$;

-- C432: import_jobs rules.
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C432 viewer insert',
    format('insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes) values (%L, %L, ''v.csv'', ''text/csv'', 1)',
      tests.id('orgA'), tests.id('siteA')), '42501');
  perform tests.expect_rows('C432 viewer update', format('update public.import_jobs set status = ''uploaded'' where id = %L', tests.id('jobA')), 0);
  perform tests.expect_rows('C432 viewer delete', format('delete from public.import_jobs where id = %L', tests.id('jobA')), 0);
  perform tests.ok('C432 viewer reads', (select count(*) from public.import_jobs where id = tests.id('jobA')) = 1, 'viewer cannot read jobA');
end $$;

reset role;
select tests.act_as('uB');
do $$ begin
  perform tests.ok('C432 other org reads nothing', (select count(*) from public.import_jobs where org_id = tests.id('orgA')) = 0, 'uB reads org A jobs');
end $$;

reset role;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C432 foreign site',
    format('insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes) values (%L, %L, ''x.csv'', ''text/csv'', 1)',
      tests.id('orgA'), tests.id('siteB')), '23503');
  perform tests.expect_error('C432 unknown status',
    format('insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes, status) values (%L, %L, ''x.csv'', ''text/csv'', 1, ''parsing'')',
      tests.id('orgA'), tests.id('siteA')), '23514');
end $$;

-- C429: an estimator cannot store a file outside an uploading job of its own org, nor overwrite one.
do $$
declare
  a text := tests.id('orgA')::text;
  k text;
begin
  foreach k in array array[
    a || '/' || gen_random_uuid(),          -- no such job
    a || '/' || tests.id('jobB'),           -- a job of org B
    a || '/' || tests.id('jobUpA'),         -- a job of A that is already uploaded
    a                                        -- no job folder
  ] loop
    perform tests.expect_error('C429 insert ' || k,
      format('insert into storage.objects (bucket_id, name) values (''imports'', %L)', k), '42501');
  end loop;
  perform tests.expect_rows('C429 no update policy',
    format('update storage.objects set name = name || ''x'' where bucket_id = ''imports'' and name = %L', a || '/' || tests.id('jobUpA')), 0);
end $$;

reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C429 viewer insert',
    format('insert into storage.objects (bucket_id, name) values (''imports'', %L)', tests.id('orgA') || '/' || tests.id('jobA')), '42501');
end $$;

-- C428: another org and anon reach nothing under org A's folder.
reset role;
select tests.act_as('uB');
select set_config('storage.allow_delete_query', 'true', true);
do $$ begin
  perform tests.ok('C428 other org select',
    (select count(*) from storage.objects where bucket_id = 'imports' and name like tests.id('orgA') || '/%') = 0, 'uB reads org A files');
  perform tests.ok('C428 own org select',
    (select count(*) from storage.objects where bucket_id = 'imports' and name = tests.id('orgB') || '/' || tests.id('jobB')) = 1, 'uB cannot read its own file');
  perform tests.expect_error('C428 other org insert',
    format('insert into storage.objects (bucket_id, name) values (''imports'', %L)', tests.id('orgA') || '/' || tests.id('jobA')), '42501');
  perform tests.expect_rows('C428 other org delete',
    format('delete from storage.objects where bucket_id = ''imports'' and name = %L', tests.id('orgA') || '/' || tests.id('jobUpA')), 0);
end $$;

reset role;
select tests.act_as_anon();
do $$ begin
  perform tests.ok('C428 anon select', (select count(*) from storage.objects where bucket_id = 'imports') = 0, 'anon reads imports');
  perform tests.expect_error('C428 anon insert',
    format('insert into storage.objects (bucket_id, name) values (''imports'', %L)', tests.id('orgA') || '/' || tests.id('jobA')), '42501');
end $$;

-- C423: an estimator discards a job: the row, then its file.
reset role;
select tests.act_as('uE');
select set_config('storage.allow_delete_query', 'true', true);
do $$ begin
  perform tests.expect_rows('C423 delete the job', format('delete from public.import_jobs where id = %L', tests.id('jobUpA')), 1);
  perform tests.expect_rows('C423 delete the file',
    format('delete from storage.objects where bucket_id = ''imports'' and name = %L', tests.id('orgA') || '/' || tests.id('jobUpA')), 1);
end $$;
reset role;

rollback;
select 'import_upload: pass' as result;
