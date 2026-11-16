-- agreement-template-switch: C7101-C7105. Run after fixture.sql and the migration 20261116150000_agreement_template_switch.sql, which the
-- recipe replays in the rolled-back transaction (not applied to the hosted project). Fixture: org A owner uA, estimator uE, viewer uV;
-- org B owner uB; siteA. The system agreement template is the one the hosted database seeds (org_id null).

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.ts_site(p_name text) returns void
language sql as $$
  insert into public.sites (id, org_id, customer_id, name) values (tests.id(p_name), tests.id('orgA'), tests.id('custA'), p_name)
$$;
create function tests.ts_agr(p_name text, p_status text, p_pin uuid default null) returns void
language plpgsql as $$
begin
  perform tests.ts_site(p_name || ':site');
  insert into public.agreements (id, org_id, site_id, status) values (tests.id(p_name), tests.id('orgA'), tests.id(p_name || ':site'), p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, template_version_id) values (tests.id(p_name || ':v1'), tests.id('orgA'), tests.id(p_name), 1, p_pin);
end $$;
create function tests.ts_pin(p_name text) returns uuid
language sql security definer as $$
  select template_version_id from public.agreement_versions where id = tests.id(p_name || ':v1')
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Two org templates (made as the owner, the way the Templates screen does) and one of org B, plus the system version.
create table tests.ts_ids (name text primary key, version_id uuid);
grant all on tests.ts_ids to authenticated, anon;
select tests.act_as('uA');
do $$
declare
  sys jsonb;
  r record;
begin
  select tv.body into sys from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
  where t.kind = 'agreement' and t.org_id is null order by tv.version_no desc limit 1;
  select * into r from public.save_agreement_template(null, jsonb_set(sys, '{name}', '"Switch A"'));
  insert into tests.ts_ids select 'A', tv.id from public.document_template_versions tv where tv.template_id = r.template_id and tv.version_no = r.version_no;
  select * into r from public.save_agreement_template(null, jsonb_set(sys, '{name}', '"Switch A2"'));
  insert into tests.ts_ids select 'A2', tv.id from public.document_template_versions tv where tv.template_id = r.template_id and tv.version_no = r.version_no;
  insert into tests.ts_ids select 'SYS', tv.id from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
    where t.kind = 'agreement' and t.org_id is null order by tv.version_no desc limit 1;
end $$;
select tests.act_as('uB');
do $$
declare
  sys jsonb;
  r record;
begin
  select tv.body into sys from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
  where t.kind = 'agreement' and t.org_id is null order by tv.version_no desc limit 1;
  select * into r from public.save_agreement_template(null, jsonb_set(sys, '{name}', '"Switch B"'));
  insert into tests.ts_ids select 'B', tv.id from public.document_template_versions tv where tv.template_id = r.template_id and tv.version_no = r.version_no;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
select tests.ts_agr('tsd', 'draft');
select tests.ts_agr('tss', 'sent', (select version_id from tests.ts_ids where name = 'SYS'));
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('tsd:v2'), tests.id('orgA'), tests.id('tsd'), 2);
select tests.ts_agr('tso', 'draft');

-- C7101: an estimator pins the current version of a draft to an org template, then to the system one; version 1 keeps its pin.
select tests.act_as('uE');
select public.set_agreement_template(tests.id('tsd'), (select version_id from tests.ts_ids where name = 'A'));
do $$ begin
  perform tests.ok('C7101 pinned', (select template_version_id from public.agreement_versions where id = tests.id('tsd:v2')) = (select version_id from tests.ts_ids where name = 'A'), 'the current version was not pinned');
  perform tests.ok('C7101 older version untouched', (select template_version_id from public.agreement_versions where id = tests.id('tsd:v1')) is null, 'version 1 was changed');
end $$;
select public.set_agreement_template(tests.id('tsd'), (select version_id from tests.ts_ids where name = 'SYS'));
do $$ begin
  perform tests.ok('C7101 system', (select template_version_id from public.agreement_versions where id = tests.id('tsd:v2')) = (select version_id from tests.ts_ids where name = 'SYS'), 'the system template was not pinned');
end $$;

-- C7102: choosing the template it already has is allowed and changes nothing.
select public.set_agreement_template(tests.id('tsd'), (select version_id from tests.ts_ids where name = 'SYS'));
do $$ begin
  perform tests.ok('C7102 same', (select template_version_id from public.agreement_versions where id = tests.id('tsd:v2')) = (select version_id from tests.ts_ids where name = 'SYS'), 'the same pin changed');
end $$;

-- C7103: a sent agreement refuses (P0001) and keeps its pin; so does an unknown agreement (P0002).
do $$ begin
  perform tests.expect_error('C7103 sent', format('select public.set_agreement_template(%L, %L)', tests.id('tss'), (select version_id from tests.ts_ids where name = 'A')), 'P0001');
  perform tests.ok('C7103 sent kept', tests.ts_pin('tss') = (select version_id from tests.ts_ids where name = 'SYS'), 'a sent agreement was re-pinned');
  perform tests.expect_error('C7103 missing', format('select public.set_agreement_template(%L, %L)', tests.id('nope'), (select version_id from tests.ts_ids where name = 'A')), 'P0002');
end $$;

-- C7104: a template of another org and an id that is no agreement template are refused with 22023; nothing is pinned.
do $$ begin
  perform tests.expect_error('C7104 other org template', format('select public.set_agreement_template(%L, %L)', tests.id('tso'), (select version_id from tests.ts_ids where name = 'B')), '22023');
  perform tests.expect_error('C7104 not a template', format('select public.set_agreement_template(%L, %L)', tests.id('tso'), tests.id('nope')), '22023');
  perform tests.ok('C7104 nothing pinned', tests.ts_pin('tso') is null, 'a refused call pinned a template');
end $$;

-- C7105: a viewer, another org's owner and an anonymous caller are refused with 42501 and pin nothing.
select tests.act_as('uV');
do $$ begin perform tests.expect_error('C7105 viewer', format('select public.set_agreement_template(%L, %L)', tests.id('tso'), (select version_id from tests.ts_ids where name = 'A')), '42501'); end $$;
select tests.act_as('uB');
do $$ begin perform tests.expect_error('C7105 other org', format('select public.set_agreement_template(%L, %L)', tests.id('tso'), (select version_id from tests.ts_ids where name = 'B')), '42501'); end $$;
select tests.act_as_anon();
do $$ begin perform tests.expect_error('C7105 anon', format('select public.set_agreement_template(%L, %L)', tests.id('tso'), (select version_id from tests.ts_ids where name = 'A')), '42501'); end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C7105 nothing pinned', tests.ts_pin('tso') is null, 'a refused caller pinned a template');
end $$;

rollback;
select 'agreement_template_switch: pass' as result;
