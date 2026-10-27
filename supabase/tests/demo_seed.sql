-- catalog-seed S3, first run: C12-C18. Runs after fixture.sql and the body of supabase/seed.sql (without its
-- begin/commit lines) in the same execute_sql call. Then the seed body runs again, then demo_seed_rerun.sql (C19).
--
-- C28, read-only on the live project after the real seed run:
--   select (select count(*) from public.orgs where id = d) as orgs,
--          (select name from public.orgs where id = d) as name,
--          (select count(*) from public.asset_types where org_id = d) as types,
--          (select count(*) from public.asset_type_tasks where org_id = d) as tasks,
--          (select count(*) from public.customers where org_id = d) as customers,
--          (select count(*) from public.contacts where org_id = d) as contacts,
--          (select count(*) from public.sites where org_id = d) as sites,
--          (select count(*) from public.assets where org_id = d) as assets,
--          (select count(*) from public.memberships where org_id = d) as memberships,
--          (select count(*) from public.agreements where org_id = d) as agreements,
--          (select count(*) from public.events where org_id = d) as events
--   from (select '00000000-0000-4000-8000-00000000de30'::uuid as d) x;

create function tests.demo() returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-00000000de30'::uuid $$;

-- C12
do $$ begin
  perform tests.ok('C12 count', (select count(*) from public.orgs where id = tests.demo()) = 1, 'no single demo org');
  perform tests.ok('C12 name',
    (select name from public.orgs where id = tests.demo()) = 'Kettle Ridge Mechanical Ltd.', 'demo org name differs');
end $$;

-- C13
do $$
declare s public.org_settings;
begin
  select * into s from public.org_settings where org_id = tests.demo();
  perform tests.ok('C13 row', s.org_id is not null, 'no settings row');
  perform tests.ok('C13 repair_discount_pct', s.repair_discount_pct = 10, 'repair_discount_pct is ' || coalesce(s.repair_discount_pct::text, 'null'));
  perform tests.ok('C13 cpi_cap_pct', s.cpi_cap_pct = 5, 'cpi_cap_pct is ' || coalesce(s.cpi_cap_pct::text, 'null'));
  perform tests.ok('C13 cancellation_notice_days', s.cancellation_notice_days = 30, 'cancellation_notice_days differs');
  perform tests.ok('C13 payment_days', s.payment_days = 30, 'payment_days differs');
  perform tests.ok('C13 governing_province', s.governing_province = 'BC', 'governing_province differs');
  perform tests.ok('C13 legal_name', btrim(coalesce(s.legal_name, '')) <> '', 'legal_name blank');
  perform tests.ok('C13 address', btrim(coalesce(s.address, '')) <> '', 'address blank');
  perform tests.ok('C13 phone', btrim(coalesce(s.phone, '')) <> '', 'phone blank');
  perform tests.ok('C13 accent_color', btrim(coalesce(s.accent_color, '')) <> '', 'accent_color blank');
  perform tests.ok('C13 tax_note', btrim(coalesce(s.tax_note, '')) <> '', 'tax_note blank');
end $$;

-- C14
do $$ begin
  perform tests.ok('C14 types', (select count(*) from public.asset_types where org_id = tests.demo()) = 40, 'demo does not have 40 types');
  perform tests.ok('C14 tasks', (select count(*) from public.asset_type_tasks where org_id = tests.demo()) = 174, 'demo does not have 174 tasks');
  perform tests.ok('C14 task set',
    not exists ((select t.code, k.position, k.description from public.asset_type_tasks k
                 join public.asset_types t on t.id = k.asset_type_id where k.org_id = tests.demo()
                 except select code, position, description from private.catalog_asset_type_tasks)
                union all
                (select code, position, description from private.catalog_asset_type_tasks
                 except select t.code, k.position, k.description from public.asset_type_tasks k
                 join public.asset_types t on t.id = k.asset_type_id where k.org_id = tests.demo())),
    'demo tasks differ from the template');
end $$;

-- C15
do $$
declare
  names text[] := array[
    -- C15 names
    'Harbourview Towers Strata', 'Pinecrest Office Park', 'Lakeshore Brewing Co.', 'Northgate Self Storage',
    'Juniper Medical Clinic', 'Copperleaf Seniors Residence', 'Tidewater Hotel', 'Glacier Valley Cold Storage',
    'Brookhaven Community Centre', 'Ridgeline Retail Plaza', 'Saltmarsh Bakery', 'Fernwood Dental'
    -- end C15 names
  ];
