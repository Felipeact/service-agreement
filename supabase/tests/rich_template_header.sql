-- Rich templates, the page header, database side: a schema 3 body with a header, with none (null) and without the key is saved; a
-- header with a live section, a page break, an unknown field or another org's picture is refused with 22023.
-- Run after fixture.sql (npm run test:db rich_template_header replays 20261124100000_rich_template_header.sql in the rolled-back
-- transaction). Expected values come from the spec, never read back from the migration. Fixture: org A owner uA; org B owner uB.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

create function tests.rh_body(p_header jsonb, p_with_key boolean default true) returns jsonb
language sql as $$
  select jsonb_build_object('schema', 3, 'name', 'Headed page', 'description', '',
    'doc', '{"title":"","showMeta":false,"pageHeader":"every","pageFooter":"number"}'::jsonb,
    'content', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Body"}]}]}'::jsonb,
    'preset', '{"termMonths":null,"lines":[]}'::jsonb)
    || case when p_with_key then jsonb_build_object('header', p_header) else '{}'::jsonb end
$$;

create function tests.rh_save_sql(p_template uuid, p_body jsonb) returns text
language sql as $$ select format('select * from public.save_agreement_template(%L, %L::jsonb)', p_template, p_body::text) $$;

do $$
declare
  r record;
  t uuid;
  n_v integer;
  org_a text := tests.id('orgA')::text;
  header jsonb := '{"type":"doc","content":[{"type":"companyLogo","attrs":{"size":"medium","align":"left"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"variable","attrs":{"name":"tenant.legalName"}}]},{"type":"horizontalRule"}]}'::jsonb;
  own_picture jsonb;
begin
  own_picture := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'image', 'attrs',
    jsonb_build_object('asset', org_a || '/' || tests.id('pic1')::text || '.png', 'width', 30, 'align', 'left'))));

  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(null, tests.rh_body(header));
  reset role;
  t := r.template_id;
  perform tests.ok('header: a designed header is saved', r.version_no = 1, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('header: stored as sent', (select body -> 'header' from public.document_template_versions where template_id = t and version_no = 1) = header, 'header changed');

  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.rh_body('null'::jsonb));
  perform tests.ok('header: no header (null) is saved', r.version_no = 2, 'returned ' || coalesce(r.version_no::text, 'null'));
  select * into r from public.save_agreement_template(t, tests.rh_body(null, false));
  perform tests.ok('header: a body without the key still saves', r.version_no = 3, 'returned ' || coalesce(r.version_no::text, 'null'));
  select * into r from public.save_agreement_template(t, tests.rh_body(own_picture));
  perform tests.ok('header: the org''s own picture in the header is saved', r.version_no = 4, 'returned ' || coalesce(r.version_no::text, 'null'));
  reset role;

  n_v := (select count(*) from public.document_template_versions where template_id = t);
  perform tests.act_as('uA');
  perform tests.expect_error('header: a live section', tests.rh_save_sql(t, tests.rh_body('{"type":"doc","content":[{"type":"section","attrs":{"key":"price"}}]}'::jsonb)), '22023');
  perform tests.expect_error('header: a page break', tests.rh_save_sql(t, tests.rh_body('{"type":"doc","content":[{"type":"pageBreak"}]}'::jsonb)), '22023');
  perform tests.expect_error('header: an unknown field', tests.rh_save_sql(t, tests.rh_body('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"variable","attrs":{"name":"tenant.iban"}}]}]}'::jsonb)), '22023');
  perform tests.expect_error('header: not a document', tests.rh_save_sql(t, tests.rh_body('"Kettle Ridge"'::jsonb)), '22023');
  perform tests.expect_error('header: another key beside it', tests.rh_save_sql(t, tests.rh_body(header) || '{"footer":null}'::jsonb), '22023');
  reset role;
  perform tests.ok('header: nothing written by the refusals', (select count(*) from public.document_template_versions where template_id = t) = n_v, 'a version was written');

  perform tests.expect_error('header: org B''s version drawing org A''s picture in its header', format(
    'insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, %L, 99, %L::jsonb)',
    t, tests.id('orgB'), tests.rh_body(own_picture)::text), '22023');

  -- The contract wording takes a header too, and still needs its signatures.
  perform tests.act_as('uA');
  select * into r from public.save_contract_template(jsonb_build_object('schema', 3, 'doc', '{"title":"","showMeta":false,"pageHeader":"first","pageFooter":"number"}'::jsonb,
    'content', '{"type":"doc","content":[{"type":"section","attrs":{"key":"signatures"}}]}'::jsonb, 'header', header));
  perform tests.ok('header: a contract with a header is saved', r.version_no >= 1, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.expect_error('header: a contract header with signatures', format('select * from public.save_contract_template(%L::jsonb)',
    jsonb_build_object('schema', 3, 'doc', '{"title":"","showMeta":false,"pageHeader":"first","pageFooter":"number"}'::jsonb,
      'content', '{"type":"doc","content":[{"type":"section","attrs":{"key":"signatures"}}]}'::jsonb,
      'header', '{"type":"doc","content":[{"type":"section","attrs":{"key":"signatures"}}]}'::jsonb)::text), '22023');
  reset role;
end $$;

reset role;
rollback;
select 'rich_template_header: pass' as result;
