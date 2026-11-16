-- p0-launch-fixes, database side: C6001-C6008 (.specs/features/p0-launch-fixes/checks.md). Run after fixture.sql,
-- the hosted objects of the applied migration 20261116120000_p0_launch_fixes.sql. Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB.
-- Expected values come from the checks, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

insert into public.asset_types (id, org_id, code, name) values
  (tests.id('ahuA'), tests.id('orgA'), 'AHU', 'Air handler'),
  (tests.id('blrA'), tests.id('orgA'), 'BOILER', 'Boiler'),
  (tests.id('chlA'), tests.id('orgA'), 'CHILLER', 'Chiller'),
  (tests.id('bfA'), tests.id('orgA'), 'BACKFLOW', 'Backflow preventer');

create function tests.p0_site(p_name text) returns void
language sql as $$
  insert into public.sites (id, org_id, customer_id, name) values (tests.id(p_name), tests.id('orgA'), tests.id('custA'), p_name)
$$;
create function tests.p0_asset(p_site text, p_type text, p_unit text) returns void
language sql as $$
  insert into public.assets (id, org_id, site_id, asset_type_id, unit_no)
  values (tests.id(p_site || ':' || p_unit), tests.id('orgA'), tests.id(p_site), tests.id(p_type), p_unit)
$$;
create function tests.p0_agr(p_name text, p_site text, p_status text) returns void
language plpgsql as $$
begin
  insert into public.agreements (id, org_id, site_id, status) values (tests.id(p_name), tests.id('orgA'), tests.id(p_site), p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id(p_name || ':v1'), tests.id('orgA'), tests.id(p_name), 1);
end $$;
create function tests.p0_line(p_version text, p_types text[]) returns void
language plpgsql as $$
declare t text;
begin
  insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
  values (tests.id(p_version || ':line'), tests.id('orgA'), tests.id(p_version), 1, 'Line', '{4,10}', 2, 10000);
  foreach t in array p_types loop
    insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
    values (tests.id('orgA'), tests.id(p_version || ':line'), tests.id(t));
  end loop;
