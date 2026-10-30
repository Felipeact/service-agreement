-- Cadence: visit months on a service line, the equipment types a line covers, default months per type
-- (.specs/features/cadence, doors 1 to 7).
-- Checked on the live project before this migration (2026-10-30): 14 service lines, none with visits_per_year > 12;
-- 40 asset types, every code in the catalog. AG-1046 v1 and AG-1048 v1, v2 have 4 visits each.

-- Door 1 rule: non-empty, strictly ascending, every value in 1..12. Check constraints call it as the writing member.
create function private.is_visit_months(p_months smallint[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select p_months is not null
     and cardinality(p_months) >= 1
     and array_ndims(p_months) = 1
     and not exists (select 1 from unnest(p_months) as m(v) where m.v is null or m.v not between 1 and 12)
     and not exists (select 1 from generate_subscripts(p_months, 1) as i
                     where i > array_lower(p_months, 1) and p_months[i] <= p_months[i - 1])
$$;

revoke execute on function private.is_visit_months(smallint[]) from public, anon;
grant execute on function private.is_visit_months(smallint[]) to authenticated;

-- Door 5: n visits a year -> months. Raises for n outside 1..12, so a backfill over a line with more aborts.
create function private.months_for_visits(n integer)
returns smallint[]
language plpgsql immutable
set search_path = ''
as $$
begin
  if n is null or n < 1 or n > 12 then
    raise exception 'no visit months for % visits a year', n using errcode = '22023';
  end if;
  return case n
    when 2 then '{4,10}'::smallint[]
    when 4 then '{3,6,9,12}'::smallint[]
    when 12 then '{1,2,3,4,5,6,7,8,9,10,11,12}'::smallint[]
    else (select array_agg((1 + floor(i * 12.0 / n))::smallint order by i) from generate_series(0, n - 1) as i)
  end;
end $$;

revoke execute on function private.months_for_visits(integer) from public, anon, authenticated;

-- Door 1: the months on the line; visits per year is their number.
alter table public.service_lines add column visit_months smallint[];
update public.service_lines set visit_months = private.months_for_visits(visits_per_year);
alter table public.service_lines
  alter column visit_months set not null,
  add constraint service_lines_visit_months_check check (private.is_visit_months(visit_months)),
  add constraint service_lines_visits_match_months check (visits_per_year = cardinality(visit_months)),
  add constraint service_lines_id_org_id_key unique (id, org_id);

-- Door 3: default months per type, in the catalog and in each org's copy.
alter table private.catalog_asset_types add column default_visit_months smallint[];
update private.catalog_asset_types c set default_visit_months = d.months
from (values
  ('{3,6,9,12}'::smallint[], array['AHU', 'CASE_COOLER', 'CASE_FREEZER', 'CHILLER', 'COOLING_TOWER', 'DUCTLESS_SPLIT', 'ERV',
                                   'FAN_COIL', 'HRV', 'ICE_MACHINE', 'MINI_VRF', 'MUA', 'PTAC', 'RTU', 'UNITARY_SPLIT',
                                   'VRF_OUTDOOR', 'WALK_IN_COOLER', 'WALK_IN_FREEZER', 'WSHP']),
  ('{4,10}'::smallint[], array['AIR_SEPARATOR', 'CO_SENSOR', 'EXHAUST_FAN', 'HEAT_EXCHANGER', 'PUMP', 'SIDE_STREAM_FILTER',
                               'SUPPLY_FAN', 'WYE_STRAINER']),
  ('{10}'::smallint[], array['ACID_NEUTRALIZER', 'BACKFLOW_PREVENTER', 'BOILER', 'EXPANSION_TANK', 'FIRE_DAMPER', 'FURNACE',
                             'HWT_HIGH_EFFICIENCY', 'HWT_MID_EFFICIENCY', 'INDIRECT_TANK', 'PRESSURE_REGULATING_VALVE',
                             'STORAGE_TANK', 'UNIT_HEATER_ELECTRIC', 'UNIT_HEATER_GAS'])
) as d(months, codes)
where c.code = any (d.codes);
alter table private.catalog_asset_types
  alter column default_visit_months set not null,
  add constraint catalog_asset_types_default_visit_months_check check (private.is_visit_months(default_visit_months));

alter table public.asset_types add column default_visit_months smallint[];
update public.asset_types t
set default_visit_months = coalesce((select c.default_visit_months from private.catalog_asset_types c where c.code = t.code),
                                    '{3,6,9,12}');
alter table public.asset_types
  alter column default_visit_months set default '{3,6,9,12}',
  alter column default_visit_months set not null,
  add constraint asset_types_default_visit_months_check check (private.is_visit_months(default_visit_months));

-- As 20261019191509_catalog_template.sql (AD-008), and each inserted type carries the catalog's default months.
create or replace function private.seed_org_catalog(p_org uuid) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  with inserted as (
    insert into public.asset_types (org_id, code, name, default_visit_months)
    select p_org, c.code, c.name, c.default_visit_months
    from private.catalog_asset_types c
    on conflict (org_id, code) do nothing
    returning id, code
  ),
  tasks as (
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description)
    select p_org, i.id, t.position, t.description
    from inserted i
    join private.catalog_asset_type_tasks t on t.code = i.code
  )
  select count(*) into n from inserted;
  return n;
end $$;

revoke execute on function private.seed_org_catalog(uuid) from public, anon, authenticated;

-- Door 2: the equipment types a line covers.
create table public.service_line_asset_types (
  org_id uuid not null references public.orgs (id) on delete cascade,
  service_line_id uuid not null,
  asset_type_id uuid not null,
  primary key (service_line_id, asset_type_id),
  foreign key (service_line_id, org_id) references public.service_lines (id, org_id) on delete cascade,
  foreign key (asset_type_id, org_id) references public.asset_types (id, org_id)
);
create index service_line_asset_types_org_id_idx on public.service_line_asset_types (org_id);
create index service_line_asset_types_service_line_id_idx on public.service_line_asset_types (service_line_id, org_id);
create index service_line_asset_types_asset_type_id_idx on public.service_line_asset_types (asset_type_id, org_id);

revoke insert, update, delete, truncate, references, trigger on public.service_line_asset_types from anon;
revoke truncate, references, trigger on public.service_line_asset_types from authenticated;
alter table public.service_line_asset_types enable row level security;

-- As service_lines (20261019174738_init.sql): members read, everyone but viewers write.
create policy service_line_asset_types_select on public.service_line_asset_types for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy service_line_asset_types_insert on public.service_line_asset_types for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy service_line_asset_types_update on public.service_line_asset_types for update to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])))
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy service_line_asset_types_delete on public.service_line_asset_types for delete to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));

