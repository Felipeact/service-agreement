-- AI-created equipment types: Ask AI, the MCP endpoint and the New agreement upload can add a type the catalog lacks (a "Make-up air
-- unit" the customer's list names) so a list never has to stop at "needs a type". `asset_types` is writable by owners and admins only,
-- but estimators run agreements and uploads, so this function lets owners, admins and estimators add ONE type, with the same code
-- rule as `create_task_library_type`. A name the org already has (any case) returns that type instead of making a second one.
create function public.add_equipment_type(p_org_id uuid, p_name text, p_months smallint[] default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_base text;
  v_code text;
  v_n integer := 1;
  v_id uuid;
  v_months smallint[];
  v_found record;
begin
  if not (select private.has_org_role(p_org_id, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to add an equipment type' using errcode = '42501';
  end if;
  v_name := private.clean_type_name(p_name);

  -- Same lock as the other type writers, so two adds to one org take turns and the second sees the first's type.
  perform pg_advisory_xact_lock(hashtextextended('task_library_types:' || p_org_id::text, 0));

  select t.id, t.code, t.name into v_found from public.asset_types t where t.org_id = p_org_id and lower(t.name) = lower(v_name);
  if found then
    return jsonb_build_object('id', v_found.id, 'code', v_found.code, 'name', v_found.name, 'created', false);
  end if;

  v_months := case when p_months is not null and private.is_visit_months(p_months) then p_months else '{3,6,9,12}'::smallint[] end;

  v_base := upper(btrim(regexp_replace(v_name, '[^A-Za-z0-9]+', '_', 'g'), '_'));
  if v_base ~ '^[0-9]' then
    v_base := 'T_' || v_base;
  end if;
  v_base := btrim(left(v_base, 40), '_');
  v_code := v_base;
  while exists (select 1 from public.asset_types where org_id = p_org_id and code = v_code) loop
    v_n := v_n + 1;
    v_code := v_base || '_' || v_n;
  end loop;

  insert into public.asset_types (org_id, code, name, default_visit_months)
  values (p_org_id, v_code, v_name, v_months)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'code', v_code, 'name', v_name, 'created', true);
end $$;

revoke execute on function public.add_equipment_type(uuid, text, smallint[]) from public, anon;
grant execute on function public.add_equipment_type(uuid, text, smallint[]) to authenticated;