begin
  perform tests.ok('C15 count', (select count(*) from public.customers where org_id = tests.demo()) = 12, 'demo does not have 12 customers');
  perform tests.ok('C15 name set',
    not exists ((select name from public.customers where org_id = tests.demo() except select unnest(names))
                union all
                (select unnest(names) except select name from public.customers where org_id = tests.demo())),
    'customer names differ from the sample pipeline');
  perform tests.ok('C15 one contact',
    not exists (select 1 from public.customers c where c.org_id = tests.demo()
                and (select count(*) from public.contacts k where k.customer_id = c.id) <> 1),
    'a customer does not have exactly 1 contact');
  perform tests.ok('C15 one site',
    not exists (select 1 from public.customers c where c.org_id = tests.demo()
                and (select count(*) from public.sites s where s.customer_id = c.id) <> 1),
    'a customer does not have exactly 1 site');
  perform tests.ok('C15 site contact',
    not exists (select 1 from public.sites s where s.org_id = tests.demo()
                and s.site_contact_id is distinct from (select k.id from public.contacts k where k.customer_id = s.customer_id)),
    'a site contact is not the customer''s contact');
end $$;

-- C16
do $$ begin
  perform tests.ok('C16 per site',
    not exists (select 1 from public.sites s where s.org_id = tests.demo()
                and (select count(*) from public.assets a where a.site_id = s.id) not between 2 and 8),
    'a site has fewer than 2 or more than 8 assets');
  perform tests.ok('C16 fields',
    not exists (select 1 from public.assets a where a.org_id = tests.demo()
                and (a.source <> 'manual' or btrim(coalesce(a.unit_no, '')) = ''
                     or btrim(coalesce(a.type_model, '')) = '' or btrim(coalesce(a.location, '')) = '')),
    'an asset is not manual or has a blank unit_no, type_model or location');
  perform tests.ok('C16 own catalog',
    not exists (select 1 from public.assets a join public.asset_types t on t.id = a.asset_type_id
                where a.org_id = tests.demo() and t.org_id <> tests.demo()),
    'an asset uses another org''s type');
  perform tests.ok('C16 distinct types',
    (select count(distinct asset_type_id) from public.assets where org_id = tests.demo()) >= 12,
    'fewer than 12 distinct asset types');
end $$;

-- C17
do $$ begin
  perform tests.ok('C17 memberships', (select count(*) from public.memberships where org_id = tests.demo()) = 0, 'demo has members');
  perform tests.ok('C17 agreements', (select count(*) from public.agreements where org_id = tests.demo()) = 12, 'demo does not have its 12 agreements (staff-screens C120 supersedes the earlier 0)');
  perform tests.ok('C17 events', (select count(*) from public.events where org_id = tests.demo()) = 0, 'demo has events');
end $$;

-- C18
do $$ begin
  perform tests.ok('C18 source company',
    not exists (select 1 from (
        select row_to_json(o)::text as j from public.orgs o where o.id = tests.demo()
        union all select row_to_json(s)::text from public.org_settings s where s.org_id = tests.demo()
        union all select row_to_json(c)::text from public.customers c where c.org_id = tests.demo()
        union all select row_to_json(k)::text from public.contacts k where k.org_id = tests.demo()
        union all select row_to_json(s)::text from public.sites s where s.org_id = tests.demo()
        union all select row_to_json(a)::text from public.assets a where a.org_id = tests.demo()
      ) x where j ~* '(enviroware|byrne|604 803)'),
    'demo rows carry the source company');
  perform tests.ok('C18 emails',
    not exists (select 1 from public.contacts where org_id = tests.demo() and coalesce(email, '') !~ '@example\.com$'),
    'a contact email is not @example.com');
  perform tests.ok('C18 phones',
    not exists (select phone from public.org_settings where org_id = tests.demo() and phone is not null
                  and phone !~ '555-01[0-9]{2}$'
                union all
                select phone from public.contacts where org_id = tests.demo() and phone is not null
                  and phone !~ '555-01[0-9]{2}$'),
    'a phone is outside 555-01xx');
end $$;

-- C821 (service-included): frozen demo versions hold their site's scope; the current version of a draft stays live.
do $$ begin
  perform tests.ok('C821 frozen',
    not exists (select 1 from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
                where v.org_id = tests.demo()
                  and not (a.status = 'draft' and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id))
                  and (v.snapshot ->> 'schema') is distinct from '1'),
    'a frozen demo version has no scope');
  perform tests.ok('C821 drafts live',
    (select count(*) from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
     where v.org_id = tests.demo() and a.status = 'draft' and v.snapshot = '{}'::jsonb
       and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)) = 2,
    'the 2 demo drafts do not all keep an empty snapshot');
end $$;

-- Snapshots after the first run, for C821 on the second.
create table tests.demo_snapshots as
select id, snapshot::text as snapshot from public.agreement_versions where org_id = tests.demo();

-- Counts after the first run, for C19.
create table tests.demo_counts as
select 'orgs' as t, (select count(*) from public.orgs where id = tests.demo()) as n
union all
select t, tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.demo()))
from unnest(tests.tenant_tables()) as t;
