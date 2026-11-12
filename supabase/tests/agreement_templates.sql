-- agreement-templates, database side: C5300-C5318 and the SQL half of C5330 (.specs/features/agreement-templates/checks.md).
-- Run after fixture.sql and the migration 20261112240000_agreement_templates.sql (npm run test:db agreement_templates replays
-- both, rolled back, so the hosted project needs no change until the owner applies it).
-- Fixture: org A owner uA, estimator uE, viewer uV, admin uAd (added here); org B owner uB; uX has no membership. Expected
-- values come from the checks, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- A valid body; p_override replaces whole top-level keys.
create function tests.at_body(p_override jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('schema', 1, 'name', 'Template', 'description', '', 'intro', '[]'::jsonb, 'footer', '[]'::jsonb,
                            'sections', jsonb_build_object('schedule', true, 'scope', true),
                            'preset', jsonb_build_object('termMonths', null, 'lines', '[]'::jsonb)) || p_override
$$;

create function tests.at_line(p_description text, p_months jsonb, p_codes jsonb, p_cost jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('description', p_description, 'visitMonths', p_months, 'assetTypeCodes', p_codes, 'costPerVisitCents', p_cost)
$$;

-- A body with a name and a preset of the given lines and term.
create function tests.at_preset(p_name text, p_term jsonb, p_lines jsonb) returns jsonb
language sql as $$
  select tests.at_body(jsonb_build_object('name', p_name, 'preset', jsonb_build_object('termMonths', p_term, 'lines', p_lines)))
$$;

-- Saves as the user and returns the template id.
create function tests.at_save(p_user text, p_template uuid, p_body jsonb) returns uuid
language plpgsql as $$
declare r record;
begin
  perform tests.act_as(p_user);
  select * into r from public.save_agreement_template(p_template, p_body);
  reset role;
  return r.template_id;
end $$;

-- The id of version p_no of a template, read as the table owner.
create function tests.at_vid(p_template uuid, p_no integer) returns uuid
language sql security definer as $$
  select id from public.document_template_versions where template_id = p_template and version_no = p_no
$$;

create function tests.at_site(p_name text, p_org text default 'A') returns uuid
language sql as $$
  insert into public.sites (id, org_id, customer_id, name) values (tests.id(p_name), tests.id('org' || p_org), tests.id('cust' || p_org), p_name)
  returning id
$$;

-- An agreement <name> in p_status on its own site, made as the table owner: version 1 with a term start, the pin and one line.
create function tests.at_agr(p_name text, p_status text, p_pin uuid default null, p_org text default 'A') returns uuid
language plpgsql as $$
begin
  -- No signed-in user, so the line triggers stand aside.
  perform set_config('request.jwt.claims', '', true);
  perform tests.at_site(p_name || ':site', p_org);
  insert into public.agreements (id, org_id, site_id, status, number)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), p_status, p_name);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start, template_version_id)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1, '2027-01-01', p_pin);
  insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
  values (tests.id(p_name || ':l1'), tests.id('org' || p_org), tests.id(p_name || ':v1'), 0, 'HVAC maintenance', '{3,6,9,12}', 4, 25000);
  return tests.id(p_name);
end $$;

-- A draft made by the estimator through create_agreement (so the pin and the preset are the function's), then given a term
-- start and a line as the table owner so it can be sent.
create function tests.at_draft(p_name text, p_version uuid default null) returns uuid
language plpgsql as $$
declare v_agr uuid;
begin
  perform tests.at_site(p_name || ':site');
  perform tests.act_as('uE');
  v_agr := public.create_agreement(tests.id(p_name || ':site'), p_version);
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.agreement_versions set term_start = '2027-01-01' where agreement_id = v_agr and version_no = 1;
  if not exists (select 1 from public.service_lines l join public.agreement_versions v on v.id = l.agreement_version_id where v.agreement_id = v_agr) then
    insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
    values (tests.id('orgA'), tests.latest_version(v_agr), 0, 'HVAC maintenance', '{3,6,9,12}', 4, 25000);
  end if;
  return v_agr;
end $$;

create function tests.at_hash(p_name text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_name, 'UTF8')), 'hex') $$;

create function tests.at_pin(p_agreement uuid, p_no integer default 1) returns uuid
language sql security definer as $$
  select template_version_id from public.agreement_versions where agreement_id = p_agreement and version_no = p_no
$$;

