-- S1 tenant isolation: C1-C7, C35, C36, C41, C43. Run after fixture.sql in the same execute_sql call.

-- C1
do $$ begin
  perform tests.ok('C1',
    (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) = 0,
    'a public table has RLS disabled');
end $$;

-- C35
do $$ begin
  perform tests.ok('C35',
    (select array_agg(tablename::text order by tablename) from pg_tables where schemaname = 'public')
    = (select array_agg(t order by t) from unnest(array['orgs','memberships','org_settings','customers','contacts',
        'sites','asset_types','asset_type_tasks','assets','agreements','agreement_versions','service_lines',
        'contracts','events','outbox','import_jobs','import_rows','portal_links','notifications','service_line_asset_types']) as t),
    'public tables differ from the 20 in the plans (supabase-init, import-upload, import-extract, customer-portal, outbox-dispatch, cadence)');
end $$;

-- C36
do $$
declare f record;
begin
  perform tests.ok('C36',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname in ('is_org_member', 'has_org_role')) = 2,
    'helpers missing');
  for f in
    select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('is_org_member', 'has_org_role')
  loop
    perform tests.ok('C36 ' || f.proname, f.prosecdef, 'not security definer');
    perform tests.ok('C36 ' || f.proname, 'search_path=""' = any(f.proconfig), 'search_path is not empty');
    perform tests.ok('C36 ' || f.proname, not has_function_privilege('anon', f.oid, 'execute'), 'anon can execute');
  end loop;
  perform tests.ok('C36 is_org_member signature',
    to_regprocedure('private.is_org_member(uuid)') is not null, 'wrong signature');
  perform tests.ok('C36 has_org_role signature',
    to_regprocedure('private.has_org_role(uuid, text[])') is not null, 'wrong signature');
end $$;

-- C41
do $$
declare t text;
begin
  foreach t in array tests.tenant_tables() loop
    perform tests.ok('C41 ' || t,
      exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = t and column_name = 'org_id' and is_nullable = 'NO'),
      'org_id missing or nullable');
  end loop;
end $$;

-- C5: a child in org A pointing at a parent in org B (run as table owner, so only the FK can stop it)
do $$
declare
  a uuid := tests.id('orgA');
begin
  perform tests.expect_error('C5 contacts->customers',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''x'')', a, tests.id('custB')), '23503');
  perform tests.expect_error('C5 sites->customers',
    format('insert into public.sites (org_id, customer_id, name) values (%L, %L, ''x'')', a, tests.id('custB')), '23503');
  perform tests.expect_error('C5 asset_type_tasks->asset_types',
    format('insert into public.asset_type_tasks (org_id, asset_type_id, position, description) values (%L, %L, 9, ''x'')', a, tests.id('typeB')), '23503');
  perform tests.expect_error('C5 assets->sites',
    format('insert into public.assets (org_id, site_id, asset_type_id, unit_no) values (%L, %L, %L, ''x'')', a, tests.id('siteB'), tests.id('typeA')), '23503');
  perform tests.expect_error('C5 assets->asset_types',
    format('insert into public.assets (org_id, site_id, asset_type_id, unit_no) values (%L, %L, %L, ''x'')', a, tests.id('siteA'), tests.id('typeB')), '23503');
  -- Withdrawn, so siteB's live agreement (agreement-builder door 2) cannot answer before the foreign key does.
  perform tests.expect_error('C5 agreements->sites',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''withdrawn'')', a, tests.id('siteB')), '23503');
  perform tests.expect_error('C5 agreement_versions->agreements',
    format('insert into public.agreement_versions (org_id, agreement_id, version_no) values (%L, %L, 99)', a, tests.id('agrB')), '23503');
  perform tests.expect_error('C5 service_lines->agreement_versions',
    format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) values (%L, %L, ''x'', ''{1}'', 1, 0)', a, tests.id('verB')), '23503');
  perform tests.expect_error('C5 contracts->agreement_versions',
    format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', a, tests.id('ver2B')), '23503');
  perform tests.expect_error('C5 outbox->events',
    format('insert into public.outbox (org_id, event_id) values (%L, %L)', a, tests.id('evt2B')), '23503');
end $$;

-- C6: the site contact must belong to the site's customer
do $$ begin
  perform tests.expect_error('C6',
    format('insert into public.sites (org_id, customer_id, site_contact_id, name) values (%L, %L, %L, ''x'')',
      tests.id('orgA'), tests.id('custA'), tests.id('ct2A')), '23503');
end $$;

select tests.act_as('uA');

-- C2 (outbox rejects every select: C30)
do $$
declare t text;
begin
  foreach t in array array_remove(tests.tenant_tables(), 'outbox') loop
    perform tests.ok('C2 ' || t,
      tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.id('orgB'))) = 0,
      'uA sees org B rows');
  end loop;
  perform tests.ok('C2 orgs',
    tests.count(format('select count(*) from public.orgs where id = %L', tests.id('orgB'))) = 0,
    'uA sees org B');
end $$;

-- C3
do $$
declare t text;
begin
  foreach t in array tests.tenant_tables() loop
    perform tests.expect_error('C3 ' || t, tests.insert_sql(t, 'B'), '42501');
  end loop;
end $$;

-- C4
do $$
declare
  t text;
  b uuid := tests.id('orgB');
begin
  perform tests.expect_error('C4 memberships',
    format('update public.memberships set org_id = %L where org_id = %L and user_id = %L', b, tests.id('orgA'), tests.id('uV')), '42501');
  perform tests.expect_error('C4 org_settings',
    format('update public.org_settings set org_id = %L where org_id = %L', b, tests.id('orgA')), '42501');
  foreach t in array array['customers','contacts','sites','asset_types','asset_type_tasks','assets','agreements',
                           'agreement_versions','service_lines','contracts'] loop
    perform tests.expect_error('C4 ' || t,
      format('update public.%I set org_id = %L where org_id = %L', t, b, tests.id('orgA')), '42501');
  end loop;
end $$;

reset role;
select tests.act_as_anon();

-- C7
do $$
declare t text;
begin
  foreach t in array array['orgs','memberships','org_settings','customers','contacts','sites','asset_types',
                           'asset_type_tasks','assets','agreements','agreement_versions','service_lines',
                           'contracts','events'] loop
    perform tests.ok('C7 ' || t, tests.count(format('select count(*) from public.%I', t)) = 0, 'anon sees rows');
  end loop;
end $$;

-- C43
do $$
declare t text;
begin
  foreach t in array array['orgs'] || tests.tenant_tables() loop
    perform tests.expect_error('C43 ' || t, tests.insert_sql(t, 'A'), '42501');
  end loop;
end $$;

reset role;
rollback;
select 'rls_isolation: pass' as result;