end $$;
create function tests.p0_codes(p_doc jsonb, p_key text) returns text[]
language sql as $$ select coalesce(array_agg(t ->> 'code' order by t ->> 'code'), '{}') from jsonb_array_elements(p_doc -> p_key) t $$;
create function tests.p0_assets(p_doc jsonb, p_code text) returns bigint
language sql as $$
  select coalesce(sum(jsonb_array_length(t -> 'assets')), 0) from jsonb_array_elements(p_doc -> 'types') t where t ->> 'code' = p_code
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- The site the agreement is built on: 2 RTU, 1 AHU, and one each of BOILER, CHILLER, BACKFLOW.
select tests.p0_site('p0s');
select tests.p0_asset('p0s', 'typeA', 'RTU-1');
select tests.p0_asset('p0s', 'typeA', 'RTU-2');
select tests.p0_asset('p0s', 'ahuA', 'AHU-1');
select tests.p0_asset('p0s', 'blrA', 'B-1');
select tests.p0_asset('p0s', 'chlA', 'CH-1');
select tests.p0_asset('p0s', 'bfA', 'BF-1');
select tests.p0_agr('p0a', 'p0s', 'draft');
select tests.p0_line('p0a:v1', array['ahuA', 'typeA']);
-- Another agreement of the same site, accepted (that frees the site's live slot), covering RTU only.
select tests.p0_agr('p0b', 'p0s', 'accepted');
select tests.p0_line('p0b:v1', array['typeA']);

select tests.act_as('uE');
do $$
declare doc jsonb := public.agreement_service_scope(tests.id('p0a'));
begin
  perform tests.ok('C6001 types', tests.p0_codes(doc, 'types') = array['AHU', 'RTU'], 'scope types are ' || tests.p0_codes(doc, 'types')::text);
  perform tests.ok('C6001 uncovered', tests.p0_codes(doc, 'uncovered') = array['BACKFLOW', 'BOILER', 'CHILLER'], 'uncovered is ' || (doc -> 'uncovered')::text);
  perform tests.ok('C6001 counts', (select bool_and((u ->> 'assetCount')::int = 1) from jsonb_array_elements(doc -> 'uncovered') u), 'an uncovered count is not 1');
  perform tests.ok('C6001 schema', doc -> 'schema' = '2'::jsonb, 'schema is not 2');
end $$;

-- C6001: another org's agreement gives no types, no uncovered and no controls, and raises nothing.
select tests.act_as('uB');
do $$
declare doc jsonb := public.agreement_service_scope(tests.id('p0a'));
begin
  perform tests.ok('C6001 foreign agreement', doc -> 'types' = '[]'::jsonb and doc -> 'uncovered' = '[]'::jsonb and doc -> 'controls' = '[]'::jsonb,
    'org B sees org A scope: ' || doc::text);
end $$;
select tests.act_as_anon();
do $$ begin perform tests.expect_error('C6007 anon scope', format('select public.agreement_service_scope(%L)', tests.id('p0a')), '42501'); end $$;

-- C6002: take RTU off the line; the RTU assets stay on the site.
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.service_line_asset_types where service_line_id = tests.id('p0a:v1:line') and asset_type_id = tests.id('typeA');
select tests.act_as('uE');
do $$
declare doc jsonb := public.agreement_service_scope(tests.id('p0a'));
begin
  perform tests.ok('C6002 types', tests.p0_codes(doc, 'types') = array['AHU'], 'RTU is still in scope: ' || tests.p0_codes(doc, 'types')::text);
  perform tests.ok('C6002 uncovered', 'RTU' = any (tests.p0_codes(doc, 'uncovered')), 'RTU is not listed as uncovered');
  perform tests.ok('C6002 assets stay', (select count(*) from public.assets where site_id = tests.id('p0s') and asset_type_id = tests.id('typeA')) = 2, 'an RTU asset was removed');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values (tests.id('orgA'), tests.id('p0a:v1:line'), tests.id('typeA'));

-- C6003: exclude RTU-1 only.
select tests.act_as('uE');
select public.set_scope_exclusion(tests.id('p0a:v1'), tests.id('p0s:RTU-1'), true);
do $$
declare doc jsonb := public.agreement_service_scope(tests.id('p0a'));
begin
  perform tests.ok('C6003 one fewer', tests.p0_assets(doc, 'RTU') = 1, 'RTU assets in scope: ' || tests.p0_assets(doc, 'RTU'));
  perform tests.ok('C6003 asset live', (select deactivated_at is null from public.assets where id = tests.id('p0s:RTU-1')), 'the asset was deactivated');
  perform tests.ok('C6003 other agreement', tests.p0_assets(public.agreement_service_scope(tests.id('p0b')), 'RTU') = 2, 'another agreement lost the asset');
  perform tests.ok('C6003 control flag', (select (c ->> 'excluded')::boolean from jsonb_array_elements(doc -> 'controls') c where c ->> 'unitNo' = 'RTU-1'), 'the control does not flag RTU-1 as excluded');
end $$;

-- C6004: include it again; excluding twice leaves one row.
select public.set_scope_exclusion(tests.id('p0a:v1'), tests.id('p0s:RTU-1'), false);
do $$ begin
  perform tests.ok('C6004 back', tests.p0_assets(public.agreement_service_scope(tests.id('p0a')), 'RTU') = 2, 'RTU-1 did not come back');
end $$;
select public.set_scope_exclusion(tests.id('p0a:v1'), tests.id('p0s:RTU-1'), true);
select public.set_scope_exclusion(tests.id('p0a:v1'), tests.id('p0s:RTU-1'), true);
do $$ begin
  perform tests.ok('C6004 one row', (select count(*) from public.agreement_scope_exclusions where agreement_version_id = tests.id('p0a:v1')) = 1, 'excluding twice did not leave one row');
end $$;

-- C6005: sending freezes the scope the draft showed, with RTU-1 left out and no draft-only key.
do $$
declare shown jsonb := public.agreement_service_scope(tests.id('p0a')) -> 'types';
begin
  perform public.apply_agreement_transition(tests.id('p0a'), 'draft', 'sent', 'agreement.sent', '{}');
  perform tests.ok('C6005 snapshot types', (select snapshot -> 'types' from public.agreement_versions where id = tests.id('p0a:v1')) = shown,
    'the frozen types differ from the draft scope');
  perform tests.ok('C6005 no draft-only keys', (select not (snapshot ? 'uncovered' or snapshot ? 'controls') from public.agreement_versions where id = tests.id('p0a:v1')),
    'the snapshot holds uncovered or controls');
  perform tests.ok('C6005 exclusion respected', (select snapshot::text not like '%RTU-1%' from public.agreement_versions where id = tests.id('p0a:v1')), 'the snapshot lists RTU-1');
end $$;

-- C6006: a sent agreement's version, an accepted one's, and a draft's older version all refuse, and write nothing.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.p0_site('p0v');
select tests.p0_asset('p0v', 'typeA', 'V-1');
select tests.p0_agr('p0d', 'p0v', 'draft');
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('p0d:v2'), tests.id('orgA'), tests.id('p0d'), 2);
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C6006 sent', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0a:v1'), tests.id('p0s:RTU-2')), 'P0001');
  perform tests.expect_error('C6006 accepted', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0b:v1'), tests.id('p0s:RTU-2')), 'P0001');
  perform tests.expect_error('C6006 older version', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0d:v1'), tests.id('p0v:V-1')), 'P0001');
  perform tests.expect_error('C6006 missing', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('nope'), tests.id('p0v:V-1')), 'P0002');
  perform tests.expect_error('C6006 asset elsewhere', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0d:v2'), tests.id('p0s:RTU-2')), '23514');
  perform tests.ok('C6006 nothing written', (select count(*) from public.agreement_scope_exclusions) = 1, 'a refused call wrote a row');
end $$;

-- C6007: a viewer, another org's owner and an anonymous caller are all refused with 42501 and write nothing.
select tests.act_as('uV');
do $$ begin perform tests.expect_error('C6007 viewer', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0d:v2'), tests.id('p0v:V-1')), '42501'); end $$;
select tests.act_as('uB');
do $$ begin perform tests.expect_error('C6007 other org', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0d:v2'), tests.id('p0v:V-1')), '42501'); end $$;
select tests.act_as_anon();
do $$ begin perform tests.expect_error('C6007 anon', format('select public.set_scope_exclusion(%L, %L, true)', tests.id('p0d:v2'), tests.id('p0v:V-1')), '42501'); end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C6007 nothing written', (select count(*) from public.agreement_scope_exclusions where agreement_version_id = tests.id('p0d:v2')) = 0, 'a refused call wrote a row');
end $$;

-- C6008: revising copies the exclusion to the new version.
select tests.p0_site('p0r');
select tests.p0_asset('p0r', 'typeA', 'R-1');
select tests.p0_asset('p0r', 'typeA', 'R-2');
select tests.p0_agr('p0r', 'p0r', 'changes_requested');
select tests.p0_line('p0r:v1', array['typeA']);
insert into public.agreement_scope_exclusions (org_id, agreement_version_id, asset_id) values (tests.id('orgA'), tests.id('p0r:v1'), tests.id('p0r:R-1'));
select tests.act_as('uE');
select public.apply_agreement_transition(tests.id('p0r'), 'changes_requested', 'draft', 'agreement.revised', '{}');
do $$
declare v2 uuid := tests.latest_version(tests.id('p0r'));
begin
  perform tests.ok('C6008 new version', v2 <> tests.id('p0r:v1'), 'no new version was made');
  perform tests.ok('C6008 copied', (select array_agg(asset_id) from public.agreement_scope_exclusions where agreement_version_id = v2) = array[tests.id('p0r:R-1')],
    'the exclusion was not copied to version 2');
  perform tests.ok('C6008 old kept', (select count(*) from public.agreement_scope_exclusions where agreement_version_id = tests.id('p0r:v1')) = 1, 'version 1 lost its exclusion');
  perform tests.ok('C6008 scope', tests.p0_assets(public.agreement_service_scope(tests.id('p0r')), 'RTU') = 1, 'the revised draft does not leave R-1 out');
end $$;

-- C6003 (inactive units): a unit removed from service is in neither the scope, the controls nor the uncovered list.
select tests.p0_asset('p0s', 'blrA', 'B-2');
select public.set_asset_active(tests.id('p0s:B-2'), false);
do $$
declare doc jsonb := public.agreement_service_scope(tests.id('p0b'));
begin
  perform tests.ok('C6003 inactive not uncovered', not exists (select 1 from jsonb_array_elements(doc -> 'uncovered') u where (u ->> 'assetCount')::int > 1 and u ->> 'code' = 'BOILER'),
    'a deactivated unit is counted as uncovered: ' || (doc -> 'uncovered')::text);
  perform tests.ok('C6003 inactive not controlled', not exists (select 1 from jsonb_array_elements(doc -> 'controls') c where c ->> 'unitNo' = 'B-2'), 'a deactivated unit has a control');
end $$;

-- C6008 (cascade): deleting the version, or the asset, deletes its exclusion rows.
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C6008 asset cascade pre', (select count(*) from public.agreement_scope_exclusions where asset_id = tests.id('p0r:R-1')) = 2, 'expected the exclusion on both versions');
  delete from public.assets where id = tests.id('p0r:R-1');
  perform tests.ok('C6008 asset cascade', (select count(*) from public.agreement_scope_exclusions where asset_id = tests.id('p0r:R-1')) = 0, 'deleting the asset left exclusion rows');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
-- C6021: the backfill's condition (the WHERE of the migration's UPDATE, restated here over fixture orgs) confirms a real
-- company and leaves the demo-shaped one and the one with no phone unconfirmed. The migration itself ran once, at apply time.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.orgs (id, name) values (tests.id('orgC'), 'Acme Heating (test)'), (tests.id('orgD'), 'Demo shaped (test)'), (tests.id('orgE'), 'Phoneless (test)');
insert into public.org_settings (org_id, legal_name, address, phone) values
  (tests.id('orgC'), 'Acme Heating Ltd.', '12 Main St, Surrey, BC V3T 1A1', '604-555-2368'),
  (tests.id('orgD'), 'Kettle Ridge Mechanical Ltd.', '100 Sample Street, Burnaby, BC V5A 0A0', '604-555-0100'),
  (tests.id('orgE'), 'Phoneless Plumbing Ltd.', '9 Side Rd, Surrey, BC V3T 1A1', null);
do $$
declare
  c boolean; d boolean; e boolean;
begin
  select bool_or(s.org_id = tests.id('orgC')), bool_or(s.org_id = tests.id('orgD')), bool_or(s.org_id = tests.id('orgE'))
  into c, d, e
  from public.org_settings s
  where btrim(coalesce(s.legal_name, '')) <> '' and btrim(coalesce(s.address, '')) <> '' and btrim(coalesce(s.phone, '')) <> ''
    and s.legal_name !~* 'kettle ridge' and s.address !~* 'sample street' and s.address !~* '0a0\s*$' and s.phone !~ '555[-. ]?01[0-9][0-9]';
  perform tests.ok('C6021 real org', c, 'a real org would be left unconfirmed');
  perform tests.ok('C6021 demo org', d is distinct from true, 'the demo-shaped org would be confirmed');
  perform tests.ok('C6021 no phone', e is distinct from true, 'an org with no phone would be confirmed');
end $$;

-- C6012: the only code that rewrites a version's snapshot is the freeze function, which runs when a draft leaves draft.
do $$ begin
  perform tests.ok('C6012 single writer',
    (select coalesce(array_agg(p.proname::text order by p.proname), '{}') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosrc ~* 'update\s+public\.agreement_versions[^;]*snapshot')
      = array['freeze_agreement_version'],
    'a function other than freeze_agreement_version updates a snapshot');
  perform tests.ok('C6012 no direct update', not has_table_privilege('authenticated', 'public.agreement_versions', 'update'), 'members can update agreement_versions');
end $$;

-- C6008 (cascade, version side): deleting a version deletes its exclusion rows.
select tests.p0_site('p0c');
select tests.p0_asset('p0c', 'typeA', 'C-1');
select tests.p0_agr('p0c', 'p0c', 'draft');
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('p0c:v2'), tests.id('orgA'), tests.id('p0c'), 2);
insert into public.agreement_scope_exclusions (org_id, agreement_version_id, asset_id) values (tests.id('orgA'), tests.id('p0c:v2'), tests.id('p0c:C-1'));
do $$ begin
  delete from public.agreement_versions where id = tests.id('p0c:v2');
  perform tests.ok('C6008 version cascade', (select count(*) from public.agreement_scope_exclusions where asset_id = tests.id('p0c:C-1')) = 0, 'deleting the version left exclusion rows');
end $$;

-- C6018 (role): only an owner or admin can stamp the company confirmation; an estimator and a viewer change nothing.
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C6018 estimator', format('update public.org_settings set company_confirmed_at = now() where org_id = %L', tests.id('orgA')), 0);
end $$;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_rows('C6018 viewer', format('update public.org_settings set company_confirmed_at = now() where org_id = %L', tests.id('orgA')), 0);
end $$;
select tests.act_as('uA');
do $$ begin
  perform tests.expect_rows('C6018 owner', format('update public.org_settings set company_confirmed_at = now() where org_id = %L', tests.id('orgA')), 1);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
rollback;
select 'p0_launch_fixes: pass' as result;