-- AD-054's rule for coverage: a member changes it only for a line on the latest version of a draft agreement, read
-- `for share`. Without a signed-in user the trigger stands aside. A line that is not found passes: the foreign key
-- decides an insert, and a line already deleted (the cascade of a permitted line delete) frees its rows.
create function private.service_line_asset_types_frozen()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_lines uuid[] := '{}';
  v_orgs uuid[] := '{}';
  v_version uuid;
  v_status text;
  v_latest boolean;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op <> 'INSERT' then
    v_lines := v_lines || old.service_line_id;
    v_orgs := v_orgs || old.org_id;
  end if;
  if tg_op <> 'DELETE' then
    v_lines := v_lines || new.service_line_id;
    v_orgs := v_orgs || new.org_id;
  end if;
  for i in 1 .. array_length(v_lines, 1) loop
    select l.agreement_version_id into v_version
    from public.service_lines l where l.id = v_lines[i] and l.org_id = v_orgs[i];
    continue when not found;
    select a.status,
           v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)
      into v_status, v_latest
    from public.agreement_versions v
    join public.agreements a on a.id = v.agreement_id
    where v.id = v_version and v.org_id = v_orgs[i]
    for share of a;
    if found and not (v_status = 'draft' and v_latest) then
      raise exception 'agreement version % can no longer be changed', v_version using errcode = '55000';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function private.service_line_asset_types_frozen() from public, anon, authenticated;

