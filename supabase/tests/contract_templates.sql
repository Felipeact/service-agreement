-- contract-templates, database side: C5200-C5210 (.specs/features/contract-templates/checks.md).
-- Run after fixture.sql (npm run test:db contract_templates). The migration 20261112230000_contract_templates.sql was applied to
-- the hosted project by the owner on 2026-11-12, so this file no longer replays it and tests the hosted objects. Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB. conA and conB are fixture
-- contracts inserted without naming a template version. Expected values come from the plan, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

-- An accepted agreement of an org (tests.rn_agreement), made into a contract by the given member; returns the contract id.
create function tests.ct_contract(p_name text, p_org text default 'A', p_user text default 'uE') returns uuid
language plpgsql as $$
declare
  v_agr uuid;
  v_contract uuid;
begin
  reset role;
  v_agr := tests.rn_agreement(p_name, p_org);
  perform tests.act_as(p_user);
  v_contract := public.create_contract(v_agr);
  reset role;
  return v_contract;
end $$;

create function tests.ct_template_of(p_contract uuid) returns uuid
language sql as $$ select template_version_id from public.contracts where id = p_contract $$;

grant execute on all functions in schema tests to anon, authenticated;

-- C5200: one system contract template, whose version 1 is a heading and the six sentences, readable by both orgs.
do $$
declare
  b jsonb;
