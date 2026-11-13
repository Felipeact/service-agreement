-- block-editor, database side: C5513, C5514, C5528, C5529 (.specs/features/block-editor/checks.md).
-- Run after fixture.sql and the migration 20261113100000_block_editor.sql (npm run test:db block_editor): the migration is
-- not yet applied to the hosted project, so this recipe replays it inside the rolled-back transaction and tests those objects.
-- Fixture: org A owner uA, estimator uE, viewer uV, admin uAd (added here); org B owner uB; uX has no membership. Expected values
-- come from the checks, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- The document options of today's standard documents.
create function tests.be_doc(p_override jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('title', 'Preventive maintenance service agreement', 'showMeta', true, 'pageHeader', 'first', 'pageFooter', 'number') || p_override
$$;

create function tests.be_block(p_text text default 'Text') returns jsonb
language sql as $$ select jsonb_build_object('kind', 'block', 'type', 'paragraph', 'text', p_text) $$;

create function tests.be_section(p_key text, p_options jsonb default null) returns jsonb
language sql as $$
  select jsonb_build_object('kind', 'section', 'key', p_key) || case when p_options is null then '{}'::jsonb else jsonb_build_object('options', p_options) end
$$;

-- An agreement schema 2 body; p_override replaces whole top-level keys. The default layout is price only.
create function tests.be_body(p_override jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('schema', 2, 'name', 'Layout', 'description', '', 'doc', tests.be_doc(),
                            'layout', jsonb_build_array(tests.be_section('price')),
                            'preset', jsonb_build_object('termMonths', null, 'lines', '[]'::jsonb)) || p_override
$$;

-- A schema 1 agreement body.
create function tests.be_body1(p_name text) returns jsonb
language sql as $$
  select jsonb_build_object('schema', 1, 'name', p_name, 'description', '', 'intro', '[]'::jsonb, 'footer', '[]'::jsonb,
                            'sections', jsonb_build_object('schedule', true, 'scope', true),
                            'preset', jsonb_build_object('termMonths', null, 'lines', '[]'::jsonb))
$$;

-- A contract schema 2 body.
create function tests.be_wording(p_override jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object('schema', 2, 'doc', tests.be_doc('{"title":"Service Contract"}'),
                            'layout', jsonb_build_array(tests.be_section('price'), tests.be_block('Wording'), tests.be_section('signatures'))) || p_override
$$;

create function tests.be_items(p_count integer, p_item jsonb) returns jsonb
language sql as $$ select jsonb_agg(p_item) from generate_series(1, p_count) $$;

create function tests.be_vid(p_template uuid, p_no integer) returns uuid
language sql security definer as $$
  select id from public.document_template_versions where template_id = p_template and version_no = p_no
$$;

-- An accepted agreement of an org made into a contract by the given member; returns the contract id.
create function tests.be_contract(p_name text, p_org text default 'A', p_user text default 'uE') returns uuid
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

create table tests.be_ids (k text primary key, v uuid);
grant all on tests.be_ids to anon, authenticated;

grant execute on all functions in schema tests to anon, authenticated;

-- C5513: save_agreement_template accepts schema 1 and schema 2, leaves earlier versions unchanged, refuses a repeated section
-- and a missing price with 22023; the other statuses of the rpc are unchanged.
do $$
declare
  t uuid;
  r record;
  v1_before text;
  n_v bigint;
begin
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(null, tests.be_body1('Layout one'));
  reset role;
  t := r.template_id;
  perform tests.ok('C5513 schema 1 saved as version 1', r.version_no = 1, 'returned ' || coalesce(r.version_no::text, 'null'));
  select body::text into v1_before from public.document_template_versions where template_id = t and version_no = 1;

  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.be_body(jsonb_build_object('name', 'Layout one',
    'layout', jsonb_build_array(tests.be_block('Hello {{customer.name}}'), tests.be_section('included', '{"title":"Service included:","showFrequency":true,"uppercase":true}'),
      tests.be_section('price', '{"title":"Price","visitsFormat":"times_per_year","columns":{"description":"A","visits":"B","perVisit":"C","perYear":"D","total":"E"}}'),
      tests.be_section('equipment', '{"title":"EQUIPMENT LIST"}'), tests.be_section('schedule'), tests.be_section('terms')))));
  reset role;
  perform tests.ok('C5513 schema 2 saved as version 2', r.template_id = t and r.version_no = 2, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('C5513 version 1 byte for byte', (select body::text from public.document_template_versions where template_id = t and version_no = 1) = v1_before, 'version 1 changed');
  perform tests.ok('C5513 version 2 is schema 2', (select body -> 'schema' from public.document_template_versions where template_id = t and version_no = 2) = '2'::jsonb, 'not schema 2');

  -- Every optional piece of a valid body is accepted: level, indent, page break, a signatures-free agreement, no options.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.be_body(jsonb_build_object('name', 'Layout one', 'doc', tests.be_doc('{"title":"","showMeta":false,"pageHeader":"every","pageFooter":"letterhead"}'),
    'layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'heading', 'text', 'H', 'level', 2, 'indent', 3, 'pageBreakBefore', true), tests.be_section('price')))));
  reset role;
  perform tests.ok('C5513 block fields and doc options accepted', r.version_no = 3, 'returned ' || coalesce(r.version_no::text, 'null'));

  n_v := (select count(*) from public.document_template_versions where template_id = t);
  perform tests.act_as('uA');
  perform tests.expect_error('C5513 repeated section', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.be_body(jsonb_build_object('name', 'Layout one', 'layout', jsonb_build_array(tests.be_section('price'), tests.be_section('schedule'), tests.be_section('schedule'))))::text), '22023');
  perform tests.expect_error('C5513 no price', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.be_body(jsonb_build_object('name', 'Layout one', 'layout', jsonb_build_array(tests.be_section('schedule'))))::text), '22023');
  perform tests.expect_error('C5513 repeated price', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.be_body(jsonb_build_object('name', 'Layout one', 'layout', jsonb_build_array(tests.be_section('price'), tests.be_section('price'))))::text), '22023');
  reset role;
  perform tests.ok('C5513 nothing written by the refusals', (select count(*) from public.document_template_versions where template_id = t) = n_v, 'a version was written');

  -- The other statuses are unchanged: an estimator is refused, another org's id is unknown.
  perform tests.act_as('uE');
  perform tests.expect_error('C5513 estimator schema 2', format('select * from public.save_agreement_template(null, %L::jsonb)', tests.be_body('{"name":"Nope"}')::text), '42501');
  perform tests.act_as('uB');
  perform tests.expect_error('C5513 other org id', format('select * from public.save_agreement_template(%L, %L::jsonb)', t, tests.be_body('{"name":"Layout one"}')::text), 'P0002');
  reset role;
  insert into tests.be_ids values ('tpl', t);
end $$;

-- C5514: each invalid schema 2 body raises 22023 and writes nothing.
do $$
declare
  c record;
  n_v bigint := (select count(*) from public.document_template_versions);
  n_t bigint := (select count(*) from public.document_templates);
begin
  perform tests.act_as('uA');
  for c in
    select * from (values
      ('unknown item kind', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price'), '{"kind":"image","text":"x"}'::jsonb)))),
      ('unknown section key', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price'), tests.be_section('signatures'))))),
      ('61 items', tests.be_body(jsonb_build_object('layout', tests.be_items(60, tests.be_block()) || jsonb_build_array(tests.be_section('price'))))),
      ('41 blocks', tests.be_body(jsonb_build_object('layout', tests.be_items(41, tests.be_block()) || jsonb_build_array(tests.be_section('price'))))),
      ('text of 2001', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_block(repeat('x', 2001)), tests.be_section('price'))))),
      ('empty text', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_block(''), tests.be_section('price'))))),
      ('title of 121', tests.be_body(jsonb_build_object('doc', tests.be_doc(jsonb_build_object('title', repeat('x', 121)))))),
      ('indent 4', tests.be_body(jsonb_build_object('layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'paragraph', 'text', 'x', 'indent', 4), tests.be_section('price'))))),
      ('level 3', tests.be_body(jsonb_build_object('layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'heading', 'text', 'x', 'level', 3), tests.be_section('price'))))),
      ('level on a paragraph', tests.be_body(jsonb_build_object('layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'paragraph', 'text', 'x', 'level', 1), tests.be_section('price'))))),
      ('unknown pageHeader', tests.be_body(jsonb_build_object('doc', tests.be_doc('{"pageHeader":"last"}')))),
      ('unknown pageFooter', tests.be_body(jsonb_build_object('doc', tests.be_doc('{"pageFooter":"none"}')))),
      ('unknown doc key', tests.be_body(jsonb_build_object('doc', tests.be_doc('{"margin":1}')))),
      ('unknown block type', tests.be_body(jsonb_build_object('layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'quote', 'text', 'x'), tests.be_section('price'))))),
      ('unknown option', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price', '{"uppercase":true}'))))),
      ('bad visitsFormat', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price', '{"visitsFormat":"x"}'))))),
      ('column of 41', tests.be_body(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price', jsonb_build_object('columns',
        jsonb_build_object('description', repeat('x', 41), 'visits', 'a', 'perVisit', 'b', 'perYear', 'c', 'total', 'd'))))))),
      ('layout not a list', tests.be_body('{"layout":{}}')),
      ('schema 3', tests.be_body('{"schema":3}')),
      ('schema 2 with intro', tests.be_body('{"intro":[]}'))
    ) as t(label, body)
  loop
    perform tests.expect_error('C5514 ' || c.label, format('select * from public.save_agreement_template(null, %L::jsonb)', c.body::text), '22023');
  end loop;
  reset role;
  perform tests.ok('C5514 nothing written', (select count(*) from public.document_template_versions) = n_v and (select count(*) from public.document_templates) = n_t, 'a row was written');
end $$;

-- C5528: save_contract_template by an owner creates the contract template and version 1, an admin adds version 2, version 1 is
-- unchanged; a contract made between the saves keeps version 1 and one made after carries version 2.
do $$
declare
  r record;
  t uuid;
  c1 uuid;
  c2 uuid;
  v1_before text;
begin
  perform tests.ok('C5528 none before', not exists (select 1 from public.document_templates where org_id = tests.id('orgA') and kind = 'contract'), 'org A already has contract wording');
  perform tests.act_as('uA');
  select * into r from public.save_contract_template(tests.be_wording());
  reset role;
  t := r.template_id;
  perform tests.ok('C5528 first call is version 1', r.version_no = 1 and t is not null, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('C5528 template created', (select count(*) from public.document_templates where id = t and org_id = tests.id('orgA') and kind = 'contract') = 1, 'no contract template row');
  select body::text into v1_before from public.document_template_versions where template_id = t and version_no = 1;

  c1 := tests.be_contract('be1');
  perform tests.ok('C5528 contract between keeps version 1', (select template_version_id from public.contracts where id = c1) = tests.be_vid(t, 1), 'contract has another version');

  perform tests.act_as('uAd');
  select * into r from public.save_contract_template('{"schema":1,"blocks":[{"type":"paragraph","text":"Second wording"}]}');
  reset role;
  perform tests.ok('C5528 admin adds version 2', r.template_id = t and r.version_no = 2, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('C5528 version 1 byte for byte', (select body::text from public.document_template_versions where template_id = t and version_no = 1) = v1_before, 'version 1 changed');
  perform tests.ok('C5528 one contract template', (select count(*) from public.document_templates where org_id = tests.id('orgA') and kind = 'contract') = 1, 'more than one template');

  c2 := tests.be_contract('be2');
  perform tests.ok('C5528 contract after carries version 2', (select template_version_id from public.contracts where id = c2) = tests.be_vid(t, 2), 'contract has another version');
  perform tests.ok('C5528 earlier contract unmoved', (select template_version_id from public.contracts where id = c1) = tests.be_vid(t, 1), 'the earlier contract moved');
end $$;

-- C5529: an estimator, a viewer, a non-member and anon are refused with 42501 and write nothing; a bad body is 22023.
do $$
declare
  u text;
  c record;
  n_t bigint := (select count(*) from public.document_templates);
  n_v bigint := (select count(*) from public.document_template_versions);
begin
  foreach u in array array['uE', 'uV', 'uX'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C5529 ' || u, format('select * from public.save_contract_template(%L::jsonb)', tests.be_wording()::text), '42501');
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.expect_error('C5529 anon', format('select * from public.save_contract_template(%L::jsonb)', tests.be_wording()::text), '42501');
  reset role;
  -- Org B's owner may save for org B; the refused callers above wrote nothing.
  perform tests.ok('C5529 nothing written', (select count(*) from public.document_templates) = n_t and (select count(*) from public.document_template_versions) = n_v, 'a row was written');

  perform tests.act_as('uA');
  for c in
    select * from (values
      ('no signatures', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price'), tests.be_block())))),
      ('repeated signatures', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price'), tests.be_section('signatures'), tests.be_section('signatures'))))),
      ('no price', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(tests.be_section('signatures'))))),
      ('terms section', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(tests.be_section('price'), tests.be_section('terms'), tests.be_section('signatures'))))),
      ('unknown block type', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(jsonb_build_object('kind', 'block', 'type', 'quote', 'text', 'x'), tests.be_section('price'), tests.be_section('signatures'))))),
      ('61 items', tests.be_wording(jsonb_build_object('layout', tests.be_items(59, tests.be_section('price')) || jsonb_build_array(tests.be_section('price'), tests.be_section('signatures'))))),
      ('41 blocks', tests.be_wording(jsonb_build_object('layout', tests.be_items(41, tests.be_block()) || jsonb_build_array(tests.be_section('price'), tests.be_section('signatures'))))),
      ('text of 2001', tests.be_wording(jsonb_build_object('layout', jsonb_build_array(tests.be_block(repeat('x', 2001)), tests.be_section('price'), tests.be_section('signatures'))))),
      ('unknown doc option', tests.be_wording(jsonb_build_object('doc', tests.be_doc('{"pageHeader":"last"}')))),
      ('schema 1 unknown block type', '{"schema":1,"blocks":[{"type":"quote","text":"x"}]}'::jsonb),
      ('schema 1 with doc', '{"schema":1,"blocks":[],"doc":{}}'::jsonb),
      ('schema 3', '{"schema":3,"blocks":[]}'::jsonb),
      ('array body', '[]'::jsonb)
    ) as t(label, body)
  loop
    perform tests.expect_error('C5529 ' || c.label, format('select * from public.save_contract_template(%L::jsonb)', c.body::text), '22023');
  end loop;
  perform tests.expect_error('C5529 json null body', 'select * from public.save_contract_template(null)', '22023');
  reset role;
  perform tests.ok('C5529 nothing written by bad bodies', (select count(*) from public.document_templates) = n_t and (select count(*) from public.document_template_versions) = n_v, 'a row was written');
end $$;

reset role;
rollback;
select 'block_editor: pass' as result;
