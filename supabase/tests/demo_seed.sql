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
                  and coalesce(v.snapshot ->> 'schema', '') not in ('1', '2')),
    'a frozen demo version has no scope');
  perform tests.ok('C821 drafts live',
    (select count(*) from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
     where v.org_id = tests.demo() and a.status = 'draft' and v.snapshot = '{}'::jsonb
       and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)) = 2,
    'the 2 demo drafts do not all keep an empty snapshot');
end $$;

-- C821: a frozen version already holding a scope keeps it on the next run. This one's takenAt differs from what the
-- backfill would write, so a run that ignored the `snapshot = '{}'` guard would change it.
update public.agreement_versions
set snapshot = '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00", "terms": {"repairDiscountPct": 99, "cpiCapPct": 1, "cancellationNoticeDays": null, "paymentDays": null, "governingProvince": null, "taxNote": null}}'
where id = md5('demo:version:4')::uuid;

-- C937 (customer-portal): every frozen demo version holds terms after the first run.
do $$ begin
  perform tests.ok('C937 frozen terms',
    not exists (select 1 from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
                where v.org_id = tests.demo() and not (v.snapshot ? 'terms')
                  and not (a.status = 'draft' and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id))),
    'a frozen demo version has no terms');
  perform tests.ok('C937 drafts keep none',
    not exists (select 1 from public.agreement_versions v join public.agreements a on a.id = v.agreement_id
                where v.org_id = tests.demo() and a.status = 'draft' and v.snapshot = '{}'::jsonb and v.snapshot ? 'terms'),
    'a live draft version holds terms');
end $$;

-- C937: the settings change before the second run; a version that already has terms must not follow them.
update public.org_settings set repair_discount_pct = 42 where org_id = tests.demo();

-- Snapshots after the first run, for C821 on the second.
create table tests.demo_snapshots as
select id, snapshot::text as snapshot from public.agreement_versions where org_id = tests.demo();

-- C1094 (cadence): every demo line has months, and covers something when its site has assets.
do $$ begin
  perform tests.ok('C1094 lines', (select count(*) from public.service_lines where org_id = tests.demo()) > 0, 'no demo lines');
  perform tests.ok('C1094 months',
    not exists (select 1 from public.service_lines where org_id = tests.demo()
                and (visit_months is null or cardinality(visit_months) = 0)),
    'a demo line has no visit months');
  perform tests.ok('C1094 coverage',
    not exists (select 1 from public.service_lines l
                join public.agreement_versions v on v.id = l.agreement_version_id
                join public.agreements a on a.id = v.agreement_id
                where l.org_id = tests.demo()
                  and exists (select 1 from public.assets s where s.site_id = a.site_id)
                  and not exists (select 1 from public.service_line_asset_types c where c.service_line_id = l.id)),
    'a demo line on a site with assets covers nothing');
end $$;

-- Months and coverage after the first run, for C1094 on the second.
create table tests.demo_cadence as
select l.id, l.visit_months::text as months,
       (select coalesce(array_agg(c.asset_type_id order by c.asset_type_id)::text, '{}')
        from public.service_line_asset_types c where c.service_line_id = l.id) as cover
from public.service_lines l where l.org_id = tests.demo();

-- C1104 (seasonal-tasks): the demo org's three seasonal tasks carry the catalog's months.
do $$ begin
  perform tests.ok('C1104 months',
    (select array_agg(t.code || ':' || k.description || ':' || k.visit_months::text order by t.code, k.description)
     from public.asset_type_tasks k join public.asset_types t on t.id = k.asset_type_id
     where k.org_id = tests.demo() and k.visit_months is not null)
      = array['ERV:Check heating operation:{1,2,3,10,11,12}',
              'RTU:Check compressor operation during cooling operation:{4,5,6,7,8,9}',
              'RTU:Inspect heat exchanger during heating season:{1,2,3,10,11,12}'],
    'the demo org''s seasonal tasks differ from the catalog''s');
end $$;

-- Every demo task after the first run, for C1104 on the second.
create table tests.demo_tasks as
select md5(coalesce(string_agg(k.id::text || ':' || k.description || ':' || coalesce(k.visit_months::text, 'null'), ',' order by k.id), '')) as h
from public.asset_type_tasks k where k.org_id = tests.demo();

-- Counts after the first run, for C19.
create table tests.demo_counts as
select 'orgs' as t, (select count(*) from public.orgs where id = tests.demo()) as n
union all
select t, tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.demo()))
from unnest(tests.tenant_tables()) as t;
