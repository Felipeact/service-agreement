-- P0 launch fixes (.specs/features/p0-launch-fixes/): an agreement's scope follows its priced lines, a contractor can leave
-- one asset out, and an org confirms its company details before it sends.
-- NOT applied to the hosted project: applying it needs the owner's go-ahead.

-- Door 3: the confirmation marker. Null means unconfirmed. Set by the settings save, never by this migration for an
-- org whose details look like the demo seed (names, address or phone that match a known placeholder shape).
alter table public.org_settings add column company_confirmed_at timestamptz;

update public.org_settings s
set company_confirmed_at = now()
where btrim(coalesce(s.legal_name, '')) <> ''
  and btrim(coalesce(s.address, '')) <> ''
  and btrim(coalesce(s.phone, '')) <> ''
  and s.legal_name !~* 'kettle ridge'
  and s.address !~* 'sample street'
  and s.address !~* '0a0\s*$'
  and s.phone !~ '555[-. ]?01[0-9][0-9]';

-- Door 2: one row per asset an agreement version leaves out. Written only by set_scope_exclusion and
-- private.copy_scope_exclusions (both security definer); members read.
create table public.agreement_scope_exclusions (
  org_id uuid not null references public.orgs (id) on delete cascade,
  agreement_version_id uuid not null,
  asset_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (agreement_version_id, asset_id),
  foreign key (agreement_version_id, org_id) references public.agreement_versions (id, org_id) on delete cascade,
  foreign key (asset_id, org_id) references public.assets (id, org_id) on delete cascade
);
create index agreement_scope_exclusions_org_id_idx on public.agreement_scope_exclusions (org_id);
create index agreement_scope_exclusions_asset_id_idx on public.agreement_scope_exclusions (asset_id, org_id);

revoke all on public.agreement_scope_exclusions from anon, authenticated;
grant select on public.agreement_scope_exclusions to authenticated;
alter table public.agreement_scope_exclusions enable row level security;
create policy agreement_scope_exclusions_select on public.agreement_scope_exclusions for select to authenticated
  using ((select private.is_org_member(org_id)));