begin
  perform tests.ok('C5200 one system contract template',
    (select count(*) from public.document_templates where org_id is null and kind = 'contract') = 1, 'not exactly one system contract template');
  select v.body into b from public.document_template_versions v join public.document_templates t on t.id = v.template_id
  where t.org_id is null and t.kind = 'contract' and v.version_no = 1;
  perform tests.ok('C5200 schema', b ->> 'schema' = '1', 'schema is ' || coalesce(b ->> 'schema', 'null'));
  perform tests.ok('C5200 heading', b #>> '{blocks,0,type}' = 'heading' and b #>> '{blocks,0,text}' = 'Terms', 'first block is ' || coalesce((b #> '{blocks,0}')::text, 'null'));
  perform tests.ok('C5200 six clauses', jsonb_array_length(b -> 'blocks') = 7
    and (select count(*) from jsonb_array_elements(b -> 'blocks') e where e ->> 'type' = 'clause') = 6, 'blocks are ' || (b -> 'blocks')::text);
  perform tests.ok('C5200 first sentence', b #>> '{blocks,1,text}' = 'Invoices are payable within {{terms.paymentDays}}.', 'text is ' || coalesce(b #>> '{blocks,1,text}', 'null'));
  perform tests.ok('C5200 last sentence', b #>> '{blocks,6,text}' like 'This contract renews for successive {{term.label}} terms%{{terms.renewalNoticeDays}} before the end date.',
    'text is ' || coalesce(b #>> '{blocks,6,text}', 'null'));
end $$;
select tests.act_as('uA');
do $$
begin
  perform tests.ok('C5200 org A reads it', (select count(*) from public.document_template_versions where org_id is null and template_id = '00000000-0000-4000-8000-00000000c001') = 1, 'org A member cannot read the system version');
end $$;
select tests.act_as('uB');
do $$
begin
  perform tests.ok('C5200 org B reads it', (select count(*) from public.document_template_versions where org_id is null and template_id = '00000000-0000-4000-8000-00000000c001') = 1, 'org B member cannot read the system version');
end $$;
reset role;

-- C5206 first: the fixture contracts were inserted without naming a version and point at the system version 1.
do $$
declare sys uuid := (select v.id from public.document_template_versions v where v.org_id is null and v.template_id = '00000000-0000-4000-8000-00000000c001' and v.version_no = 1);
begin
  perform tests.ok('C5206 none null', (select count(*) from public.contracts where template_version_id is null) = 0, 'a contract has no version');
  perform tests.ok('C5206 default', (select bool_and(template_version_id = sys) from public.contracts), 'a fixture contract does not point at the system version 1');
  perform tests.expect_error('C5206 explicit null',
    format('insert into public.contracts (org_id, agreement_version_id, template_version_id) values (%L, %L, null)', tests.id('orgA'), tests.id('ver2A')), '23502');
  -- C5209: a version that does not exist.
  perform tests.expect_error('C5209 unknown version',
    format('insert into public.contracts (org_id, agreement_version_id, template_version_id) values (%L, %L, %L)', tests.id('orgA'), tests.id('ver2A'), tests.id('nope')), '23503');
end $$;

-- C5201: an org with no template of its own gets the system version.
select tests.ct_contract('ct1');
do $$
begin
  perform tests.ok('C5201 system version', tests.ct_template_of((select id from public.contracts c where c.agreement_version_id = tests.id('ct1:v1')))
    = (select v.id from public.document_template_versions v where v.org_id is null and v.template_id = '00000000-0000-4000-8000-00000000c001' and v.version_no = 1), 'the contract does not carry the system version');
end $$;

-- C5202: an org with its own contract template gets that template's latest version, not the system one.
insert into public.document_templates (id, org_id, kind) values (tests.id('tplA'), tests.id('orgA'), 'contract');
insert into public.document_template_versions (id, template_id, org_id, version_no, body)
values (tests.id('tplA:v1'), tests.id('tplA'), tests.id('orgA'), 1, '{"schema":1,"blocks":[{"type":"paragraph","text":"Org A wording v1"}]}');
select tests.ct_contract('ct2');
do $$
begin
  perform tests.ok('C5202 own version', tests.ct_template_of((select id from public.contracts c where c.agreement_version_id = tests.id('ct2:v1'))) = tests.id('tplA:v1'),
    'the contract does not carry the org template');
end $$;

-- C5203: a newer version later does not move the contract made before it.
insert into public.document_template_versions (id, template_id, org_id, version_no, body)
values (tests.id('tplA:v2'), tests.id('tplA'), tests.id('orgA'), 2, '{"schema":1,"blocks":[{"type":"paragraph","text":"Org A wording v2"}]}');
do $$
begin
  perform tests.ok('C5203 unchanged', tests.ct_template_of((select id from public.contracts c where c.agreement_version_id = tests.id('ct2:v1'))) = tests.id('tplA:v1'),
    'an older contract moved to a newer version');
end $$;
select tests.ct_contract('ct3');
do $$
begin
  perform tests.ok('C5203 next contract', tests.ct_template_of((select id from public.contracts c where c.agreement_version_id = tests.id('ct3:v1'))) = tests.id('tplA:v2'),
    'a new contract did not take the latest version');
end $$;

-- C5210: the automation path (no signed-in user) records the system version for an org without a template.
do $$
declare
  v_agr uuid;
  v_contract uuid;
begin
  reset role;
  v_agr := tests.rn_agreement('ct4', 'B');
  v_contract := private.create_contract_for_system(v_agr);
  perform tests.ok('C5210 system path', tests.ct_template_of(v_contract) = (select v.id from public.document_template_versions v where v.org_id is null and v.template_id = '00000000-0000-4000-8000-00000000c001' and v.version_no = 1),
    'the automation path did not record the system version');
end $$;

-- C5204: a version is never updated or deleted, by the table owner or by a member.
select tests.expect_error('C5204 owner update', format('update public.document_template_versions set body = ''{"schema":1,"blocks":[]}'' where id = %L', tests.id('tplA:v1')), '55000');
select tests.expect_error('C5204 owner delete', format('delete from public.document_template_versions where id = %L', tests.id('tplA:v1')), '55000');
select tests.expect_error('C5204 system delete', 'delete from public.document_template_versions where org_id is null', '55000');
select tests.act_as('uA');
select tests.expect_error('C5204 member update', format('update public.document_template_versions set body = ''{"schema":1,"blocks":[]}'' where id = %L', tests.id('tplA:v1')), '42501');
select tests.expect_error('C5204 member delete', format('delete from public.document_template_versions where id = %L', tests.id('tplA:v1')), '42501');
reset role;

-- C5205: a member cannot insert a template or a version.
select tests.act_as('uA');
select tests.expect_error('C5205 template', format('insert into public.document_templates (org_id, kind) values (%L, ''agreement'')', tests.id('orgA')), '42501');
select tests.expect_error('C5205 version', format('insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, %L, 9, ''{}'')', tests.id('tplA'), tests.id('orgA')), '42501');
reset role;

-- C5207: org B sees the system template and none of org A's own.
select tests.act_as('uB');
do $$
begin
  perform tests.ok('C5207 no other org template', (select count(*) from public.document_templates where org_id = tests.id('orgA')) = 0, 'org B sees org A''s template');
  perform tests.ok('C5207 no other org version', (select count(*) from public.document_template_versions where org_id = tests.id('orgA')) = 0, 'org B sees org A''s version');
  perform tests.ok('C5207 system visible', (select count(*) from public.document_templates where org_id is null) >= 1, 'org B cannot see the system template');
end $$;
reset role;

-- C5208: uniqueness - one system template per kind, one template per org per kind, one version_no per template.
select tests.expect_error('C5208 second system template', 'insert into public.document_templates (org_id, kind) values (null, ''contract'')', '23505');
select tests.expect_error('C5208 second org template', format('insert into public.document_templates (org_id, kind) values (%L, ''contract'')', tests.id('orgA')), '23505');
select tests.expect_error('C5208 repeated version_no', format('insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, %L, 2, ''{}'')', tests.id('tplA'), tests.id('orgA')), '23505');
do $$
begin
  perform tests.ok('C5208 another kind is allowed', (select count(*) from public.document_templates where org_id is null and kind = 'agreement') = 1
    and exists (select 1 from (select 1 from public.document_templates limit 1) x), 'the system agreement template is missing');
  insert into public.document_templates (org_id, kind) values (tests.id('orgA'), 'agreement');
end $$;

-- C5205: anon reads nothing and writes nothing.
select tests.act_as_anon();
select tests.expect_error('C5205 anon read versions', 'select count(*) from public.document_template_versions', '42501');
select tests.expect_error('C5205 anon read templates', 'select count(*) from public.document_templates', '42501');
select tests.expect_error('C5205 anon insert', 'insert into public.document_templates (org_id, kind) values (null, ''agreement'')', '42501');
reset role;

-- C5204: a version goes with the org that owns it, and a system version stays.
insert into public.document_templates (id, org_id, kind) values (tests.id('tplB'), tests.id('orgB'), 'contract');
insert into public.document_template_versions (id, template_id, org_id, version_no, body)
values (tests.id('tplB:v1'), tests.id('tplB'), tests.id('orgB'), 1, '{"schema":1,"blocks":[]}');
delete from public.orgs where id = tests.id('orgB');
do $$
begin
  perform tests.ok('C5204 org delete takes its versions', not exists (select 1 from public.document_template_versions where org_id = tests.id('orgB')), 'a version outlived its org');
  perform tests.ok('C5204 org delete takes its template', not exists (select 1 from public.document_templates where org_id = tests.id('orgB')), 'a template outlived its org');
  perform tests.ok('C5204 system version stays', (select count(*) from public.document_template_versions where org_id is null and template_id = '00000000-0000-4000-8000-00000000c001') = 1, 'the system version was deleted');
end $$;

reset role;
rollback;
select 'contract_templates: pass' as result;