create function tests.at_send(p_agreement uuid, p_name text) returns void
language plpgsql as $$
begin
  perform tests.act_as('uE');
  perform public.send_agreement(p_agreement, tests.at_hash(p_name), 'agreement.sent', '{"from": "draft", "to": "sent"}');
  reset role;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- C5300: one system agreement template, version 1 as the plan says, read by a member of each org.
do $$
declare
  b jsonb;
begin
  perform tests.ok('C5300 one system agreement template',
    (select count(*) from public.document_templates where org_id is null and kind = 'agreement') = 1, 'not exactly one');
  select v.body into b from public.document_template_versions v join public.document_templates t on t.id = v.template_id
  where t.org_id is null and t.kind = 'agreement' and v.version_no = 1;
  perform tests.ok('C5300 body', b = '{"schema":1,"name":"Standard agreement","description":"","intro":[],"footer":[],"sections":{"schedule":true,"scope":true},"preset":{"termMonths":null,"lines":[]}}'::jsonb,
    'body is ' || coalesce(b::text, 'null'));
end $$;
select tests.act_as('uA');
do $$
begin
  perform tests.ok('C5300 org A reads it', (select count(*) from public.document_template_versions v join public.document_templates t on t.id = v.template_id
    where v.org_id is null and t.kind = 'agreement') = 1, 'org A member cannot read the system agreement version');
end $$;
select tests.act_as('uB');
do $$
begin
  perform tests.ok('C5300 org B reads it', (select count(*) from public.document_template_versions v join public.document_templates t on t.id = v.template_id
    where v.org_id is null and t.kind = 'agreement') = 1, 'org B member cannot read the system agreement version');
end $$;
reset role;

-- C5301: an owner saves a new template (version 1), an admin adds version 2, version 1 is unchanged.
create table tests.at_ids (k text primary key, v uuid);
grant all on tests.at_ids to anon, authenticated;
create table tests.at_text (k text primary key, v text);
grant all on tests.at_text to anon, authenticated;
do $$
declare
  t uuid;
  r record;
  v1_before text;
