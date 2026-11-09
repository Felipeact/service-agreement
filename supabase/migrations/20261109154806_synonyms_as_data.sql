-- Synonyms as data and the trade context (.specs/features/synonyms-as-data/plan.md, doors 1 to 3).
-- Door 1: an equipment type lists the other ways a customer's list writes it, in the pack template and in each org's copy.
-- Door 2: a pack is a registered row that carries its trade phrase. Door 3: an org has at most one trade context.

-- Door 1 rule: lowercase, trimmed, 1 to 60 characters, holding a letter or digit; no null element. Check constraints call it
-- as the writing member.
create function private.valid_synonyms(p_synonyms text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_synonyms is not null
     and not exists (
       select 1 from unnest(p_synonyms) as s(v)
       where s.v is null
          or s.v <> lower(btrim(s.v))
          or char_length(s.v) not between 1 and 60
          or s.v !~ '[[:alnum:]]'
     )
$$;

revoke execute on function private.valid_synonyms(text[]) from public, anon;
grant execute on function private.valid_synonyms(text[]) to authenticated;

alter table private.catalog_asset_types
  add column synonyms text[] not null default '{}' check (private.valid_synonyms(synonyms));
alter table public.asset_types
  add column synonyms text[] not null default '{}' check (private.valid_synonyms(synonyms));

-- Door 2: the registry. The trade phrase is 1 to 200 characters of letters, digits, spaces and , & / ' -, with a letter or digit.
create table private.catalog_packs (
  pack text primary key check (pack ~ '^[a-z][a-z0-9_]*$'),
  trade_context text not null check (trade_context ~ '^[A-Za-z0-9 ,&/''-]{1,200}$' and trade_context ~ '[A-Za-z0-9]')
);
revoke all on private.catalog_packs from public, anon, authenticated;

insert into private.catalog_packs (pack, trade_context) values ('hvac', 'HVAC and mechanical');
alter table private.catalog_asset_types add foreign key (pack) references private.catalog_packs (pack);

-- Door 3: null until a pack is seeded into the org or the owner writes one.
alter table public.org_settings
  add column trade_context text check (trade_context ~ '^[A-Za-z0-9 ,&/''-]{1,200}$' and trade_context ~ '[A-Za-z0-9]');

-- The hvac pack's spellings: the SYNONYMS constant in web/domain/imports as it stood before this feature removed it.
do $$
declare
  n integer;
begin
  with pack_synonyms (code, spellings) as (values
    ('AHU', array['air handling unit', 'air handler', 'air handler unit']),
    ('BOILER', array['hot water boiler', 'steam boiler', 'boilers']),
    ('CHILLER', array['water chiller', 'chillers']),
    ('COOLING_TOWER', array['cooling towers']),
    ('DUCTLESS_SPLIT', array['mini split', 'ductless mini split', 'ductless heat pump']),
    ('ERV', array['energy recovery ventilator', 'energy recovery unit']),
    ('EXHAUST_FAN', array['exhaust fans', 'ef', 'roof exhaust fan']),
    ('FAN_COIL', array['fan coil unit', 'fcu']),
    ('FURNACE', array['gas furnace', 'furnaces']),
    ('HEAT_EXCHANGER', array['plate heat exchanger', 'hx']),
    ('HRV', array['heat recovery ventilator']),
    ('ICE_MACHINE', array['ice maker']),
    ('MINI_VRF', array['mini vrf system']),
    ('MUA', array['mau', 'make up air', 'make up air unit', 'makeup air unit', 'make up air handler']),
    ('PTAC', array['packaged terminal ac', 'packaged terminal air conditioner']),
    ('PUMP', array['circulating pump', 'circulation pump', 'pumps']),
    ('RTU', array['rooftop unit', 'rooftop', 'roof top unit', 'roof top', 'rooftop air conditioner', 'packaged rooftop unit']),
    ('STORAGE_TANK', array['storage tanks', 'hot water storage tank']),
    ('SUPPLY_FAN', array['supply fans']),
    ('UNITARY_SPLIT', array['split system', 'unitary split']),
    ('UNIT_HEATER_ELECTRIC', array['electric unit heater']),
    ('UNIT_HEATER_GAS', array['gas unit heater', 'gas fired unit heater']),
    ('VRF_OUTDOOR', array['vrf outdoor unit', 'vrf condenser']),
    ('WSHP', array['water source heat pump', 'water to air heat pump']),
    ('WALK_IN_COOLER', array['walk in cooler', 'walk in refrigerator']),
    ('WALK_IN_FREEZER', array['walk in freezer']),
    ('WYE_STRAINER', array['y strainer', 'wye strainers'])
  )
  update private.catalog_asset_types c set synonyms = p.spellings
  from pack_synonyms p
  where c.pack = 'hvac' and c.code = p.code;
  get diagnostics n = row_count;
  if n <> 27 then
    raise exception 'expected 27 hvac types with spellings, updated %', n;
  end if;
end $$;

-- Copies a pack's spellings onto the org types that came from it, and gives an org that holds an hvac type its trade
-- context. Run by this migration; safe to run again.
create function private.backfill_pack_synonyms() returns void
language sql
security invoker
set search_path = ''
as $$
  update public.asset_types t set synonyms = c.synonyms
  from private.catalog_asset_types c
  where t.pack = c.pack and t.code = c.code;

  update public.org_settings s set trade_context = p.trade_context
  from private.catalog_packs p
  where p.pack = 'hvac'
    and s.trade_context is null
    and exists (select 1 from public.asset_types t where t.org_id = s.org_id and t.pack = 'hvac');
$$;

revoke execute on function private.backfill_pack_synonyms() from public, anon, authenticated;

select private.backfill_pack_synonyms();

-- The seed copies each pack type's spellings and appends the pack's trade phrase once. One UPDATE reads and writes the
-- org's row under its row lock, so two seeds of one org queue. An org with no settings row keeps no context.
create or replace function private.seed_org_catalog(p_org uuid, p_pack text default 'hvac') returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
  v_phrase text;
begin
  if not exists (select 1 from private.catalog_asset_types where pack = p_pack) then
    raise exception 'no catalog pack named %', p_pack using errcode = '22023';
  end if;
  with inserted as (
    insert into public.asset_types (org_id, code, name, default_visit_months, pack, synonyms)
    select p_org, c.code, c.name, c.default_visit_months, c.pack, c.synonyms
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

  select p.trade_context into v_phrase from private.catalog_packs p where p.pack = p_pack;
  update public.org_settings s
  set trade_context = case
    when s.trade_context is null then v_phrase
    when v_phrase = any (string_to_array(s.trade_context, ', ')) then s.trade_context
    else s.trade_context || ', ' || v_phrase
  end
  where s.org_id = p_org;
  return n;
end $$;

-- Reset also restores the spellings (same signature, so the grants stay).
create or replace function public.reset_task_library_type(p_type_code text) returns void
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
  update public.asset_types
  set name = v_template.name, default_visit_months = v_template.default_visit_months, synonyms = v_template.synonyms
  where id = v_type.o_id;
  delete from public.asset_type_tasks where asset_type_id = v_type.o_id;
  insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
  select v_type.o_org, v_type.o_id, t.position, t.description, t.visit_months
  from private.catalog_asset_type_tasks t
  where t.pack = v_type.o_pack and t.code = p_type_code;
end $$;
