-- block-editor (.specs/features/block-editor/plan.md): an agreement and a contract draw a tenant-ordered layout of text blocks
-- and system sections, with document options, from an immutable template version.
-- Door 1: schema 2 of both bodies. agreement: { "schema": 2, "name", "description", "doc", "layout", "preset" }; contract:
-- { "schema": 2, "doc", "layout" }. doc = { "title" (0..120), "showMeta", "pageHeader" first|every, "pageFooter" number|letterhead };
-- an item is { "kind": "block", "type": heading|paragraph|clause, "text" (1..2000), "level"? 1|2 (heading only), "indent"? 0..3,
-- "pageBreakBefore"? } or { "kind": "section", "key", "options"? }. At most 60 items and 40 blocks, each section key at most once,
-- "price" exactly once (and "signatures" exactly once for a contract). Schema 1 versions are never rewritten and keep their rules.
-- Door 2: public.save_contract_template(p_body) is the only writer of an org's contract template.
-- The variable names (door 3) are checked by web/domain/contract/template.ts on save, never here: an unknown one renders as no value.

-- True when p_value is an object that has every required key and no key outside the required and optional ones.
create function private.jsonb_keys_within(p_value jsonb, p_required text[], p_optional text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
     and p_value ?& p_required
     and not exists (select 1 from jsonb_object_keys(p_value) k where k <> all (p_required || p_optional))
$$;

create function private.jsonb_text_between(p_value jsonb, p_min integer, p_max integer)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'string' then char_length(p_value #>> '{}') between p_min and p_max else false end
$$;

create function private.jsonb_whole_between(p_value jsonb, p_min integer, p_max integer)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_value) = 'number'
              then (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric) and (p_value #>> '{}')::numeric between p_min and p_max
              else false end
$$;

revoke execute on function private.jsonb_keys_within(jsonb, text[], text[]) from public, anon, authenticated;
revoke execute on function private.jsonb_text_between(jsonb, integer, integer) from public, anon, authenticated;
revoke execute on function private.jsonb_whole_between(jsonb, integer, integer) from public, anon, authenticated;

-- The schema 2 part both bodies share: the document options and the layout. p_sections are the section keys the document has,
-- p_once those that must appear exactly once. Returns why it cannot be stored, or null.
create function private.layout_problem(p_doc jsonb, p_layout jsonb, p_sections text[], p_once text[])
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_item jsonb;
  v_kind text;
  v_key text;
  v_seen text[] := '{}';
  v_blocks integer := 0;
  v_opts jsonb;
  v_opt text;
  v_val jsonb;
  v_col text;
begin
  if not coalesce(private.jsonb_keys_within(p_doc, array['title', 'showMeta', 'pageHeader', 'pageFooter'], '{}'), false) then
    return 'doc must be { title, showMeta, pageHeader, pageFooter }';
  end if;
  if not private.jsonb_text_between(p_doc -> 'title', 0, 120) then
    return 'the title must be at most 120 characters';
  end if;
  if jsonb_typeof(p_doc -> 'showMeta') is distinct from 'boolean' then
    return 'showMeta must be true or false';
  end if;
  if p_doc -> 'pageHeader' is distinct from '"first"'::jsonb and p_doc -> 'pageHeader' is distinct from '"every"'::jsonb then
    return 'pageHeader must be first or every';
  end if;
  if p_doc -> 'pageFooter' is distinct from '"number"'::jsonb and p_doc -> 'pageFooter' is distinct from '"letterhead"'::jsonb then
    return 'pageFooter must be number or letterhead';
  end if;

  if jsonb_typeof(p_layout) is distinct from 'array' then
    return 'layout must be a list';
  end if;
  if jsonb_array_length(p_layout) > 60 then
    return 'layout has more than 60 items';
  end if;

  for v_item in select e from jsonb_array_elements(p_layout) e loop
    v_kind := case when jsonb_typeof(v_item) = 'object' then v_item ->> 'kind' end;
    if v_kind = 'block' then
      v_blocks := v_blocks + 1;
      if not coalesce(private.jsonb_keys_within(v_item, array['kind', 'type', 'text'], array['level', 'indent', 'pageBreakBefore']), false) then
        return 'a block must be { kind, type, text } with at most level, indent and pageBreakBefore besides';
      end if;
      if v_item ->> 'type' is null or v_item ->> 'type' not in ('heading', 'paragraph', 'clause') then
        return 'a block must be a heading, paragraph or clause';
      end if;
      if not private.jsonb_text_between(v_item -> 'text', 1, 2000) then
        return 'a block text must be 1 to 2,000 characters';
      end if;
      if v_item ? 'level' and (v_item ->> 'type' <> 'heading' or not private.jsonb_whole_between(v_item -> 'level', 1, 2)) then
        return 'level is 1 or 2 and only for a heading';
      end if;
      if v_item ? 'indent' and not private.jsonb_whole_between(v_item -> 'indent', 0, 3) then
        return 'indent must be a whole number from 0 to 3';
      end if;
      if v_item ? 'pageBreakBefore' and jsonb_typeof(v_item -> 'pageBreakBefore') is distinct from 'boolean' then
        return 'pageBreakBefore must be true or false';
      end if;
    elsif v_kind = 'section' then
      if not coalesce(private.jsonb_keys_within(v_item, array['kind', 'key'], array['options']), false) then
        return 'a section must be { kind, key } with at most options besides';
      end if;
      v_key := v_item ->> 'key';
      if v_key is null or v_key <> all (p_sections) then
        return 'a section key must be one of ' || array_to_string(p_sections, ', ');
      end if;
      if v_key = any (v_seen) then
        return 'the section ' || v_key || ' is repeated';
      end if;
      v_seen := v_seen || v_key;
      if v_item ? 'options' then
        v_opts := v_item -> 'options';
        if not coalesce(private.jsonb_keys_within(v_opts, '{}', case v_key
             when 'price' then array['title', 'columns', 'visitsFormat']
             when 'included' then array['title', 'showFrequency', 'uppercase']
             when 'equipment' then array['title']
             when 'schedule' then array['title']
             when 'signatures' then array['customerLabel', 'contractorLabel', 'caption', 'nameField']
             else array[]::text[] end), false) then
          return 'the options of ' || v_key || ' have an unknown key';
        end if;
        for v_opt, v_val in select k, v from jsonb_each(v_opts) as t(k, v) loop
          if v_opt in ('title', 'customerLabel', 'contractorLabel', 'caption') then
            if not private.jsonb_text_between(v_val, 1, 120) then
              return v_opt || ' of ' || v_key || ' must be 1 to 120 characters';
            end if;
          elsif v_opt in ('showFrequency', 'uppercase', 'nameField') then
            if jsonb_typeof(v_val) is distinct from 'boolean' then
              return v_opt || ' of ' || v_key || ' must be true or false';
            end if;
          elsif v_opt = 'visitsFormat' then
            if v_val is distinct from '"number"'::jsonb and v_val is distinct from '"times_per_year"'::jsonb then
              return 'visitsFormat must be number or times_per_year';
            end if;
          elsif v_opt = 'columns' then
            if not coalesce(private.jsonb_keys_within(v_val, array['description', 'visits', 'perVisit', 'perYear', 'total'], '{}'), false) then
              return 'columns must be { description, visits, perVisit, perYear, total }';
            end if;
            for v_col in select k from jsonb_object_keys(v_val) k loop
              if not private.jsonb_text_between(v_val -> v_col, 1, 40) then
                return 'a column label must be 1 to 40 characters';
              end if;
            end loop;
          end if;
        end loop;
      end if;
    else
      return 'a layout item must be a block or a section';
    end if;
  end loop;

  if v_blocks > 40 then
    return 'layout has more than 40 blocks';
  end if;
  foreach v_key in array p_once loop
    if not (v_key = any (v_seen)) then
      return 'the section ' || v_key || ' must be in the layout';
    end if;
  end loop;
  return null;
end $$;

revoke execute on function private.layout_problem(jsonb, jsonb, text[], text[]) from public, anon, authenticated;

-- Door 1, agreement side: schema 1 exactly as in 20261112240000, plus schema 2. Returns why a body cannot be stored, or null.
create or replace function private.agreement_template_problem(p_body jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_list text;
  v_block jsonb;
  v_line jsonb;
  v_month jsonb;
  v_code jsonb;
  v_seen integer[];
  v_value integer;
  v_problem text;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    return 'the body must be an object';
  end if;
  if octet_length(p_body::text) > 65536 then
    return 'the body is over 64 KB';
  end if;
  if p_body -> 'schema' = '2'::jsonb then
    if not private.jsonb_has_exactly_keys(p_body, array['schema', 'name', 'description', 'doc', 'layout', 'preset']) then
      return 'the body must have exactly the keys schema, name, description, doc, layout and preset';
    end if;
  else
    if not private.jsonb_has_exactly_keys(p_body, array['schema', 'name', 'description', 'intro', 'footer', 'sections', 'preset']) then
      return 'the body must have exactly the keys schema, name, description, intro, footer, sections and preset';
    end if;
    if p_body -> 'schema' <> '1'::jsonb then
      return 'schema must be 1 or 2';
    end if;
  end if;
  if jsonb_typeof(p_body -> 'name') <> 'string' or char_length(btrim(p_body ->> 'name')) not between 1 and 80 then
    return 'name must be 1 to 80 characters';
  end if;
  if jsonb_typeof(p_body -> 'description') <> 'string' or char_length(p_body ->> 'description') > 300 then
    return 'description must be at most 300 characters';
  end if;

  if p_body -> 'schema' = '2'::jsonb then
    v_problem := private.layout_problem(p_body -> 'doc', p_body -> 'layout', array['price', 'schedule', 'included', 'equipment', 'terms'], array['price']);
    if v_problem is not null then
      return v_problem;
    end if;
  else
    foreach v_list in array array['intro', 'footer'] loop
      if jsonb_typeof(p_body -> v_list) <> 'array' then
        return v_list || ' must be a list';
      end if;
      if jsonb_array_length(p_body -> v_list) > 30 then
        return v_list || ' has more than 30 blocks';
      end if;
      for v_block in select e from jsonb_array_elements(p_body -> v_list) e loop
        if not private.jsonb_has_exactly_keys(v_block, array['type', 'text'])
           or v_block ->> 'type' is null or v_block ->> 'type' not in ('heading', 'paragraph', 'clause')
           or jsonb_typeof(v_block -> 'text') <> 'string'
           or char_length(v_block ->> 'text') not between 1 and 2000 then
          return v_list || ' has a block that is not a heading, paragraph or clause of 1 to 2,000 characters';
        end if;
      end loop;
    end loop;

    if not private.jsonb_has_exactly_keys(p_body -> 'sections', array['schedule', 'scope'])
       or jsonb_typeof(p_body #> '{sections,schedule}') <> 'boolean' or jsonb_typeof(p_body #> '{sections,scope}') <> 'boolean' then
      return 'sections must be { schedule, scope }, each true or false';
    end if;
  end if;

  if not private.jsonb_has_exactly_keys(p_body -> 'preset', array['termMonths', 'lines']) then
    return 'preset must be { termMonths, lines }';
  end if;
  -- 60 is the most an agreement version can hold (agreement_versions.term_months).
  if jsonb_typeof(p_body #> '{preset,termMonths}') <> 'null'
     and (jsonb_typeof(p_body #> '{preset,termMonths}') <> 'number'
          or (p_body #>> '{preset,termMonths}')::numeric <> trunc((p_body #>> '{preset,termMonths}')::numeric)
          or (p_body #>> '{preset,termMonths}')::numeric not between 1 and 60) then
    return 'termMonths must be empty or a whole number of months from 1 to 60';
  end if;
  if jsonb_typeof(p_body #> '{preset,lines}') <> 'array' then
    return 'preset lines must be a list';
  end if;
  if jsonb_array_length(p_body #> '{preset,lines}') > 20 then
    return 'preset has more than 20 lines';
  end if;
  for v_line in select e from jsonb_array_elements(p_body #> '{preset,lines}') e loop
    if not private.jsonb_has_exactly_keys(v_line, array['description', 'visitMonths', 'assetTypeCodes', 'costPerVisitCents'])
       or jsonb_typeof(v_line -> 'description') <> 'string'
       or char_length(btrim(v_line ->> 'description')) not between 1 and 2000 then
      return 'a preset line must be { description, visitMonths, assetTypeCodes, costPerVisitCents } with a description';
    end if;
    if jsonb_typeof(v_line -> 'visitMonths') <> 'array' or jsonb_array_length(v_line -> 'visitMonths') not between 1 and 12 then
      return 'a preset line needs 1 to 12 visit months';
    end if;
    v_seen := '{}';
    for v_month in select e from jsonb_array_elements(v_line -> 'visitMonths') e loop
      if jsonb_typeof(v_month) <> 'number' or (v_month #>> '{}')::numeric <> trunc((v_month #>> '{}')::numeric)
         or (v_month #>> '{}')::numeric not between 1 and 12 then
        return 'a visit month must be a whole number from 1 to 12';
      end if;
      v_value := (v_month #>> '{}')::numeric::integer;
      if v_value = any (v_seen) then
        return 'a visit month is repeated';
      end if;
      v_seen := v_seen || v_value;
    end loop;
    if jsonb_typeof(v_line -> 'assetTypeCodes') <> 'array' then
      return 'assetTypeCodes must be a list';
    end if;
    for v_code in select e from jsonb_array_elements(v_line -> 'assetTypeCodes') e loop
      if jsonb_typeof(v_code) <> 'string' or char_length(btrim(v_code #>> '{}')) not between 1 and 80 then
        return 'an equipment type code must be 1 to 80 characters';
      end if;
    end loop;
    if jsonb_typeof(v_line -> 'costPerVisitCents') <> 'null'
       and (jsonb_typeof(v_line -> 'costPerVisitCents') <> 'number'
            or (v_line ->> 'costPerVisitCents')::numeric <> trunc((v_line ->> 'costPerVisitCents')::numeric)
            or (v_line ->> 'costPerVisitCents')::numeric not between 0 and 1000000000000) then
      return 'a price per visit must be empty or a whole number of cents, not negative';
    end if;
  end loop;
  return null;
end $$;

revoke execute on function private.agreement_template_problem(jsonb) from public, anon, authenticated;

-- Door 1, contract side: schema 1 { schema, blocks } or schema 2 { schema, doc, layout } with the contract's sections.
create function private.contract_wording_problem(p_body jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_block jsonb;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    return 'the body must be an object';
  end if;
  if octet_length(p_body::text) > 65536 then
    return 'the body is over 64 KB';
  end if;
  if p_body -> 'schema' = '2'::jsonb then
    if not private.jsonb_has_exactly_keys(p_body, array['schema', 'doc', 'layout']) then
      return 'the body must have exactly the keys schema, doc and layout';
    end if;
    return private.layout_problem(p_body -> 'doc', p_body -> 'layout', array['price', 'schedule', 'included', 'equipment', 'signatures'],
                                  array['price', 'signatures']);
  end if;
  if not private.jsonb_has_exactly_keys(p_body, array['schema', 'blocks']) or p_body -> 'schema' <> '1'::jsonb then
    return 'the body must be { schema: 1, blocks } or { schema: 2, doc, layout }';
  end if;
  if jsonb_typeof(p_body -> 'blocks') <> 'array' then
    return 'blocks must be a list';
  end if;
  if jsonb_array_length(p_body -> 'blocks') > 60 then
    return 'blocks has more than 60 blocks';
  end if;
  for v_block in select e from jsonb_array_elements(p_body -> 'blocks') e loop
    if not private.jsonb_has_exactly_keys(v_block, array['type', 'text'])
       or v_block ->> 'type' is null or v_block ->> 'type' not in ('heading', 'paragraph', 'clause')
       or not private.jsonb_text_between(v_block -> 'text', 1, 2000) then
      return 'a block must be a heading, paragraph or clause of 1 to 2,000 characters';
    end if;
  end loop;
  return null;
end $$;

revoke execute on function private.contract_wording_problem(jsonb) from public, anon, authenticated;

-- Door 2. Saves the caller's org's contract wording: the org's contract template is created by the first call and every call adds
-- the next immutable version. 42501 for a caller who is no member of any org or not owner or admin of it; 22023 for a body that
-- cannot be stored.
create function public.save_contract_template(p_body jsonb)
returns table (template_id uuid, version_no integer)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_template uuid;
  v_problem text;
  v_no integer;
begin
  if v_user is null then
    raise exception 'not allowed to save contract wording' using errcode = '42501';
  end if;
  select m.org_id into v_org from public.memberships m where m.user_id = v_user limit 1;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to save contract wording' using errcode = '42501';
  end if;

  v_problem := private.contract_wording_problem(p_body);
  if v_problem is not null then
    raise exception 'invalid contract wording: %', v_problem using errcode = '22023';
  end if;

  -- Two saves in one org take turns, so neither creates the template or reads a version number the other is about to take.
  perform pg_advisory_xact_lock(hashtextextended('contract_template:' || v_org::text, 0));
  select t.id into v_template from public.document_templates t where t.org_id = v_org and t.kind = 'contract';
  if v_template is null then
    insert into public.document_templates (org_id, kind) values (v_org, 'contract') returning id into v_template;
  end if;
  select coalesce(max(tv.version_no), 0) + 1 into v_no from public.document_template_versions tv where tv.template_id = v_template;
  insert into public.document_template_versions (template_id, org_id, version_no, body) values (v_template, v_org, v_no, p_body);
  return query select v_template, v_no;
end $$;

revoke execute on function public.save_contract_template(jsonb) from public, anon;
grant execute on function public.save_contract_template(jsonb) to authenticated;
