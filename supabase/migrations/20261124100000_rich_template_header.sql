-- Rich templates, the page header: a schema 3 body may carry `header`, the page's header edited as the page is.
--
--   agreement body  { schema: 3, name, description, doc, content, preset, header? }
--   contract body   { schema: 3, doc, content, header? }
--   header          null (no header) or a document of the page's own rules, with no live sections and no page breaks
--
-- A body without the key (saved before headers were designed) is still accepted and still prints the letterhead its doc options
-- describe. The two check functions keep their names and signatures (the save functions call them by name), and the trigger that
-- keeps a version to its own org's pictures now reads the header's pictures as well. Stored versions are never rewritten.
-- Apply after 20261123100000_rich_templates.sql. NOT applied to the hosted project: applying it needs the owner's go-ahead.

-- The header's own rules, `null` when it may be stored.
create function private.rich_header_problem(p_header jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_problem text;
begin
  if p_header is null or jsonb_typeof(p_header) = 'null' then
    return null;
  end if;
  if jsonb_path_exists(p_header, 'strict $.** ? (@.type == "section")') then
    return 'a header holds no live sections';
  end if;
  if jsonb_path_exists(p_header, 'strict $.** ? (@.type == "pageBreak")') then
    return 'a header holds no page breaks';
  end if;
  v_problem := private.rich_content_problem(p_header, '{}', '{}');
  return case when v_problem is null then null else 'header: ' || v_problem end;
end $$;

revoke execute on function private.rich_header_problem(jsonb) from public, anon, authenticated;

create or replace function private.agreement_template_problem(p_body jsonb)
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
  if not coalesce(private.jsonb_keys_within(p_body, array['schema', 'name', 'description', 'doc', 'content', 'preset'], array['header']), false) then
    return 'the body must have the keys schema, name, description, doc, content and preset, and may have a header';
  end if;
  -- Name, description, document options and preset, checked as a schema 2 body that holds only the price table.
  v_problem := private.agreement_template_problem_v2(
    (p_body - 'content' - 'header') || jsonb_build_object('schema', 2, 'layout', jsonb_build_array(jsonb_build_object('kind', 'section', 'key', 'price'))));
  if v_problem is not null then
    return v_problem;
  end if;
  v_problem := private.rich_content_problem(p_body -> 'content', array['price', 'schedule', 'included', 'equipment', 'terms'], '{}');
  if v_problem is not null then
    return v_problem;
  end if;
  return private.rich_header_problem(p_body -> 'header');
end $$;

create or replace function private.contract_wording_problem(p_body jsonb)
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
  if not coalesce(private.jsonb_keys_within(p_body, array['schema', 'doc', 'content'], array['header']), false) then
    return 'the body must have the keys schema, doc and content, and may have a header';
  end if;
  v_problem := private.contract_wording_problem_v2(jsonb_build_object('schema', 2, 'doc', p_body -> 'doc', 'layout',
    jsonb_build_array(jsonb_build_object('kind', 'section', 'key', 'price'), jsonb_build_object('kind', 'section', 'key', 'signatures'))));
  if v_problem is not null then
    return v_problem;
  end if;
  v_problem := private.rich_content_problem(p_body -> 'content', array['price', 'schedule', 'included', 'equipment', 'signatures'], array['signatures']);
  if v_problem is not null then
    return v_problem;
  end if;
  return private.rich_header_problem(p_body -> 'header');
end $$;

-- The page's and the header's pictures alike must be the version's own org's.
create or replace function private.template_version_pictures_own()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body -> 'schema' = '3'::jsonb and exists (
    select 1 from jsonb_path_query(jsonb_build_array(new.body -> 'content', coalesce(new.body -> 'header', 'null'::jsonb)),
                                   'strict $.** ? (@.type == "image" && exists(@.attrs.asset)).attrs.asset') a
    where new.org_id is null or (a #>> '{}') not like new.org_id::text || '/%'
  ) then
    raise exception 'a template version may only draw its own org''s pictures' using errcode = '22023';
  end if;
  return new;
end $$;
