-- "Other" trade catalog draft (.specs/features/other-trade-draft/plan.md, door 1): one function that adds a reviewed draft of types,
-- with their default visit months, spellings and checklists, in a single transaction. No table or column changes.
--
-- Runs as the caller (security invoker), so the owner/admin write policies on asset_types and asset_type_tasks still decide; the role
-- check below only gives a clean SQLSTATE first. A drafted type has pack null (a type made by hand, AD-154) and a code made from its
-- name by the rule of create_task_library_type (AD-155).
--
-- p_types is a JSON array of
--   { "name": text, "defaultVisitMonths": [1..12], "synonyms": [text], "tasks": [{ "description": text }] }
-- at most 30 types and 40 tasks each. Returns the new codes in input order.
-- Raises: 42501 caller is not owner/admin of the org; 23505 a name already exists in the org (hint = the name), including a
-- name repeated inside the list; 23514 anything else invalid. Nothing is written when any type fails.

create function public.add_catalog_types(p_org_id uuid, p_types jsonb)
returns text[]
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_type jsonb;
  v_task jsonb;
  v_name text;
  v_base text;
  v_code text;
  v_n integer;
  v_months smallint[];
  v_synonyms text[];
  v_description text;
  v_id uuid;
  v_position integer;
  v_codes text[] := '{}';
begin
  if not (select private.has_org_role(p_org_id, array['owner', 'admin'])) then
    raise exception 'not allowed to change the task library' using errcode = '42501';
  end if;
  if p_types is null or jsonb_typeof(p_types) <> 'array' or jsonb_array_length(p_types) not between 1 and 30 then
    raise exception 'a draft holds 1 to 30 types' using errcode = '23514';
  end if;

  -- Adds to one org take turns, as create_task_library_type does.
  perform pg_advisory_xact_lock(hashtextextended('task_library_types:' || p_org_id::text, 0));

  for v_type in select value from jsonb_array_elements(p_types) loop
    v_name := private.clean_type_name(v_type ->> 'name');
    if exists (select 1 from public.asset_types where org_id = p_org_id and lower(name) = lower(v_name)) then
      raise exception 'a type named % already exists', v_name using errcode = '23505', hint = v_name;
    end if;

    if jsonb_typeof(v_type -> 'defaultVisitMonths') is distinct from 'array' then
      raise exception 'default visit months must be ascending months 1 to 12' using errcode = '23514';
    end if;
    v_months := array(select e.m::smallint from jsonb_array_elements_text(v_type -> 'defaultVisitMonths') as e(m));
    if cardinality(v_months) = 0 or not private.is_visit_months(v_months) then
      raise exception 'default visit months must be ascending months 1 to 12' using errcode = '23514';
    end if;

    if jsonb_typeof(v_type -> 'synonyms') is distinct from 'array' then
      raise exception 'synonyms must be a JSON array' using errcode = '23514';
    end if;
    v_synonyms := array(select e.s from jsonb_array_elements_text(v_type -> 'synonyms') as e(s));
    if not private.valid_synonyms(v_synonyms) then
      raise exception 'a spelling is lowercase, 1 to 60 characters, with a letter or digit' using errcode = '23514';
    end if;

    if jsonb_typeof(v_type -> 'tasks') is distinct from 'array' or jsonb_array_length(v_type -> 'tasks') not between 1 and 40 then
      raise exception 'a type holds 1 to 40 tasks' using errcode = '23514';
    end if;

    v_base := upper(btrim(regexp_replace(v_name, '[^A-Za-z0-9]+', '_', 'g'), '_'));
    if v_base ~ '^[0-9]' then
      v_base := 'T_' || v_base;
    end if;
    v_base := btrim(left(v_base, 40), '_');
    v_code := v_base;
    v_n := 1;
    while exists (select 1 from public.asset_types where org_id = p_org_id and code = v_code) loop
      v_n := v_n + 1;
      v_code := v_base || '_' || v_n;
    end loop;

    insert into public.asset_types (org_id, code, name, default_visit_months, synonyms)
    values (p_org_id, v_code, v_name, v_months, v_synonyms)
    returning id into v_id;

    v_position := 0;
    for v_task in select value from jsonb_array_elements(v_type -> 'tasks') loop
      v_description := btrim(v_task ->> 'description');
      if v_description is null or char_length(v_description) not between 1 and 200 then
        raise exception 'a task description must be 1 to 200 characters' using errcode = '23514';
      end if;
      insert into public.asset_type_tasks (org_id, asset_type_id, position, description)
      values (p_org_id, v_id, v_position, v_description);
      v_position := v_position + 1;
    end loop;

    v_codes := v_codes || v_code;
  end loop;
  return v_codes;
end $$;

revoke execute on function public.add_catalog_types(uuid, jsonb) from public, anon;
grant execute on function public.add_catalog_types(uuid, jsonb) to authenticated;