-- Door 1: the scope of an agreement's current version. `types` is the document service-included door 1 froze (schema 2),
-- kept to the assets whose type a line covers and that are not excluded. `uncovered` and `controls` are for the draft page
-- and the Send check only; the freeze drops them, so a snapshot never holds an asset id.
create function public.agreement_service_scope(p_agreement_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with ver as (
    select v.id as version_id, a.site_id, a.org_id
    from public.agreements a
    join public.agreement_versions v on v.agreement_id = a.id and v.org_id = a.org_id
    where a.id = p_agreement_id
    order by v.version_no desc
    limit 1
  ),
  covered as (
    select distinct c.asset_type_id
    from ver
    join public.service_lines l on l.agreement_version_id = ver.version_id and l.org_id = ver.org_id
    join public.service_line_asset_types c on c.service_line_id = l.id and c.org_id = l.org_id
  ),
  live as (
    select a.id as asset_id, a.asset_type_id, a.org_id, a.unit_no, a.type_model, a.location, a.created_at,
           t.code, t.name as type_name,
           exists (select 1 from public.agreement_scope_exclusions x
                   where x.agreement_version_id = ver.version_id and x.asset_id = a.id) as excluded,
           a.asset_type_id in (select asset_type_id from covered) as is_covered
    from ver
    join public.assets a on a.site_id = ver.site_id and a.org_id = ver.org_id and a.deactivated_at is null
    join public.asset_types t on t.id = a.asset_type_id and t.org_id = a.org_id
  )
  select jsonb_build_object(
    'schema', 2,
    'types', coalesce((
      select jsonb_agg(g.doc order by g.type_name, g.code)
      from (
        select l.code, l.type_name, jsonb_build_object(
          'code', l.code,
          'name', l.type_name,
          'tasks', coalesce((select jsonb_agg(jsonb_build_object('description', k.description, 'visitMonths', to_jsonb(k.visit_months))
                                              order by k.position, k.created_at, k.id)
                             from public.asset_type_tasks k
                             where k.asset_type_id = l.asset_type_id and k.org_id = l.org_id), '[]'::jsonb),
          'assets', jsonb_agg(jsonb_build_object('unitNo', l.unit_no, 'typeModel', l.type_model, 'location', l.location)
                              order by l.unit_no nulls last, l.created_at, l.asset_id)
        ) as doc
        from live l
        where l.is_covered and not l.excluded
        group by l.asset_type_id, l.org_id, l.code, l.type_name
      ) g
    ), '[]'::jsonb),
    'uncovered', coalesce((
      select jsonb_agg(jsonb_build_object('code', u.code, 'name', u.type_name, 'assetCount', u.n) order by u.type_name, u.code)
      from (select l.code, l.type_name, count(*) as n from live l where not l.is_covered
            group by l.asset_type_id, l.code, l.type_name) u
    ), '[]'::jsonb),
    'controls', coalesce((
      select jsonb_agg(jsonb_build_object('assetId', l.asset_id, 'typeCode', l.code, 'typeName', l.type_name, 'unitNo', l.unit_no,
                                          'typeModel', l.type_model, 'location', l.location, 'excluded', l.excluded)
                       order by l.type_name, l.unit_no nulls last, l.created_at, l.asset_id)
      from live l where l.is_covered
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.agreement_service_scope(uuid) from public, anon;
grant execute on function public.agreement_service_scope(uuid) to authenticated;

-- Door 2's writer. 42501 for a caller who may not write the agreement (a viewer, another org, a frozen org), P0002 for a
-- version that does not exist, P0001 unless the version is the current version of a draft, 23514 for an asset that is not
-- on the agreement's site.
create function public.set_scope_exclusion(p_version_id uuid, p_asset_id uuid, p_excluded boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_agreement uuid;
  v_site uuid;
  v_status text;
  v_current boolean;
begin
  select v.org_id, v.agreement_id, a.site_id, a.status,
         v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = v.agreement_id)
  into v_org, v_agreement, v_site, v_status, v_current
  from public.agreement_versions v join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  where v.id = p_version_id;
  if v_org is null then
    raise exception 'agreement version % not found', p_version_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change the scope of version %', p_version_id using errcode = '42501';
  end if;
  if v_status is distinct from 'draft' or not v_current then
    raise exception 'version % can no longer be changed', p_version_id using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.assets s where s.id = p_asset_id and s.org_id = v_org and s.site_id = v_site) then
    raise exception 'asset % is not on the agreement''s site', p_asset_id using errcode = '23514';
  end if;

  if p_excluded then
    insert into public.agreement_scope_exclusions (org_id, agreement_version_id, asset_id)
    values (v_org, p_version_id, p_asset_id)
    on conflict do nothing;
  else
    delete from public.agreement_scope_exclusions where agreement_version_id = p_version_id and asset_id = p_asset_id;
  end if;
end $$;

revoke execute on function public.set_scope_exclusion(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_scope_exclusion(uuid, uuid, boolean) to authenticated;

-- A revision starts from the exclusions of the version it copies (assumption A2). Called only from
-- apply_agreement_transition, which is security invoker and so cannot write the table itself.
create function private.copy_scope_exclusions(p_from uuid, p_to uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select v.org_id into v_org from public.agreement_versions v where v.id = p_to;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to copy scope exclusions to version %', p_to using errcode = '42501';
  end if;
  insert into public.agreement_scope_exclusions (org_id, agreement_version_id, asset_id)
  select x.org_id, p_to, x.asset_id from public.agreement_scope_exclusions x
  where x.agreement_version_id = p_from and x.org_id = v_org;
end $$;

-- authenticated may execute it because the invoker RPC calls it (as private.freeze_agreement_version, 20261027212052); the
-- function itself requires the writer role.
revoke execute on function private.copy_scope_exclusions(uuid, uuid) from public, anon;
grant execute on function private.copy_scope_exclusions(uuid, uuid) to authenticated;

-- Door 1 at freeze: the snapshot is the same scope the draft showed, minus the draft-only keys. Otherwise as
-- 20261028053639_customer_portal.sql.
create or replace function private.freeze_agreement_version(p_agreement_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to freeze agreement %', p_agreement_id using errcode = '42501';
  end if;

  update public.agreement_versions v
  set snapshot = (public.agreement_service_scope(p_agreement_id) - 'uncovered' - 'controls') || jsonb_build_object('takenAt', now())
                 || coalesce(jsonb_build_object('terms', private.org_terms(v_org)), '{}'::jsonb)
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id);
end $$;

-- The same function as 20261112240000_agreement_templates.sql, plus one line: a revision copies the exclusions.
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
  v_reason text;
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

  -- A revision starts the next version from the content of the current one: its snapshot, its term, its lines and
  -- their coverage, its scope exclusions, and the template version it was drawn from.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    select e.payload ->> 'reason' into v_reason from public.events e
    where e.entity_type = 'agreement' and e.entity_id = p_agreement_id and e.type = 'agreement.changes_requested'
    order by e.created_at desc limit 1;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot, term_start, term_months, reason,
                                           template_version_id)
    select v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(f.snapshot, '{}'), f.term_start,
           coalesce(f.term_months, 12), v_reason, f.template_version_id
    from (select 1) one
    left join public.agreement_versions f on f.id = v_from
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
    perform private.copy_scope_exclusions(v_from, v_to);
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;