create trigger service_line_asset_types_frozen before insert or update or delete on public.service_line_asset_types
  for each row execute function private.service_line_asset_types_frozen();

-- Existing lines with no coverage get it: a frozen version (any but the current version of a draft, AD-062) covers the
-- org's types named in its snapshot, the current version of a draft the types with an asset on its site. A line that
-- already covers something is left alone, so a re-run adds nothing. Used here and by supabase/seed.sql.
create function private.backfill_line_coverage()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
  select l.org_id, l.id, t.id
  from public.service_lines l
  join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
  join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  join public.asset_types t on t.org_id = l.org_id
  where not exists (select 1 from public.service_line_asset_types c where c.service_line_id = l.id)
    and case
          when v.snapshot ? 'types'
               and not (a.status = 'draft'
                        and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)) then
            t.code in (select e ->> 'code' from jsonb_array_elements(coalesce(v.snapshot -> 'types', '[]'::jsonb)) as e)
          else
            exists (select 1 from public.assets s where s.site_id = a.site_id and s.org_id = a.org_id and s.asset_type_id = t.id)
        end
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function private.backfill_line_coverage() from public, anon, authenticated;

select private.backfill_line_coverage();

-- Door 4: a line and its coverage in one write. A null line id adds the line after the last one of the agreement's
-- latest version. P0002: agreement or line missing or outside the caller's orgs. 42501: not a writer. 23514: no type,
-- or months the door 1 rule refuses. 23503: a type of another org. 54000: the version already has 50 lines.
-- 55000: the version can no longer be changed (the triggers).
create function public.save_service_line(
  p_agreement_id uuid,
  p_line_id uuid,
  p_description text,
  p_visit_months smallint[],
  p_cost_per_visit_cents bigint,
  p_asset_type_ids uuid[]
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
  v_line uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;
  if p_visit_months is null or coalesce(cardinality(p_asset_type_ids), 0) = 0 then
    raise exception 'a service line needs visit months and at least one equipment type' using errcode = '23514';
  end if;

  if p_line_id is null then
    -- Two adds on one agreement take turns here, so they cannot both pass the count or take the same position.
    perform pg_advisory_xact_lock(hashtextextended('service_lines:' || p_agreement_id::text, 0));
    select v.id into v_version from public.agreement_versions v
    where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
    if v_version is null then
      raise exception 'agreement % has no version', p_agreement_id using errcode = 'P0002';
    end if;
    if (select count(*) from public.service_lines l where l.agreement_version_id = v_version) >= 50 then
      raise exception 'agreement % already has 50 service lines', p_agreement_id using errcode = '54000';
    end if;
    insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                      cost_per_visit_cents)
    values (v_org, v_version,
            coalesce((select max(l.position) + 1 from public.service_lines l where l.agreement_version_id = v_version), 0),
            p_description, p_visit_months, cardinality(p_visit_months), p_cost_per_visit_cents)
    returning id into v_line;
  else
    update public.service_lines l
    set description = p_description, visit_months = p_visit_months, visits_per_year = cardinality(p_visit_months),
        cost_per_visit_cents = p_cost_per_visit_cents
    where l.id = p_line_id
      and l.agreement_version_id in (select v.id from public.agreement_versions v where v.agreement_id = p_agreement_id)
    returning l.id into v_line;
    if v_line is null then
      raise exception 'service line % not found', p_line_id using errcode = 'P0002';
    end if;
    delete from public.service_line_asset_types c where c.service_line_id = v_line;
  end if;

  insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
  select distinct v_org, v_line, t.id from unnest(p_asset_type_ids) as t(id);
  return v_line;
end $$;

revoke execute on function public.save_service_line(uuid, uuid, text, smallint[], bigint, uuid[]) from public, anon;
grant execute on function public.save_service_line(uuid, uuid, text, smallint[], bigint, uuid[]) to authenticated;

