-- Type editor and catalog packs (.specs/features/type-editor/plan.md, doors 1 to 6).
-- Door 1: the template is keyed by (pack, code). Door 2: an org type remembers its pack. Door 3: seed_org_catalog takes
-- a pack. Door 4: names are unique per org ignoring case. Door 5: a code is made from the name, then frozen.
-- Door 6: reset reads the private template, so it is the one definer function.

-- Door 1.
alter table private.catalog_asset_type_tasks drop constraint catalog_asset_type_tasks_code_fkey;
alter table private.catalog_asset_type_tasks drop constraint catalog_asset_type_tasks_pkey;
alter table private.catalog_asset_types drop constraint catalog_asset_types_pkey;

alter table private.catalog_asset_types
  add column pack text not null default 'hvac' check (pack ~ '^[a-z][a-z0-9_]*$'),
  add primary key (pack, code);
alter table private.catalog_asset_type_tasks
  add column pack text not null default 'hvac',
  add primary key (pack, code, position),
  add foreign key (pack, code) references private.catalog_asset_types (pack, code);

-- Door 2.
alter table public.asset_types
  add column pack text,
  add constraint asset_types_pack_check check (pack is null or pack ~ '^[a-z][a-z0-9_]*$');
update public.asset_types t set pack = 'hvac'
where exists (select 1 from private.catalog_asset_types c where c.pack = 'hvac' and c.code = t.code);

-- Door 4. Fails here, rather than deduplicating, if an org already holds two names that differ only by case.
create unique index asset_types_org_name_key on public.asset_types (org_id, lower(name));

-- Door 5.
create function private.asset_types_code_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code or new.org_id is distinct from old.org_id then
    raise exception 'an equipment type code and org cannot change' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger asset_types_code_frozen before update on public.asset_types
  for each row execute function private.asset_types_code_frozen();

-- Door 3: the one-argument call keeps working through the default.
drop function private.seed_org_catalog(uuid);

create function private.seed_org_catalog(p_org uuid, p_pack text default 'hvac') returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if not exists (select 1 from private.catalog_asset_types where pack = p_pack) then
    raise exception 'no catalog pack named %', p_pack using errcode = '22023';
  end if;
  with inserted as (
    insert into public.asset_types (org_id, code, name, default_visit_months, pack)
    select p_org, c.code, c.name, c.default_visit_months, c.pack
    from private.catalog_asset_types c
    where c.pack = p_pack
    on conflict do nothing
    returning id, code
  ),
  tasks as (
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
    select p_org, i.id, t.position, t.description, t.visit_months
    from inserted i
    join private.catalog_asset_type_tasks t on t.pack = p_pack and t.code = i.code
  )
  select count(*) into n from inserted;
  return n;
end $$;

revoke execute on function private.seed_org_catalog(uuid, text) from public, anon, authenticated;

-- The type a code names among the orgs the caller belongs to, preferring one they can write. P0002 when none is
-- visible, 42501 when the caller is not owner/admin there. Explicit filters, so it also holds under definer (door 6).
create function private.library_type_for_write(p_type_code text, out o_id uuid, out o_org uuid, out o_pack text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select t.id, t.org_id, t.pack into o_id, o_org, o_pack
  from public.asset_types t
  where t.code = p_type_code and (select private.is_org_member(t.org_id))
  order by (select private.has_org_role(t.org_id, array['owner', 'admin'])) desc
  limit 1;
  if o_id is null then
    raise exception 'asset type % not found', p_type_code using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(o_org, array['owner', 'admin'])) then
    raise exception 'not allowed to change the task library' using errcode = '42501';
  end if;
end $$;

create function private.clean_type_name(p_name text) returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 60 or v_name !~ '[A-Za-z0-9]' then
    raise exception 'a type name is 1 to 60 characters with a letter or number' using errcode = '23514';
  end if;
  return v_name;
end $$;

revoke execute on function private.library_type_for_write(text), private.clean_type_name(text) from public, anon;
grant execute on function private.library_type_for_write(text), private.clean_type_name(text) to authenticated;

create function public.create_task_library_type(p_org_id uuid, p_name text) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_base text;
  v_code text;
  v_n integer := 1;
begin
  if not (select private.has_org_role(p_org_id, array['owner', 'admin'])) then
    raise exception 'not allowed to change the task library' using errcode = '42501';
  end if;
  v_name := private.clean_type_name(p_name);

  -- Two names can derive one code, so adds to one org take turns.
  perform pg_advisory_xact_lock(hashtextextended('task_library_types:' || p_org_id::text, 0));

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

  insert into public.asset_types (org_id, code, name) values (p_org_id, v_code, v_name);
  return v_code;
end $$;

create function public.rename_task_library_type(p_type_code text, p_name text) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type record;
begin
  select * into v_type from private.library_type_for_write(p_type_code);
  update public.asset_types set name = private.clean_type_name(p_name) where id = v_type.o_id;
end $$;

create function public.remove_task_library_type(p_type_code text) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type record;
begin
  select * into v_type from private.library_type_for_write(p_type_code);
  -- Assets, service lines and import rows keep their foreign keys: 23503 undoes the whole call.
  delete from public.asset_type_tasks where asset_type_id = v_type.o_id;
  delete from public.asset_types where id = v_type.o_id;
end $$;

-- Door 6.
create function public.reset_task_library_type(p_type_code text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type record;
  v_template private.catalog_asset_types;
begin
  select * into v_type from private.library_type_for_write(p_type_code);
  select * into v_template from private.catalog_asset_types where pack = v_type.o_pack and code = p_type_code;
  if v_type.o_pack is null or v_template.code is null then
    raise exception 'no pack template to reset % to', p_type_code using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('task_library:' || v_type.o_id::text, 0));
  update public.asset_types set name = v_template.name, default_visit_months = v_template.default_visit_months
  where id = v_type.o_id;
  delete from public.asset_type_tasks where asset_type_id = v_type.o_id;
  insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
  select v_type.o_org, v_type.o_id, t.position, t.description, t.visit_months
  from private.catalog_asset_type_tasks t
  where t.pack = v_type.o_pack and t.code = p_type_code;
end $$;

revoke execute on function public.create_task_library_type(uuid, text), public.rename_task_library_type(text, text),
  public.remove_task_library_type(text), public.reset_task_library_type(text) from public, anon;
grant execute on function public.create_task_library_type(uuid, text), public.rename_task_library_type(text, text),
  public.remove_task_library_type(text), public.reset_task_library_type(text) to authenticated;
