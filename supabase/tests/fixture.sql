-- Shared fixture for supabase/tests/*.sql. Run as one execute_sql call: this file, then a test file.
-- Opens a transaction; every test file ends in rollback, so nothing here persists.
begin;

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Deterministic ids from readable names: tests.id('orgA').
create function tests.id(p_name text) returns uuid
language sql immutable as $$ select md5(p_name)::uuid $$;

-- The 16 public tables that carry org_id (checks.md "tenant tables").
create function tests.tenant_tables() returns text[]
language sql immutable as $$
  select array['memberships','org_settings','customers','contacts','sites','asset_types','asset_type_tasks',
               'assets','agreements','agreement_versions','service_lines','contracts','events','outbox','import_jobs','import_rows']
$$;

create function tests.act_as(p_user text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_user), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create function tests.ok(p_label text, p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception '%: %', p_label, p_msg;
  end if;
end $$;

create function tests.count(p_sql text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute p_sql into n;
  return n;
end $$;

-- Runs p_sql and requires it to fail with exactly p_state.
create function tests.expect_error(p_label text, p_sql text, p_state text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then
      return;
    end if;
    raise exception '%: expected SQLSTATE %, got % (%)', p_label, p_state, sqlstate, sqlerrm;
  end;
  raise exception '%: expected SQLSTATE %, statement succeeded', p_label, p_state;
end $$;

-- Runs p_sql and requires it to succeed affecting exactly p_rows rows.
create function tests.expect_rows(p_label text, p_sql text, p_rows bigint) returns void
language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  if n <> p_rows then
    raise exception '%: expected % row(s), got %', p_label, p_rows, n;
  end if;
end $$;

-- The highest version of an agreement, read past RLS so a caller of another org still gets an id to aim at.
create function tests.latest_version(p_agreement uuid) returns uuid
language sql security definer as $$
  select id from public.agreement_versions where agreement_id = p_agreement order by version_no desc limit 1
$$;

-- A valid insert into p_table for org p_org ('A' or 'B'), using that org's fixture parents.
create function tests.insert_sql(p_table text, p_org text) returns text
language plpgsql as $$
declare
  o uuid := tests.id('org' || p_org);
  r text := substr(md5(random()::text), 1, 8);
begin
  return case p_table
    when 'orgs' then format('insert into public.orgs (name) values (%L)', 'Org ' || r)
    when 'memberships' then format('insert into public.memberships (org_id, user_id, role) values (%L, %L, ''viewer'')', o, tests.id('uX'))
    when 'org_settings' then format('insert into public.org_settings (org_id, legal_name) values (%L, %L)', o, 'Settings ' || r)
    when 'customers' then format('insert into public.customers (org_id, name) values (%L, %L)', o, 'Customer ' || r)
    when 'contacts' then format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, %L)', o, tests.id('cust' || p_org), 'Contact ' || r)
    when 'sites' then format('insert into public.sites (org_id, customer_id, name) values (%L, %L, %L)', o, tests.id('cust' || p_org), 'Site ' || r)
    when 'asset_types' then format('insert into public.asset_types (org_id, code, name) values (%L, %L, %L)', o, 'T' || upper(r), 'Type ' || r)
    when 'asset_type_tasks' then format('insert into public.asset_type_tasks (org_id, asset_type_id, position, description) values (%L, %L, 99, %L)', o, tests.id('type' || p_org), 'Task ' || r)
    when 'assets' then format('insert into public.assets (org_id, site_id, asset_type_id, unit_no) values (%L, %L, %L, %L)', o, tests.id('site' || p_org), tests.id('type' || p_org), 'U-' || r)
    -- Withdrawn: the fixture site already has its live agreement agr<org> (agreement-builder door 2).
    when 'agreements' then format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''withdrawn'')', o, tests.id('site' || p_org))
    when 'agreement_versions' then format('insert into public.agreement_versions (org_id, agreement_id, version_no) values (%L, %L, %s)', o, tests.id('agr' || p_org), 1000 + floor(random() * 900000)::int)
    -- The latest version of agr<org>: a member may write lines only there (agreement-builder door 4).
    when 'service_lines' then format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) values (%L, %L, %L, ''{3,6,9,12}'', 4, 50000)', o, tests.latest_version(tests.id('agr' || p_org)), 'Line ' || r)
    when 'contracts' then format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', o, tests.id('ver2' || p_org))
    when 'events' then format('insert into public.events (org_id, entity_type, entity_id, type) values (%L, ''agreement'', %L, ''agreement.sent'')', o, tests.id('agr' || p_org))
    when 'outbox' then format('insert into public.outbox (org_id, event_id) values (%L, %L)', o, tests.id('evt2' || p_org))
    when 'import_rows' then format('insert into public.import_rows (org_id, job_id, position, confidence) values (%L, %L, %s, ''low'')', o, tests.id('job' || p_org), 1000 + floor(random() * 900000)::int)
    when 'import_jobs' then format('insert into public.import_jobs (org_id, site_id, original_name, content_type, size_bytes) values (%L, %L, %L, ''text/csv'', 100)', o, tests.id('site' || p_org), r || '.csv')
  end;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Users: uA owner of A, uB owner of B, uV viewer in A, uE estimator in A, uX in no org.
insert into auth.users (id, email, aud, role)
select tests.id(u), u || '@example.test', 'authenticated', 'authenticated'
from unnest(array['uA','uB','uV','uE','uX']) as u;

insert into public.orgs (id, name) values
  (tests.id('orgA'), 'Northwind Mechanical (test)'),
  (tests.id('orgB'), 'Bluepeak HVAC (test)');

insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgA'), tests.id('uA'), 'owner'),
  (tests.id('orgA'), tests.id('uV'), 'viewer'),
  (tests.id('orgA'), tests.id('uE'), 'estimator'),
  (tests.id('orgB'), tests.id('uB'), 'owner');

-- One row per table for each org, with fixed ids named <thing><org>.
do $$
declare o text;
begin
  foreach o in array array['A','B'] loop
    insert into public.org_settings (org_id, legal_name) values (tests.id('org' || o), 'Legal ' || o);
    insert into public.customers (id, org_id, name) values (tests.id('cust' || o), tests.id('org' || o), 'Customer ' || o);
    insert into public.customers (id, org_id, name) values (tests.id('cust2' || o), tests.id('org' || o), 'Customer 2 ' || o);
    insert into public.contacts (id, org_id, customer_id, name) values (tests.id('ct' || o), tests.id('org' || o), tests.id('cust' || o), 'Contact ' || o);
    insert into public.contacts (id, org_id, customer_id, name) values (tests.id('ct2' || o), tests.id('org' || o), tests.id('cust2' || o), 'Contact 2 ' || o);
    insert into public.sites (id, org_id, customer_id, site_contact_id, name) values (tests.id('site' || o), tests.id('org' || o), tests.id('cust' || o), tests.id('ct' || o), 'Site ' || o);
    insert into public.asset_types (id, org_id, code, name) values (tests.id('type' || o), tests.id('org' || o), 'RTU', 'Rooftop unit');
    insert into public.asset_type_tasks (id, org_id, asset_type_id, position, description) values (tests.id('task' || o), tests.id('org' || o), tests.id('type' || o), 1, 'Replace filters');
    insert into public.assets (id, org_id, site_id, asset_type_id, unit_no) values (tests.id('asset' || o), tests.id('org' || o), tests.id('site' || o), tests.id('type' || o), 'RTU-1');
    insert into public.agreements (id, org_id, site_id) values (tests.id('agr' || o), tests.id('org' || o), tests.id('site' || o));
    insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('ver' || o), tests.id('org' || o), tests.id('agr' || o), 1);
    insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('ver2' || o), tests.id('org' || o), tests.id('agr' || o), 2);
    insert into public.service_lines (id, org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) values (tests.id('line' || o), tests.id('org' || o), tests.id('ver2' || o), 'Quarterly PM', '{3,6,9,12}', 4, 35700);
    insert into public.contracts (id, org_id, agreement_version_id) values (tests.id('con' || o), tests.id('org' || o), tests.id('ver' || o));
    insert into public.events (id, org_id, entity_type, entity_id, type) values (tests.id('evt' || o), tests.id('org' || o), 'agreement', tests.id('agr' || o), 'agreement.sent');
    insert into public.events (id, org_id, entity_type, entity_id, type) values (tests.id('evt2' || o), tests.id('org' || o), 'agreement', tests.id('agr' || o), 'agreement.accepted');
    insert into public.outbox (id, org_id, event_id) values (tests.id('out' || o), tests.id('org' || o), tests.id('evt' || o));
    insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status)
      values (tests.id('job' || o), tests.id('org' || o), tests.id('site' || o), 'units-' || o || '.csv', 'text/csv', 100, 'uploading');
    insert into public.import_rows (id, org_id, job_id, position, confidence)
      values (tests.id('row' || o), tests.id('org' || o), tests.id('job' || o), 1, 'high');
  end loop;
end $$;

-- Every tenant table holds rows for both orgs, so no isolation proof is vacuous.
do $$
declare t text; o text;
begin
  foreach t in array tests.tenant_tables() loop
    foreach o in array array['A','B'] loop
      perform tests.ok('fixture ' || t || ' ' || o,
        tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.id('org' || o))) > 0,
        'no fixture row');
    end loop;
  end loop;
end $$;

-- The tests are written for a database without the demo org. On a project where supabase/seed.sql already ran,
-- remove it inside this transaction (every tenant table cascades from orgs, AD-003); the rollback restores it.
delete from public.orgs where id = '00000000-0000-4000-8000-00000000de30';
