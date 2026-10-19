-- S3 domain shape: C16-C27, C37-C40, C42. Runs as table owner, after fixture.sql in the same execute_sql call.

-- C16
do $$
declare
  s text;
  got text;
  a uuid := tests.id('orgA');
  site uuid := tests.id('siteA');
begin
  foreach s in array array['draft','sent','accepted','refused','changes_requested','expired','withdrawn'] loop
    insert into public.agreements (org_id, site_id, status) values (a, site, s);
  end loop;
  perform tests.expect_error('C16 pending',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''pending'')', a, site), '23514');
  insert into public.agreements (org_id, site_id) values (a, site) returning status into got;
  perform tests.ok('C16 default', got = 'draft', 'default is ' || coalesce(got, 'null'));
end $$;

-- C17
do $$
declare
  s text;
  got text;
  v uuid;
  i int := 100;
  a uuid := tests.id('orgA');
begin
  foreach s in array array['pending_signature','client_signed','completed','declined','voided','signed', null] loop
    i := i + 1;
    insert into public.agreement_versions (org_id, agreement_id, version_no) values (a, tests.id('agrA'), i) returning id into v;
    if s = 'signed' then
      perform tests.expect_error('C17 signed',
        format('insert into public.contracts (org_id, agreement_version_id, status) values (%L, %L, ''signed'')', a, v), '23514');
    elsif s is null then
      insert into public.contracts (org_id, agreement_version_id) values (a, v) returning status into got;
      perform tests.ok('C17 default', got = 'pending_signature', 'default is ' || coalesce(got, 'null'));
    else
      insert into public.contracts (org_id, agreement_version_id, status) values (a, v, s);
    end if;
  end loop;
end $$;

-- C18
do $$ begin
  perform tests.expect_error('C18',
    format('insert into public.agreements (org_id, site_id) values (%L, null)', tests.id('orgA')), '23502');
end $$;

-- C39
do $$ begin
  perform tests.ok('C39',
    not exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'agreements' and column_name = 'customer_id'),
    'agreements has customer_id');
end $$;

-- C19
do $$ begin
  perform tests.expect_error('C19 duplicate',
    format('insert into public.agreement_versions (org_id, agreement_id, version_no) values (%L, %L, 1)', tests.id('orgA'), tests.id('agrA')), '23505');
  perform tests.expect_error('C19 zero',
    format('insert into public.agreement_versions (org_id, agreement_id, version_no) values (%L, %L, 0)', tests.id('orgA'), tests.id('agrA')), '23514');
end $$;

-- C20
do $$ begin
  perform tests.expect_error('C20',
    format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', tests.id('orgA'), tests.id('verA')), '23505');
end $$;

-- C40
do $$
declare t text;
begin
  foreach t in array array['service_lines','contracts'] loop
    perform tests.ok('C40 ' || t,
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = t and column_name = 'agreement_version_id' and is_nullable = 'NO'),
      'agreement_version_id missing or nullable');
  end loop;
end $$;

-- C21
do $$
declare c record;
begin
  for c in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name like '%\_cents'
  loop
    perform tests.expect_error('C21 ' || c.table_name || '.' || c.column_name,
      format('update public.%I set %I = -1', c.table_name, c.column_name), '23514');
  end loop;
  perform tests.expect_error('C21 visits_per_year',
    format('update public.service_lines set visits_per_year = 0 where id = %L', tests.id('lineA')), '23514');
end $$;

-- C22
do $$ begin
  perform tests.ok('C22 exists',
    (select count(*) from information_schema.columns where table_schema = 'public' and column_name like '%\_cents') >= 1,
    'no _cents column');
  perform tests.ok('C22 bigint',
    (select count(*) from information_schema.columns
     where table_schema = 'public' and column_name like '%\_cents' and data_type <> 'bigint') = 0,
    'a _cents column is not bigint');
end $$;

-- C23
do $$ begin
  perform tests.expect_error('C23 duplicate',
    format('insert into public.asset_types (org_id, code, name) values (%L, ''RTU'', ''x'')', tests.id('orgA')), '23505');
  insert into public.asset_types (org_id, code, name) values (tests.id('orgA'), 'ZZ1', 'x');
  insert into public.asset_types (org_id, code, name) values (tests.id('orgB'), 'ZZ1', 'x');
end $$;

-- C24
do $$
declare asset uuid := tests.id('assetA');
begin
  update public.assets set source = 'manual' where id = asset;
  update public.assets set source = 'import' where id = asset;
  perform tests.expect_error('C24 excel',
    format('update public.assets set source = ''excel'' where id = %L', asset), '23514');
end $$;

-- C25
do $$
declare
  col text;
  v numeric;
  a uuid := tests.id('orgA');
begin
  foreach col in array array['repair_discount_pct','cpi_cap_pct'] loop
    foreach v in array array[0, 100]::numeric[] loop
      perform tests.expect_rows('C25 ' || col || '=' || v,
        format('update public.org_settings set %I = %s where org_id = %L', col, v, a), 1);
    end loop;
    foreach v in array array[-0.01, 100.01]::numeric[] loop
      perform tests.expect_error('C25 ' || col || '=' || v,
        format('update public.org_settings set %I = %s where org_id = %L', col, v, a), '23514');
    end loop;
  end loop;
end $$;

-- C26
do $$ begin
  perform tests.expect_error('C26',
    format('delete from public.sites where id = %L', tests.id('siteA')), '23503');
end $$;

-- C37
do $$
declare t text;
begin
  foreach t in array array['orgs'] || array_remove(tests.tenant_tables(), 'org_settings') loop
    perform tests.ok('C37 ' || t,
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = t and column_name = 'id'
                and data_type = 'uuid' and column_default = 'gen_random_uuid()'),
      'id is not uuid default gen_random_uuid()');
  end loop;
end $$;

-- C38
do $$ begin
  perform tests.ok('C38 types',
    (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name in ('agreements', 'contracts') and column_name = 'status' and data_type = 'text') = 2,
    'status is not text');
  perform tests.ok('C38 enums',
    (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typtype = 'e') = 0,
    'an enum type exists in public');
end $$;

-- C42
do $$ begin
  perform tests.ok('C42',
    (select array_agg(a.attname::text)
     from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = 'public.org_settings'::regclass and i.indisprimary) = array['org_id'],
    'org_settings primary key is not (org_id)');
end $$;

-- C27 (last: it deletes org A)
do $$
declare
  t text;
  a uuid := tests.id('orgA');
begin
  delete from public.orgs where id = a;
  foreach t in array tests.tenant_tables() loop
    perform tests.ok('C27 ' || t,
      tests.count(format('select count(*) from public.%I where org_id = %L', t, a)) = 0,
      'rows left after org delete');
  end loop;
  perform tests.ok('C27 orgs', not exists (select 1 from public.orgs where id = a), 'org row left');
end $$;

rollback;
select 'domain_constraints: pass' as result;
