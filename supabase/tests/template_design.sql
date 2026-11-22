-- Template design (rich template editor, slice 1), database side: the theme, a block's style and tables are accepted when valid,
-- refused with 22023 when not, and a body without any of them is saved as before. Run after fixture.sql (npm run test:db template_design).
-- Needs migration 20261122100000_template_design.sql. Expected values come from the spec, never read back from the migration.
-- Fixture: org A owner uA; org B owner uB.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

create function tests.td_body(p_doc jsonb, p_layout jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('schema', 2, 'name', 'Designed', 'description', '',
    'doc', jsonb_build_object('title', 'Agreement', 'showMeta', true, 'pageHeader', 'first', 'pageFooter', 'number') || p_doc,
    'layout', p_layout, 'preset', jsonb_build_object('termMonths', null, 'lines', '[]'::jsonb))
$$;

create function tests.td_price() returns jsonb
language sql as $$ select jsonb_build_object('kind', 'section', 'key', 'price') $$;

do $$
declare
  r record;
  t uuid;
  n_v integer;
  styled jsonb := jsonb_build_object('kind', 'block', 'type', 'paragraph', 'text', 'Thanks', 'style', '{"align":"center","bold":true,"italic":false}'::jsonb);
  tbl jsonb := '{"kind":"table","header":true,"rows":[["Visit","What we do"],["Spring","{{customer.name}}"],["",""]]}'::jsonb;
begin
  -- A body with no design at all is saved, as every body was before.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(null, tests.td_body('{}', jsonb_build_array(tests.td_price())));
  reset role;
  t := r.template_id;
  perform tests.ok('design: a plain body is saved as version 1', r.version_no = 1, 'returned ' || coalesce(r.version_no::text, 'null'));

  -- A theme, a styled block and a table are accepted together, and kept exactly as sent.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.td_body('{"theme":{"accent":"violet","font":"serif"}}', jsonb_build_array(styled, tbl, tests.td_price())));
  reset role;
  perform tests.ok('design: theme, style and table accepted', r.version_no = 2, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('design: the table is stored as sent',
    (select body -> 'layout' -> 1 from public.document_template_versions where template_id = t and version_no = 2) = tbl, 'table changed');
  perform tests.ok('design: the theme is stored as sent',
    (select body -> 'doc' -> 'theme' from public.document_template_versions where template_id = t and version_no = 2) = '{"accent":"violet","font":"serif"}'::jsonb, 'theme changed');

  -- Either theme key alone, and a table of one cell, are fine.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.td_body('{"theme":{"font":"sans"}}', jsonb_build_array('{"kind":"table","header":false,"rows":[["x"]]}'::jsonb, tests.td_price())));
  reset role;
  perform tests.ok('design: a font alone and a one-cell table accepted', r.version_no = 3, 'returned ' || coalesce(r.version_no::text, 'null'));

  n_v := (select count(*) from public.document_template_versions where template_id = t);
  perform tests.act_as('uA');
  perform tests.expect_error('design: unknown accent', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{"theme":{"accent":"pink"}}', jsonb_build_array(tests.td_price()))::text), '22023');
  perform tests.expect_error('design: unknown theme key', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{"theme":{"size":9}}', jsonb_build_array(tests.td_price()))::text), '22023');
  perform tests.expect_error('design: unknown font', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{"theme":{"font":"comic"}}', jsonb_build_array(tests.td_price()))::text), '22023');
  perform tests.expect_error('design: unknown style key', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"block","type":"paragraph","text":"x","style":{"underline":true}}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: bad alignment', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"block","type":"paragraph","text":"x","style":{"align":"wide"}}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: bold must be a boolean', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"block","type":"paragraph","text":"x","style":{"bold":"yes"}}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: a table with no rows', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"table","header":true,"rows":[]}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: a ragged table', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"table","header":true,"rows":[["a","b"],["c"]]}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: six columns', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"table","header":true,"rows":[["a","b","c","d","e","f"]]}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: a table with an unknown key', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"table","header":true,"rows":[["a"]],"widths":[1]}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: a cell that is not text', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"table","header":true,"rows":[[1]]}'::jsonb, tests.td_price()))::text), '22023');
  perform tests.expect_error('design: an unknown item kind is still refused', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{}', jsonb_build_array('{"kind":"image"}'::jsonb, tests.td_price()))::text), '22023');
  reset role;
  perform tests.ok('design: nothing written by the refusals', (select count(*) from public.document_template_versions where template_id = t) = n_v, 'a version was written');

  -- Another org cannot reach this template, designed or not.
  perform tests.act_as('uB');
  perform tests.expect_error('design: other org id', format('select * from public.save_agreement_template(%L, %L::jsonb)', t,
    tests.td_body('{"theme":{"accent":"rose"}}', jsonb_build_array(tests.td_price()))::text), 'P0002');
  reset role;
end $$;

reset role;
rollback;
select 'template_design: pass' as result;
