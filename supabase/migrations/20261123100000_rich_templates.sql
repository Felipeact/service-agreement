-- Rich templates (Word-style editor): schema 3 template bodies and the pictures they draw.
--
--   agreement body  { schema: 3, name, description, doc, content, preset }
--   contract body   { schema: 3, doc, content }
--   content         a TipTap / ProseMirror document: { type: 'doc', content: [ ...nodes ] }
--
-- The app validates every attribute of a page before it calls the save functions (web/domain/rich-document/validate.ts). This
-- migration makes the database refuse, on its own, what would be unsafe or undrawable if a caller skipped the app:
--   * only the listed node and mark types; at most 10,000 typed objects; a body of at most 512 KB
--   * merge fields only from the fixed list; no "{{...}}" typed into text (the signing service reads those as its fields)
--   * links only https; pictures only as `<org id>/<uuid>.png|jpg` keys, and (trigger below) only keys of the version's own org
--   * live sections only at the top of the page, each at most once, of the document's kind; a contract page holds its signatures
-- name, description, doc and preset keep the checks they have (the schema 2 functions run on a stand-in body). Schemas 1 and 2,
-- and every stored version, are untouched. The two check functions keep their names and signatures, because
-- save_agreement_template and save_contract_template call them by name.
--
-- Pictures: the public bucket `template-images`, written as the `logos` bucket is (an owner or admin of the org named by the key's
-- first segment), PNG and JPEG only (the PDF renderer draws no other), 3 MB. A picture is never deleted: sent versions draw it.
--
-- NOT applied to the hosted project: applying it needs the owner's go-ahead. Apply 20261122100000_template_design.sql first.

-- The bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-images', 'template-images', true, 3145728, array['image/png', 'image/jpeg']);

create policy template_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'template-images'
    and array_length(storage.foldername(name), 1) = 1
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin']))
  );

create policy template_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'template-images'
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin']))
  );

