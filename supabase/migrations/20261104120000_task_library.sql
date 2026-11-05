-- Task library page (.specs/features/task-library-page, door 3): one function that replaces a type's default visit
-- months and its whole checklist in a single transaction, so a failure part-way leaves the old checklist untouched.
-- No table or column changes. It runs as the caller (security invoker), so the existing owner/admin write policies on
-- asset_types and asset_type_tasks still decide; the role check below only gives a clean SQLSTATE first.
--
-- p_tasks is a JSON array of { "description": text, "visitMonths": [1..12] | null }, in checklist order. Positions
-- follow the array. Raises: P0002 no such type in an org the caller belongs to; 42501 caller is not owner/admin there;
-- 23514 months, description or task list invalid.

create function public.save_task_library_type(
  p_type_code text,
  p_default_months smallint[],
  p_tasks jsonb
)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_type uuid;
  v_task jsonb;
  v_months smallint[];
  v_description text;
  v_position integer := 0;
begin
  -- A member of two orgs with the same code gets the one they can write; RLS hides every other org's types.
  select t.id, t.org_id into v_type, v_org
  from public.asset_types t
  where t.code = p_type_code
  order by (select private.has_org_role(t.org_id, array['owner', 'admin'])) desc
  limit 1;
  if v_type is null then
    raise exception 'asset type % not found', p_type_code using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to change the task library' using errcode = '42501';
  end if;
  if not private.is_visit_months(p_default_months) then
    raise exception 'default visit months must be ascending months 1 to 12' using errcode = '23514';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'tasks must be a JSON array' using errcode = '23514';
  end if;

  -- Two admins saving one type take turns; the last one wins.
  perform pg_advisory_xact_lock(hashtextextended('task_library:' || v_type::text, 0));

  update public.asset_types set default_visit_months = p_default_months where id = v_type;
  delete from public.asset_type_tasks where asset_type_id = v_type;

  for v_task in select value from jsonb_array_elements(p_tasks) loop
    v_description := btrim(v_task ->> 'description');
    if v_description is null or char_length(v_description) not between 1 and 200 then
      raise exception 'a task description must be 1 to 200 characters' using errcode = '23514';
    end if;
    if v_task -> 'visitMonths' is null or jsonb_typeof(v_task -> 'visitMonths') = 'null' then
      v_months := null;
    else
      v_months := array(select e.m::smallint from jsonb_array_elements_text(v_task -> 'visitMonths') as e(m));
      if not private.is_visit_months(v_months) then
        raise exception 'task visit months must be ascending months 1 to 12' using errcode = '23514';
      end if;
    end if;
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
    values (v_org, v_type, v_position, v_description, v_months);
    v_position := v_position + 1;
  end loop;
end $$;

revoke execute on function public.save_task_library_type(text, smallint[], jsonb) from public, anon;
grant execute on function public.save_task_library_type(text, smallint[], jsonb) to authenticated;
