-- Rich templates (Word-style editor), database side: schema 3 agreement and contract bodies are saved when safe and refused with
-- 22023 when not, a version draws only its own org's pictures, and schema 1 and 2 bodies behave as before.
-- Run after fixture.sql (npm run test:db rich_templates); it tests the objects of 20261123100000_rich_templates.sql, applied to the
-- hosted project by the owner on 2026-11-23. Expected values come from the spec, never read back from the migration.
-- Fixture: org A owner uA; org B owner uB.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

create function tests.rt_doc() returns jsonb
language sql as $$ select '{"title":"","showMeta":false,"pageHeader":"first","pageFooter":"number"}'::jsonb $$;

create function tests.rt_agreement(p_content jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('schema', 3, 'name', 'Designed page', 'description', '', 'doc', tests.rt_doc(), 'content', p_content,
    'preset', jsonb_build_object('termMonths', null, 'lines', '[]'::jsonb))
$$;

create function tests.rt_page(variadic p_nodes jsonb[]) returns jsonb
language sql as $$ select jsonb_build_object('type', 'doc', 'content', to_jsonb(p_nodes)) $$;

create function tests.rt_save_sql(p_template uuid, p_body jsonb) returns text
language sql as $$ select format('select * from public.save_agreement_template(%L, %L::jsonb)', p_template, p_body::text) $$;

do $$
declare
  r record;
  t uuid;
  n_v integer;
  org_a text := tests.id('orgA')::text;
  org_b text := tests.id('orgB')::text;
  para jsonb := '{"type":"paragraph","attrs":{"textAlign":"center"},"content":[{"type":"text","text":"Dear ","marks":[{"type":"bold"},{"type":"textStyle","attrs":{"color":"#1d4ed8","fontSize":"18px"}}]},{"type":"variable","attrs":{"name":"customer.name"}}]}'::jsonb;
  tbl jsonb := '{"type":"table","content":[{"type":"tableRow","content":[{"type":"tableHeader","attrs":{"background":"#eef2ff"},"content":[{"type":"paragraph","content":[{"type":"text","text":"Visit"}]}]}]},{"type":"tableRow","content":[{"type":"tableCell","content":[{"type":"paragraph"}]}]}]}'::jsonb;
  price jsonb := '{"type":"section","attrs":{"key":"price","options":{"title":"Your price"}}}'::jsonb;
  schedule jsonb := '{"type":"section","attrs":{"key":"schedule"}}'::jsonb;
  link jsonb := '{"type":"paragraph","content":[{"type":"text","text":"site","marks":[{"type":"link","attrs":{"href":"https://example.com"}}]}]}'::jsonb;
  own_picture jsonb;
  other_picture jsonb;
  signatures jsonb := '{"type":"section","attrs":{"key":"signatures"}}'::jsonb;
begin
  own_picture := jsonb_build_object('type', 'image', 'attrs', jsonb_build_object('asset', org_a || '/' || tests.id('pic1')::text || '.png', 'width', 50, 'align', 'center'));
  other_picture := jsonb_build_object('type', 'image', 'attrs', jsonb_build_object('asset', org_b || '/' || tests.id('pic2')::text || '.jpg', 'width', 50, 'align', 'left'));

  -- A designed page with text styles, a field, a table, a picture of the org's own, a link and two live sections is saved as sent.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(null, tests.rt_agreement(tests.rt_page(para, tbl, own_picture, price, schedule, link)));
  reset role;
  t := r.template_id;
  perform tests.ok('rich: a designed page is saved as version 1', r.version_no = 1, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.ok('rich: the page is stored as sent',
    (select body -> 'content' from public.document_template_versions where template_id = t and version_no = 1) = tests.rt_page(para, tbl, own_picture, price, schedule, link),
    'content changed');

  -- A blank page, with no price table, is allowed (the editor warns; it does not block).
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, tests.rt_agreement(tests.rt_page('{"type":"paragraph"}'::jsonb)));
  reset role;
  perform tests.ok('rich: a blank page with no price table is saved', r.version_no = 2, 'returned ' || coalesce(r.version_no::text, 'null'));

  -- Schema 2 still saves, and still needs its price table.
  perform tests.act_as('uA');
  select * into r from public.save_agreement_template(t, jsonb_build_object('schema', 2, 'name', 'Designed page', 'description', '',
    'doc', '{"title":"A","showMeta":true,"pageHeader":"first","pageFooter":"number"}'::jsonb,
    'layout', '[{"kind":"section","key":"price"}]'::jsonb, 'preset', '{"termMonths":null,"lines":[]}'::jsonb));
  reset role;
  perform tests.ok('rich: a schema 2 body still saves', r.version_no = 3, 'returned ' || coalesce(r.version_no::text, 'null'));

  n_v := (select count(*) from public.document_template_versions where template_id = t);
  perform tests.act_as('uA');
  perform tests.expect_error('rich: schema 2 without a price table is still refused', tests.rt_save_sql(t, jsonb_build_object('schema', 2, 'name', 'Designed page',
    'description', '', 'doc', '{"title":"A","showMeta":true,"pageHeader":"first","pageFooter":"number"}'::jsonb, 'layout', '[]'::jsonb,
    'preset', '{"termMonths":null,"lines":[]}'::jsonb)), '22023');
  perform tests.expect_error('rich: an unknown node type', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page('{"type":"iframe"}'::jsonb))), '22023');
  perform tests.expect_error('rich: an unknown mark type', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    '{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"script"}]}]}'::jsonb))), '22023');
  perform tests.expect_error('rich: an unknown field', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    '{"type":"paragraph","content":[{"type":"variable","attrs":{"name":"tenant.bankAccount"}}]}'::jsonb))), '22023');
  perform tests.expect_error('rich: a signing tag typed as text', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    '{"type":"paragraph","content":[{"type":"text","text":"{{Sig;role=Customer;type=signature}}"}]}'::jsonb))), '22023');
  perform tests.expect_error('rich: a link that is not https', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    '{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}'::jsonb))), '22023');
  perform tests.expect_error('rich: a picture that is not an upload key', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    '{"type":"image","attrs":{"asset":"https://evil.example/x.png","width":50,"align":"left"}}'::jsonb))), '22023');
  perform tests.expect_error('rich: another org''s picture', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(other_picture))), '22023');
  perform tests.expect_error('rich: the price table twice', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(price, price))), '22023');
  perform tests.expect_error('rich: a signatures section on an agreement', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(signatures))), '22023');
  perform tests.expect_error('rich: a live section inside a list', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    jsonb_build_object('type', 'bulletList', 'content', jsonb_build_array(jsonb_build_object('type', 'listItem', 'content', jsonb_build_array(price))))))), '22023');
  perform tests.expect_error('rich: content that is not a document', tests.rt_save_sql(t, tests.rt_agreement('[]'::jsonb)), '22023');
  perform tests.expect_error('rich: an extra key', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(para)) || '{"layout":[]}'::jsonb), '22023');
  perform tests.expect_error('rich: an empty name', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(para)) || '{"name":" "}'::jsonb), '22023');
  perform tests.expect_error('rich: a bad document option', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(para)) || '{"doc":{"title":"x"}}'::jsonb), '22023');
  perform tests.expect_error('rich: a body over 512 KB', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(
    jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', repeat('x', 530000))))))), '22023');
  reset role;
  perform tests.ok('rich: nothing written by the refusals', (select count(*) from public.document_template_versions where template_id = t) = n_v, 'a version was written');

  -- Contract wording: a page with its signatures saves; without them it is refused.
  perform tests.act_as('uA');
  select * into r from public.save_contract_template(jsonb_build_object('schema', 3, 'doc', tests.rt_doc(), 'content', tests.rt_page(para, signatures)));
  reset role;
  perform tests.ok('rich: a contract page with signatures is saved', r.version_no >= 1, 'returned ' || coalesce(r.version_no::text, 'null'));
  perform tests.act_as('uA');
  perform tests.expect_error('rich: a contract page without signatures', format('select * from public.save_contract_template(%L::jsonb)',
    jsonb_build_object('schema', 3, 'doc', tests.rt_doc(), 'content', tests.rt_page(para, price))::text), '22023');
  perform tests.expect_error('rich: a terms section on a contract', format('select * from public.save_contract_template(%L::jsonb)',
    jsonb_build_object('schema', 3, 'doc', tests.rt_doc(), 'content', tests.rt_page('{"type":"section","attrs":{"key":"terms"}}'::jsonb, signatures))::text), '22023');
  reset role;

  -- The picture rule holds for any insert, not only through the save functions.
  perform tests.expect_error('rich: a version of org B drawing org A''s picture', format(
    'insert into public.document_template_versions (template_id, org_id, version_no, body) values (%L, %L, 99, %L::jsonb)',
    t, tests.id('orgB'), tests.rt_agreement(tests.rt_page(own_picture))::text), '22023');

  -- Another org cannot reach this template.
  perform tests.act_as('uB');
  perform tests.expect_error('rich: other org id', tests.rt_save_sql(t, tests.rt_agreement(tests.rt_page(para))), 'P0002');
  reset role;

  -- The bucket exists, public, PNG and JPEG only, 3 MB.
  perform tests.ok('rich: the template-images bucket',
    exists (select 1 from storage.buckets where id = 'template-images' and public and file_size_limit = 3145728
            and allowed_mime_types = array['image/png', 'image/jpeg']), 'bucket missing or different');
end $$;

reset role;
rollback;
select 'rich_templates: pass' as result;