-- The page's own rules. p_sections: the live sections this kind of document has; p_required: those it must hold.
create function private.rich_content_problem(p_content jsonb, p_sections text[], p_required text[])
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_types constant text[] := array[
    'doc', 'paragraph', 'heading', 'text', 'variable', 'hardBreak', 'bulletList', 'orderedList', 'listItem',
    'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'companyLogo', 'horizontalRule', 'pageBreak', 'section',
    'bold', 'italic', 'underline', 'strike', 'textStyle', 'highlight', 'link'];
  v_variables constant text[] := array[
    'terms.paymentDays', 'terms.cancellationNoticeDays', 'terms.repairDiscountPct', 'terms.cpiCapPct',
    'terms.cpiRenegotiationThresholdPct', 'terms.renewalNoticeDays', 'province', 'term.label', 'tenant.legalName',
    'customer.name', 'site.name', 'term.start', 'tenant.address', 'tenant.phone', 'signer.name', 'terms.taxNote'];
  v_value text;
  v_all integer;
  v_top integer;
  v_key text;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' or p_content ->> 'type' is distinct from 'doc'
     or jsonb_typeof(p_content -> 'content') is distinct from 'array' then
    return 'content must be a document { type: doc, content: [...] }';
  end if;

  if (select count(*) from jsonb_path_query(p_content, 'strict $.** ? (@.type.type() == "string")')) > 10000 then
    return 'the page has more than 10,000 parts';
  end if;

  for v_value in select distinct t #>> '{}' from jsonb_path_query(p_content, 'lax $.**.type') t loop
    if v_value is null or not (v_value = any (v_types)) then
      return format('the page has a part this editor does not draw: %s', coalesce(v_value, 'null'));
    end if;
  end loop;

  for v_value in select n #>> '{}' from jsonb_path_query(p_content, 'strict $.** ? (@.type == "variable" && exists(@.attrs.name)).attrs.name') n loop
    if v_value is null or not (v_value = any (v_variables)) then
      return format('the page uses an unknown field: %s', coalesce(v_value, 'null'));
    end if;
  end loop;

  if jsonb_path_exists(p_content, 'strict $.** ? (@.type == "text" && @.text like_regex "[{][{][^{}]*[}][}]")') then
    return 'text may not hold {{...}}; insert fields instead';
  end if;

  for v_value in select n #>> '{}' from jsonb_path_query(p_content, 'strict $.** ? (@.type == "link" && exists(@.attrs.href)).attrs.href') n loop
    if v_value is null or v_value !~ '^https://' or char_length(v_value) > 500 then
      return 'a link must be an https address of at most 500 characters';
    end if;
  end loop;

  for v_value in select n #>> '{}' from jsonb_path_query(p_content, 'strict $.** ? (@.type == "image" && exists(@.attrs.asset)).attrs.asset') n loop
    if v_value is null or v_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg)$' then
      return 'a picture must be an uploaded key <org id>/<uuid>.png or .jpg';
    end if;
  end loop;
  if (select count(*) from jsonb_path_query(p_content, 'strict $.** ? (@.type == "image")')) > 30 then
    return 'the page has more than 30 pictures';
  end if;

  -- Live sections: every one at the top of the page, known to this document, once each, the required ones present.
  select count(*) into v_all from jsonb_path_query(p_content, 'strict $.** ? (@.type == "section")');
  select count(*) into v_top from jsonb_array_elements(p_content -> 'content') n where n ->> 'type' = 'section';
  if v_all <> v_top then
    return 'a live section must sit on the page, not inside a table or a list';
  end if;
  for v_key, v_all in
    select n #>> '{attrs,key}', count(*) from jsonb_array_elements(p_content -> 'content') n where n ->> 'type' = 'section' group by 1
  loop
    if v_key is null or not (v_key = any (p_sections)) then
      return format('the page has a live section this document does not have: %s', coalesce(v_key, 'null'));
    end if;
    if v_all > 1 then
      return format('the %s section is on the page more than once', v_key);
    end if;
  end loop;
  foreach v_key in array p_required loop
    if not exists (select 1 from jsonb_array_elements(p_content -> 'content') n where n ->> 'type' = 'section' and n #>> '{attrs,key}' = v_key) then
      return format('the page needs the %s section', v_key);
    end if;
  end loop;
  return null;
end $$;

revoke execute on function private.rich_content_problem(jsonb, text[], text[]) from public, anon, authenticated;

-- Agreement bodies.
alter function private.agreement_template_problem(jsonb) rename to agreement_template_problem_v2;

create function private.agreement_template_problem(p_body jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_problem text;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' or p_body -> 'schema' is distinct from '3'::jsonb then
    return private.agreement_template_problem_v2(p_body);
  end if;
  if octet_length(p_body::text) > 524288 then
    return 'the body is over 512 KB';
  end if;
  if not private.jsonb_has_exactly_keys(p_body, array['schema', 'name', 'description', 'doc', 'content', 'preset']) then
    return 'the body must have exactly the keys schema, name, description, doc, content and preset';
  end if;
  -- Name, description, document options and preset, checked as a schema 2 body that holds only the price table.
  v_problem := private.agreement_template_problem_v2(
    (p_body - 'content') || jsonb_build_object('schema', 2, 'layout', jsonb_build_array(jsonb_build_object('kind', 'section', 'key', 'price'))));
  if v_problem is not null then
    return v_problem;
  end if;
  return private.rich_content_problem(p_body -> 'content', array['price', 'schedule', 'included', 'equipment', 'terms'], '{}');
end $$;

revoke execute on function private.agreement_template_problem(jsonb) from public, anon, authenticated;
revoke execute on function private.agreement_template_problem_v2(jsonb) from public, anon, authenticated;

-- Contract bodies.
alter function private.contract_wording_problem(jsonb) rename to contract_wording_problem_v2;

create function private.contract_wording_problem(p_body jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_problem text;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' or p_body -> 'schema' is distinct from '3'::jsonb then
    return private.contract_wording_problem_v2(p_body);
  end if;
  if octet_length(p_body::text) > 524288 then
    return 'the body is over 512 KB';
  end if;
  if not private.jsonb_has_exactly_keys(p_body, array['schema', 'doc', 'content']) then
    return 'the body must have exactly the keys schema, doc and content';
  end if;
  v_problem := private.contract_wording_problem_v2(jsonb_build_object('schema', 2, 'doc', p_body -> 'doc', 'layout',
    jsonb_build_array(jsonb_build_object('kind', 'section', 'key', 'price'), jsonb_build_object('kind', 'section', 'key', 'signatures'))));
  if v_problem is not null then
    return v_problem;
  end if;
  return private.rich_content_problem(p_body -> 'content', array['price', 'schedule', 'included', 'equipment', 'signatures'], array['signatures']);
end $$;

revoke execute on function private.contract_wording_problem(jsonb) from public, anon, authenticated;
revoke execute on function private.contract_wording_problem_v2(jsonb) from public, anon, authenticated;

-- A version draws only its own org's pictures, whatever path wrote it (save, duplicate, a later function).
create function private.template_version_pictures_own()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body -> 'schema' = '3'::jsonb and exists (
    select 1 from jsonb_path_query(new.body -> 'content', 'strict $.** ? (@.type == "image" && exists(@.attrs.asset)).attrs.asset') a
    where new.org_id is null or (a #>> '{}') not like new.org_id::text || '/%'
  ) then
    raise exception 'a template version may only draw its own org''s pictures' using errcode = '22023';
  end if;
  return new;
end $$;

revoke execute on function private.template_version_pictures_own() from public, anon, authenticated;

create trigger document_template_versions_pictures_own
  before insert on public.document_template_versions
  for each row execute function private.template_version_pictures_own();
