-- other-trade-draft door 2 (.specs/features/other-trade-draft/plan.md): an owner or admin of an org with no types adds a reviewed
-- draft catalog in one transaction. Not applied to the hosted project without the owner's go-ahead.
--
-- p_types is a jsonb array of {name, months, tasks}. Names follow private.clean_type_name (1 to 60 characters with a letter or
-- number), codes are derived exactly as create_task_library_type derives them, and the trade is appended once to
-- org_settings.trade_context. A type made here has pack null, like one made by hand.

create function public.add_catalog_draft(p_org_id uuid, p_trade text, p_types jsonb) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trade text := btrim(coalesce(p_trade, ''));
  v_type jsonb;
  v_name text;
  v_names text[] := '{}';
  v_months smallint[];
  v_base text;
  v_code text;
  v_n integer;
  v_id uuid;
  v_count integer := 0;
  v_pos integer;
  v_task jsonb;
begin
  if not (select private.has_org_role(p_org_id, array['owner', 'admin'])) then
    raise exception 'not allowed to change the task library' using errcode = '42501';
  end if;

  -- Same lock as create_task_library_type, so two adds to one org take turns and the second sees the first's types.
  perform pg_advisory_xact_lock(hashtextextended('task_library_types:' || p_org_id::text, 0));

  if exists (select 1 from public.asset_types where org_id = p_org_id) then
    raise exception 'the catalog is not empty' using errcode = '55000';
  end if;

  if v_trade !~ '^[A-Za-z0-9 ,&/''-]{1,60}$' or v_trade !~ '[A-Za-z0-9]' then
    raise exception 'the trade is 1 to 60 letters, numbers, spaces and , & / '' -' using errcode = '23514';
  end if;
  if p_types is null or jsonb_typeof(p_types) <> 'array' or jsonb_array_length(p_types) not between 1 and 40 then
    raise exception 'a draft holds 1 to 40 types' using errcode = '23514';
  end if;

  for v_type in select value from jsonb_array_elements(p_types) loop
    if jsonb_typeof(v_type) <> 'object' or jsonb_typeof(v_type -> 'name') is distinct from 'string' then
      raise exception 'a drafted type needs a name' using errcode = '23514';
    end if;
    v_name := private.clean_type_name(v_type ->> 'name');
    if lower(v_name) = any (v_names) then
      raise exception 'two drafted types share the name %', v_name using errcode = '23514';
    end if;
    v_names := v_names || lower(v_name);

    if jsonb_typeof(v_type -> 'months') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(v_type -> 'months') m
         where jsonb_typeof(m) <> 'number'
            or (m #>> '{}')::numeric <> trunc((m #>> '{}')::numeric)
            or (m #>> '{}')::numeric not between 1 and 12
       ) then
      raise exception 'months are whole numbers from 1 to 12' using errcode = '23514';
    end if;
    v_months := array(
      select distinct (m #>> '{}')::smallint as v from jsonb_array_elements(v_type -> 'months') m order by v
    );
    if not private.is_visit_months(v_months) then
      raise exception 'a drafted type needs 1 to 12 months' using errcode = '23514';
    end if;

    if jsonb_typeof(v_type -> 'tasks') is distinct from 'array'
       or jsonb_array_length(v_type -> 'tasks') > 12
       or exists (
         select 1 from jsonb_array_elements(v_type -> 'tasks') t
         where jsonb_typeof(t) <> 'string' or char_length(btrim(t #>> '{}')) not between 1 and 200
       ) then
      raise exception 'a type has 0 to 12 tasks of 1 to 200 characters' using errcode = '23514';
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

    insert into public.asset_types (org_id, code, name, default_visit_months)
    values (p_org_id, v_code, v_name, v_months)
    returning id into v_id;

    v_pos := 0;
    for v_task in select value from jsonb_array_elements(v_type -> 'tasks') loop
      v_pos := v_pos + 1;
      insert into public.asset_type_tasks (org_id, asset_type_id, position, description)
      values (p_org_id, v_id, v_pos, btrim(v_task #>> '{}'));
    end loop;

    v_count := v_count + 1;
  end loop;

  update public.org_settings s
  set trade_context = case
    when s.trade_context is null then v_trade
    when v_trade = any (string_to_array(s.trade_context, ', ')) then s.trade_context
    else s.trade_context || ', ' || v_trade
  end
  where s.org_id = p_org_id;

  return v_count;
end $$;

revoke execute on function public.add_catalog_draft(uuid, text, jsonb) from public, anon;
grant execute on function public.add_catalog_draft(uuid, text, jsonb) to authenticated;