begin
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(null, tests.at_body('{"name":"Quarterly HVAC"}'));
  reset role;
  t := r.template_id;
  perform tests.ok('C5301 returns version 1', r.version_no = 1 and t is not null, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('C5301 one agreement template of the org',
    (select count(*) from public.document_templates where id = t and org_id = tests.id('orgA') and kind = 'agreement') = 1, 'no template row');
  select body::text into v1_before from public.document_template_versions where template_id = t and version_no = 1;
  perform tests.act_as('uAd');
  select * into r from public.save_agreement_template(t, tests.at_body('{"name":"Quarterly HVAC","description":"v2"}'));
  reset role;
  perform tests.ok('C5301 admin adds version 2', r.template_id = t and r.version_no = 2, 'returned ' || r.version_no);
  perform tests.ok('C5301 two versions', (select count(*) from public.document_template_versions where template_id = t) = 2, 'not two versions');
  perform tests.ok('C5301 version 1 byte for byte', (select body::text from public.document_template_versions where template_id = t and version_no = 1) = v1_before,
    'version 1 changed');
  perform tests.ok('C5301 version 2 body', (select body ->> 'description' from public.document_template_versions where template_id = t and version_no = 2) = 'v2', 'v2 body');
  insert into tests.at_ids values ('tplQ', t);
  -- an id of another org: P0002 for a member of a different org.
  perform tests.act_as('uB');
  perform tests.expect_error('C5301 other org id', format('select * from public.save_agreement_template(%L, %L::jsonb)', t, tests.at_body()::text), 'P0002');
  reset role;
end $$;

-- C5302: estimator, viewer, non-member and anon write nothing.
do $$
declare
  t uuid := (select v from tests.at_ids where k = 'tplQ');
  n_t bigint := (select count(*) from public.document_templates);
  n_v bigint := (select count(*) from public.document_template_versions);
  u text;
begin
  foreach u in array array['uE', 'uV', 'uX'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C5302 save new ' || u, format('select * from public.save_agreement_template(null, %L::jsonb)', tests.at_body('{"name":"Nope"}')::text), '42501');
    perform tests.expect_error('C5302 save version ' || u, format('select * from public.save_agreement_template(%L, %L::jsonb)', t, tests.at_body('{"name":"Quarterly HVAC"}')::text), '42501');
    perform tests.expect_error('C5302 archive ' || u, format('select public.archive_agreement_template(%L)', t), '42501');
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.expect_error('C5302 anon save', format('select * from public.save_agreement_template(null, %L::jsonb)', tests.at_body()::text), '42501');
  perform tests.expect_error('C5302 anon archive', format('select public.archive_agreement_template(%L)', t), '42501');
  reset role;
  perform tests.ok('C5302 nothing written', (select count(*) from public.document_templates) = n_t and (select count(*) from public.document_template_versions) = n_v, 'a row was written');
  perform tests.ok('C5302 not archived', (select archived_at from public.document_templates where id = t) is null, 'archived');
end $$;

-- C5303: each invalid body raises 22023 and writes nothing.
do $$
declare
  c record;
  n_v bigint := (select count(*) from public.document_template_versions);
  n_t bigint := (select count(*) from public.document_templates);
  blocks30 jsonb := (select jsonb_agg(jsonb_build_object('type', 'paragraph', 'text', repeat('x', 2000))) from generate_series(1, 30));
  lines21 jsonb := (select jsonb_agg(tests.at_line('L', '[3]', '[]', 'null')) from generate_series(1, 21));
begin
  perform tests.act_as('uA');
  for c in
    select * from (values
      ('schema 2', tests.at_body('{"schema":2}')),
      ('unknown key', tests.at_body('{"extra":1}')),
      ('over 64 KB', tests.at_body(jsonb_build_object('name', 'Big', 'intro', blocks30, 'footer', blocks30))),
      ('21 lines', tests.at_preset('Lines', 'null', lines21)),
      ('31 blocks', tests.at_body(jsonb_build_object('intro', (select jsonb_agg(jsonb_build_object('type', 'paragraph', 'text', 'x')) from generate_series(1, 31))))),
      ('text of 2001', tests.at_body(jsonb_build_object('intro', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', repeat('x', 2001)))))),
      ('empty name', tests.at_body('{"name":""}')),
      ('array body', '[]'::jsonb),
      ('string body', '"x"'::jsonb)
    ) as t(label, body)
  loop
    perform tests.expect_error('C5303 ' || c.label, format('select * from public.save_agreement_template(null, %L::jsonb)', c.body::text), '22023');
  end loop;
  perform tests.ok('C5303 nothing written', (select count(*) from public.document_template_versions) = n_v and (select count(*) from public.document_templates) = n_t, 'a row was written');
  perform tests.expect_error('C5303 json null body', 'select * from public.save_agreement_template(null, null)', '22023');
  reset role;
end $$;

-- C5304: names are unique among non-archived templates of an org, ignoring case.
do $$
declare
  t uuid := (select v from tests.at_ids where k = 'tplQ');
  t2 uuid;
begin
  perform tests.act_as('uA');
  perform tests.expect_error('C5304 same name', format('select * from public.save_agreement_template(null, %L::jsonb)', tests.at_body('{"name":"Quarterly HVAC"}')::text), '23505');
  perform tests.expect_error('C5304 other case', format('select * from public.save_agreement_template(null, %L::jsonb)', tests.at_body('{"name":"QUARTERLY hvac"}')::text), '23505');
  reset role;
  t2 := tests.at_save('uA', t, tests.at_body('{"name":"Quarterly HVAC","description":"v3"}'));
  perform tests.ok('C5304 own name new version', t2 = t and (select count(*) from public.document_template_versions where template_id = t) = 3, 'new version under its own name failed');
  -- Another template renamed into a taken name is refused; archiving frees the name.
  t2 := tests.at_save('uA', null, tests.at_body('{"name":"Annual boiler"}'));
  insert into tests.at_ids values ('tplB', t2);
  perform tests.act_as('uA');
  perform tests.expect_error('C5304 rename into taken', format('select * from public.save_agreement_template(%L, %L::jsonb)', t2, tests.at_body('{"name":"quarterly hvac"}')::text), '23505');
  perform public.archive_agreement_template(t2);
  reset role;
  t2 := tests.at_save('uA', null, tests.at_body('{"name":"annual BOILER"}'));
  perform tests.ok('C5304 archived name reused', t2 is not null, 'the name of an archived template was refused');
  insert into tests.at_ids values ('tplB2', t2);
end $$;

-- C5311: several agreement templates per org, one contract template per org.
do $$
begin
  perform tests.ok('C5311 three agreement templates', (select count(*) from public.document_templates where org_id = tests.id('orgA') and kind = 'agreement') >= 3,
    'fewer than three');
  insert into public.document_templates (id, org_id, kind) values (tests.id('ctA'), tests.id('orgA'), 'contract');
  perform tests.expect_error('C5311 second contract template', format('insert into public.document_templates (org_id, kind) values (%L, ''contract'')', tests.id('orgA')), '23505');
  perform tests.expect_error('C5311 second system agreement template', 'insert into public.document_templates (org_id, kind) values (null, ''agreement'')', '23505');
  insert into public.document_template_versions (id, template_id, org_id, version_no, body)
  values (tests.id('ctA:v1'), tests.id('ctA'), tests.id('orgA'), 1, '{"schema":1,"blocks":[]}');
end $$;

-- C5305: create_agreement with an org's own version and with the system version; a viewer is refused.
do $$
declare
  own uuid := tests.at_vid((select v from tests.at_ids where k = 'tplQ'), 3);
  sys uuid := '00000000-0000-4000-8000-00000000c102';
  a1 uuid;
  a2 uuid;
  n bigint := (select count(*) from public.agreements where org_id = tests.id('orgA'));
begin
  a1 := tests.at_draft('t5305a', own);
  a2 := tests.at_draft('t5305b', sys);
  perform tests.ok('C5305 own version pinned', tests.at_pin(a1) = own, 'pin is ' || coalesce(tests.at_pin(a1)::text, 'null'));
  perform tests.ok('C5305 system version pinned', tests.at_pin(a2) = sys, 'pin is ' || coalesce(tests.at_pin(a2)::text, 'null'));
  perform tests.at_site('t5305v:site');
  n := (select count(*) from public.agreements where org_id = tests.id('orgA'));
  perform tests.act_as('uV');
  perform tests.expect_error('C5305 viewer', format('select public.create_agreement(%L, %L)', tests.id('t5305v:site'), own), '42501');
  reset role;
  perform tests.ok('C5305 viewer created nothing', (select count(*) from public.agreements where org_id = tests.id('orgA')) = n, 'an agreement was created');
end $$;

-- C5306: a version of another org, of a contract template and an unknown id are refused with 22023, creating nothing.
do $$
declare
  tb uuid := tests.at_save('uB', null, tests.at_body('{"name":"Org B template"}'));
  vb uuid := tests.at_vid(tb, 1);
  n_a bigint;
  n_v bigint;
  v uuid;
begin
  perform tests.at_site('t5306:site');
  n_a := (select count(*) from public.agreements);
  n_v := (select count(*) from public.agreement_versions);
  perform tests.act_as('uE');
  foreach v in array array[vb, tests.id('ctA:v1'), tests.id('no such version')] loop
    perform tests.expect_error('C5306 ' || v, format('select public.create_agreement(%L, %L)', tests.id('t5306:site'), v), '22023');
  end loop;
  reset role;
  perform tests.ok('C5306 nothing created', (select count(*) from public.agreements) = n_a and (select count(*) from public.agreement_versions) = n_v, 'a row was created');
end $$;

-- C5307: no version leaves the pin null; a missing site is P0002; a site with a live agreement is 23505.
do $$
declare
  a uuid;
begin
  a := tests.at_draft('t5307');
  perform tests.ok('C5307 null pin', tests.at_pin(a) is null, 'pin is ' || coalesce(tests.at_pin(a)::text, 'null'));
  perform tests.act_as('uE');
  perform tests.expect_error('C5307 missing site', format('select public.create_agreement(%L)', tests.id('no such site')), 'P0002');
  perform tests.expect_error('C5307 live agreement', format('select public.create_agreement(%L)', tests.id('siteA')), '23505');
  perform tests.expect_error('C5307 live agreement with a version', format('select public.create_agreement(%L, %L)', tests.id('siteA'), '00000000-0000-4000-8000-00000000c102'::uuid), '23505');
  reset role;
end $$;

-- C5308: send pins the system version on an unpinned draft and leaves a pinned one.
do $$
declare
  own uuid := tests.at_vid((select v from tests.at_ids where k = 'tplQ'), 1);
  a1 uuid;
  a2 uuid;
begin
  a1 := tests.at_draft('t5308a');
  a2 := tests.at_draft('t5308b', own);
  perform tests.at_send(a1, 't5308a');
  perform tests.at_send(a2, 't5308b');
  perform tests.ok('C5308 null pin becomes the system latest', tests.at_pin(a1) = (select tv.id from public.document_template_versions tv
    join public.document_templates t on t.id = tv.template_id where t.kind = 'agreement' and t.org_id is null order by tv.version_no desc limit 1),
    'pin is ' || coalesce(tests.at_pin(a1)::text, 'null'));
  perform tests.ok('C5308 pinned draft keeps its version', tests.at_pin(a2) = own, 'pin is ' || coalesce(tests.at_pin(a2)::text, 'null'));
  -- A newer version saved afterwards moves nothing.
  perform tests.at_save('uA', (select v from tests.at_ids where k = 'tplQ'), tests.at_body('{"name":"Quarterly HVAC","description":"v4"}'));
  perform tests.ok('C5308 later version moves nothing', tests.at_pin(a2) = own, 'pin moved');
  perform tests.ok('C5308 sent', (select status from public.agreements where id = a2) = 'sent', 'not sent');
end $$;

-- C5309: a revise copies the pin, pinned or null.
do $$
declare
  own uuid := tests.at_vid((select v from tests.at_ids where k = 'tplQ'), 2);
  a1 uuid := tests.at_agr('t5309a', 'changes_requested', own);
  a2 uuid := tests.at_agr('t5309b', 'changes_requested', null);
begin
  perform tests.act_as('uE');
  perform public.apply_agreement_transition(a1, 'changes_requested', 'draft', 'agreement.revised', '{"from":"changes_requested","to":"draft","versionNo":2}');
  perform public.apply_agreement_transition(a2, 'changes_requested', 'draft', 'agreement.revised', '{"from":"changes_requested","to":"draft","versionNo":2}');
  reset role;
  perform tests.ok('C5309 pinned copied', tests.at_pin(a1, 2) = own, 'pin is ' || coalesce(tests.at_pin(a1, 2)::text, 'null'));
  perform tests.ok('C5309 null copied', (select count(*) from public.agreement_versions where agreement_id = a2 and version_no = 2) = 1 and tests.at_pin(a2, 2) is null,
    'null pin did not stay null');
end $$;

-- C5310: the pin of a sent version cannot change; a draft's can.
do $$
declare
  own uuid := tests.at_vid((select v from tests.at_ids where k = 'tplQ'), 1);
  sys uuid := '00000000-0000-4000-8000-00000000c102';
  s uuid := tests.at_agr('t5310s', 'sent', own);
  d uuid := tests.at_agr('t5310d', 'draft', own);
begin
  perform tests.expect_hint('C5310 owner of the table', format('update public.agreement_versions set template_version_id = %L where agreement_id = %L', sys, s), '55000', 'template_pin_frozen');
  perform tests.expect_hint('C5310 owner of the table to null', format('update public.agreement_versions set template_version_id = null where agreement_id = %L', s), '55000', 'template_pin_frozen');
  perform tests.act_as('uA');
  perform tests.expect_error('C5310 owner member', format('update public.agreement_versions set template_version_id = %L where agreement_id = %L', sys, s), '42501');
  reset role;
  perform tests.ok('C5310 unchanged', tests.at_pin(s) = own, 'pin changed');
  update public.agreement_versions set template_version_id = sys where agreement_id = d;
  perform tests.ok('C5310 draft not blocked', tests.at_pin(d) = sys, 'a draft pin could not change');
end $$;

-- C5312: archive sets archived_at once, keeps versions and the pinned agreement, and a second call changes nothing.
do $$
declare
  t uuid := (select v from tests.at_ids where k = 'tplQ');
  a uuid := tests.at_agr('t5312', 'sent', tests.at_vid((select v from tests.at_ids where k = 'tplQ'), 1));
  n_v bigint := (select count(*) from public.document_template_versions where template_id = t);
begin
  perform tests.act_as('uAd');
  perform public.archive_agreement_template(t);
  reset role;
  perform tests.ok('C5312 archived', (select archived_at from public.document_templates where id = t) is not null, 'archived_at not set');
  perform tests.ok('C5312 versions stay', (select count(*) from public.document_template_versions where template_id = t) = n_v, 'versions changed');
  perform tests.ok('C5312 pin unchanged', tests.at_pin(a) = tests.at_vid(t, 1), 'pin changed');
  update public.document_templates set archived_at = '2020-01-01T00:00:00Z' where id = t;
  perform tests.act_as('uA');
  perform public.archive_agreement_template(t);
  reset role;
  perform tests.ok('C5312 second call changes nothing', (select archived_at from public.document_templates where id = t) = '2020-01-01T00:00:00Z', 'archived_at moved');
  perform tests.act_as('uB');
  perform tests.expect_error('C5312 other org', format('select public.archive_agreement_template(%L)', t), 'P0002');
  perform tests.expect_error('C5312 unknown', format('select public.archive_agreement_template(%L)', tests.id('no such template')), 'P0002');
  perform tests.expect_error('C5312 system template', 'select public.archive_agreement_template(''00000000-0000-4000-8000-00000000c002'')', 'P0002');
  reset role;
end $$;

-- C5313: isolation and no direct writes.
select tests.act_as('uB');
do $$
begin
  perform tests.ok('C5313 org B reads no org A template', (select count(*) from public.document_templates where org_id = tests.id('orgA')) = 0, 'org B sees org A templates');
  perform tests.ok('C5313 org B reads no org A version', (select count(*) from public.document_template_versions where org_id = tests.id('orgA')) = 0, 'org B sees org A versions');
  perform tests.ok('C5313 org B reads the system ones', (select count(*) from public.document_templates where org_id is null and kind = 'agreement') = 1
    and (select count(*) from public.document_template_versions where org_id is null and template_id = '00000000-0000-4000-8000-00000000c002') = 1, 'system rows not visible');
end $$;
reset role;
select tests.act_as('uA');
select tests.expect_error('C5313 member insert template', format('insert into public.document_templates (org_id, kind) values (%L, ''agreement'')', tests.id('orgA')), '42501');
select tests.expect_error('C5313 member insert version', format('insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, %L, 99, ''{}'')', (select v from tests.at_ids where k = 'tplQ'), tests.id('orgA')), '42501');
reset role;
select tests.act_as_anon();
select tests.expect_error('C5313 anon read templates', 'select count(*) from public.document_templates', '42501');
select tests.expect_error('C5313 anon read versions', 'select count(*) from public.document_template_versions', '42501');
select tests.expect_error('C5313 anon insert template', 'insert into public.document_templates (org_id, kind) values (null, ''agreement'')', '42501');
select tests.expect_error('C5313 anon insert version', format('insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, null, 99, ''{}'')', '00000000-0000-4000-8000-00000000c002'::uuid), '42501');
reset role;

-- C5314, C5315, C5316, C5318: a preset becomes the first lines.
do $$
declare
  t uuid;
  ver uuid;
  a uuid;
  v1 uuid;
  body_before text;
  l record;
begin
  t := tests.at_save('uA', null, tests.at_preset('Preset', '24', jsonb_build_array(
    tests.at_line('Quarterly HVAC visit', '[3,6,9,12]', '["RTU"]', '45000'),
    tests.at_line('Annual boiler check', '[10]', '["RTU","NOPE"]', 'null'))));
  ver := tests.at_vid(t, 1);
  select body::text into body_before from public.document_template_versions where id = ver;
  a := tests.at_draft('t5314', ver);
  v1 := tests.latest_version(a);
  perform tests.ok('C5314 two lines', (select count(*) from public.service_lines where agreement_version_id = v1) = 2, 'not two lines');
  select * into l from public.service_lines where agreement_version_id = v1 and position = 0;
  perform tests.ok('C5314 line 1', l.description = 'Quarterly HVAC visit' and l.visit_months = '{3,6,9,12}' and l.visits_per_year = 4 and l.cost_per_visit_cents = 45000,
    'line 1 is ' || row(l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents)::text);
  select * into l from public.service_lines where agreement_version_id = v1 and position = 1;
  perform tests.ok('C5314 line 2 null price is 0', l.description = 'Annual boiler check' and l.visit_months = '{10}' and l.visits_per_year = 1 and l.cost_per_visit_cents = 0,
    'line 2 is ' || row(l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents)::text);
  perform tests.ok('C5315 RTU linked, NOPE left off', (select array_agg(c.asset_type_id) from public.service_line_asset_types c where c.service_line_id = l.id) = array[tests.id('typeA')],
    'coverage is ' || coalesce((select array_agg(c.asset_type_id)::text from public.service_line_asset_types c where c.service_line_id = l.id), 'none'));
  perform tests.ok('C5315 line one linked too', (select count(*) from public.service_line_asset_types c join public.service_lines s on s.id = c.service_line_id
    where s.agreement_version_id = v1 and s.position = 0 and c.asset_type_id = tests.id('typeA')) = 1, 'line 1 not linked');
  perform tests.ok('C5316 term 24', (select term_months from public.agreement_versions where id = v1) = 24, 'term is ' || (select term_months from public.agreement_versions where id = v1));

  -- C5316 null term leaves the org default.
  update public.org_settings set default_term_months = 18 where org_id = tests.id('orgA');
  t := tests.at_save('uA', null, tests.at_preset('No term', 'null', '[]'));
  a := tests.at_draft('t5316', tests.at_vid(t, 1));
  perform tests.ok('C5316 null term is the org default', (select term_months from public.agreement_versions where id = tests.latest_version(a)) = 18, 'term is not 18');
  perform tests.ok('C5316 empty preset makes no lines', (select count(*) from public.service_lines where agreement_version_id = tests.latest_version(a)) = 1,
    'lines other than the test one exist');

  -- C5318: editing a copied line changes the line, not the template.
  perform tests.act_as('uE');
  perform tests.expect_rows('C5318 edit', format('update public.service_lines set description = ''Edited'', cost_per_visit_cents = 1 where agreement_version_id = %L and position = 0', v1), 1);
  reset role;
  perform tests.ok('C5318 line changed', (select description from public.service_lines where agreement_version_id = v1 and position = 0) = 'Edited', 'line not edited');
  perform tests.ok('C5318 template unchanged', (select body::text from public.document_template_versions where id = ver) = body_before, 'template body changed');
end $$;

-- C5330: portal_view returns the frozen version's body; a null pin reads as the system version 1.
do $$
declare
  t uuid := tests.at_save('uA', null, tests.at_body('{"name":"Portal template","intro":[{"type":"paragraph","text":"Welcome {{customer.name}}."}]}'));
  ver uuid := tests.at_vid(t, 1);
  a1 uuid;
  a2 uuid;
  v jsonb;
begin
  a1 := tests.at_draft('t5330a', ver);
  a2 := tests.at_draft('t5330b');
  perform tests.at_send(a1, 't5330a');
  perform tests.at_send(a2, 't5330b');
  perform tests.act_as_anon();
  v := public.portal_view(tests.at_hash('t5330a'));
  reset role;
  perform tests.ok('C5330 pinned body', v -> 'template' = (select body from public.document_template_versions where id = ver), 'template is ' || coalesce((v -> 'template')::text, 'null'));
  perform tests.act_as_anon();
  v := public.portal_view(tests.at_hash('t5330b'));
  reset role;
  perform tests.ok('C5330 null pin is the system body', v -> 'template' = '{"schema":1,"name":"Standard agreement","description":"","intro":[],"footer":[],"sections":{"schedule":true,"scope":true},"preset":{"termMonths":null,"lines":[]}}'::jsonb,
    'template is ' || coalesce((v -> 'template')::text, 'null'));
  perform tests.ok('C5330 rest of the view', v -> 'agreement' ->> 'number' is not null and jsonb_typeof(v -> 'lines') = 'array' and v ? 'terms', 'view lost keys');
end $$;

-- C5317: at the live-agreement limit a create with a version is refused and creates nothing (org B).
do $$
declare
  n bigint;
begin
  insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
  values (tests.id('orgB'), 'cus_at_b', 'sub_at_b', 'starter', 2, array['hvac'], false);
  update private.plan_limits set live_agreements = (select count(*) from public.agreements a where a.org_id = tests.id('orgB')
    and a.status in ('draft', 'sent', 'changes_requested')) where plan = 'starter';
  perform tests.at_site('t5317:site', 'B');
  n := (select count(*) from public.agreements where org_id = tests.id('orgB'));
  perform tests.act_as('uB');
  perform tests.expect_hint('C5317 plan limit', format('select public.create_agreement(%L, %L)', tests.id('t5317:site'), '00000000-0000-4000-8000-00000000c102'::uuid), '55000', 'plan_limit_agreements');
  reset role;
  perform tests.ok('C5317 nothing created', (select count(*) from public.agreements where org_id = tests.id('orgB')) = n, 'an agreement was created');
end $$;

reset role;
rollback;
select 'agreement_templates: pass' as result;