-- AD-055 amended: a revision copies each line with its months and the types it covers.
-- Otherwise as 20261027212052_service_included.sql: same signature and grants.
create or replace function public.apply_agreement_transition(
  p_agreement_id uuid,
  p_expected_status text,
  p_to_status text,
  p_event_type text,
  p_payload jsonb
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_version integer;
  v_from uuid;
  v_to uuid;
  v_event uuid;
  v_line record;
  v_copy uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;

  update public.agreements set status = p_to_status, updated_at = now()
  where id = p_agreement_id and status = p_expected_status;
  if not found then
    raise exception 'agreement % is no longer %', p_agreement_id, p_expected_status using errcode = '40001';
  end if;

  -- A draft that stops being a draft keeps what it covered at that moment.
  if p_expected_status = 'draft' then
    perform private.freeze_agreement_version(p_agreement_id);
  end if;

  -- A revision starts the next version from the content of the current one: its snapshot, its lines and their coverage.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot)
    values (v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(
      (select v.snapshot from public.agreement_versions v where v.id = v_from), '{}'))
    returning id into v_to;
    for v_line in
      select l.id, l.org_id, l.position, l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents
      from public.service_lines l
      where l.agreement_version_id = v_from
      order by l.position, l.created_at
    loop
      insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                        cost_per_visit_cents)
      values (v_line.org_id, v_to, v_line.position, v_line.description, v_line.visit_months, v_line.visits_per_year,
              v_line.cost_per_visit_cents)
      returning id into v_copy;
      insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
      select c.org_id, v_copy, c.asset_type_id from public.service_line_asset_types c where c.service_line_id = v_line.id;
    end loop;
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;

-- Door 6: each line also carries its visit months and the equipment it covers.
-- Otherwise as 20261028053639_customer_portal.sql: same signature and grants.
create or replace function public.portal_view(p_token_hash text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_link public.portal_links;
  v_version public.agreement_versions;
  v_agreement public.agreements;
  v_current boolean;
  v_decision jsonb;
  v_tenant jsonb;
begin
  select * into v_link from public.portal_links l where l.token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  select * into v_version from public.agreement_versions v where v.id = v_link.agreement_version_id and v.org_id = v_link.org_id;
  select * into v_agreement from public.agreements a where a.id = v_version.agreement_id and a.org_id = v_link.org_id;
  v_current := v_version.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = v_agreement.id);

  if v_agreement.status in ('accepted', 'refused', 'changes_requested') then
    select jsonb_build_object('status', v_agreement.status, 'decidedAt', e.created_at, 'reason', e.payload -> 'reason')
    into v_decision
    from public.events e
    where e.org_id = v_agreement.org_id and e.entity_type = 'agreement' and e.entity_id = v_agreement.id
      and e.type = 'agreement.' || v_agreement.status
    order by e.created_at desc, e.id limit 1;
  end if;

  select jsonb_build_object('name', s.legal_name, 'address', s.address, 'phone', s.phone, 'accent', s.accent_color)
  into v_tenant from public.org_settings s where s.org_id = v_link.org_id;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'versionNo', v_version.version_no,
      'current', v_current,
      'revoked', v_link.revoked_at is not null,
      'revokedAt', v_link.revoked_at,
      'firstViewedAt', v_link.first_viewed_at),
    'agreement', jsonb_build_object('number', v_agreement.number, 'status', v_agreement.status),
    'tenant', v_tenant,
    'customer', (select jsonb_build_object('name', c.name) from public.sites s
                 join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                 where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                  'description', l.description,
                  'visitsPerYear', l.visits_per_year,
                  'costPerVisitCents', l.cost_per_visit_cents,
                  'annualCents', l.visits_per_year * l.cost_per_visit_cents,
                  'visitMonths', to_jsonb(l.visit_months),
                  'equipment', coalesce((select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name) order by t.name, t.code)
                                         from public.service_line_asset_types c
                                         join public.asset_types t on t.id = c.asset_type_id and t.org_id = c.org_id
                                         where c.service_line_id = l.id and c.org_id = l.org_id), '[]'::jsonb))
                order by l.position, l.created_at, l.id)
              from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), '[]'::jsonb),
    'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents)
                             from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), 0),
    'scope', case when v_version.snapshot = '{}'::jsonb then null else v_version.snapshot - 'terms' end,
    'terms', v_version.snapshot -> 'terms',
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;
