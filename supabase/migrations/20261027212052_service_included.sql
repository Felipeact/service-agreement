-- Service included: what an agreement covers, built from the equipment on its site, frozen when the agreement leaves
-- draft (.specs/features/service-included, doors 1 to 3 and 5).

-- Doors 1 and 2: the scope document of a site, read as the caller, so RLS decides what it holds. One entry per
-- equipment type with at least one asset on the site: its checklist in position order and its assets. A site the
-- caller cannot see gives no types, never an error.
create function public.site_service_scope(p_site_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object('schema', 1, 'types', coalesce(jsonb_agg(g.doc order by g.name, g.code), '[]'::jsonb))
  from (
    select t.code, t.name, jsonb_build_object(
      'code', t.code,
      'name', t.name,
      'tasks', coalesce((select jsonb_agg(k.description order by k.position, k.created_at, k.id)
                         from public.asset_type_tasks k
                         where k.asset_type_id = t.id and k.org_id = t.org_id), '[]'::jsonb),
      'assets', jsonb_agg(jsonb_build_object('unitNo', a.unit_no, 'typeModel', a.type_model, 'location', a.location)
                          order by a.unit_no nulls last, a.created_at, a.id)
    ) as doc
    from public.assets a
    join public.asset_types t on t.id = a.asset_type_id and t.org_id = a.org_id
    where a.site_id = p_site_id
    group by t.id, t.org_id, t.code, t.name
  ) g
$$;

revoke execute on function public.site_service_scope(uuid) from public, anon;
grant execute on function public.site_service_scope(uuid) to authenticated;

-- Door 3: the only writer of a snapshot. Writes the site's scope, with when it was taken, into the agreement's
-- highest version. Called by apply_agreement_transition when an agreement leaves draft; members cannot update a
-- version themselves.
create function private.freeze_agreement_version(p_agreement_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_site uuid;
begin
  select a.org_id, a.site_id into v_org, v_site from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to freeze agreement %', p_agreement_id using errcode = '42501';
  end if;

  update public.agreement_versions v
  set snapshot = public.site_service_scope(v_site) || jsonb_build_object('takenAt', now())
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id);
end $$;

revoke execute on function private.freeze_agreement_version from public, anon;
grant execute on function private.freeze_agreement_version to authenticated;

revoke update on public.agreement_versions from authenticated;

-- The transition RPC freezes the current version when an agreement leaves draft (sent or withdrawn), in the same
-- transaction as the compare-and-set. Otherwise as 20261027202354_agreement_builder.sql: same signature and grants.
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

  -- A revision starts the next version from the content of the current one: its snapshot and its lines.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot)
    values (v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(
      (select v.snapshot from public.agreement_versions v where v.id = v_from), '{}'))
    returning id into v_to;
    insert into public.service_lines (org_id, agreement_version_id, position, description, visits_per_year, cost_per_visit_cents)
    select l.org_id, v_to, l.position, l.description, l.visits_per_year, l.cost_per_visit_cents
    from public.service_lines l
    where l.agreement_version_id = v_from
    order by l.position, l.created_at;
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;

-- Door 5: every version that is no longer editable and still holds the placeholder gets today's scope of its site.
-- The live project holds only fictitious demo data, so today stands in for when it was sent. Drafts keep {}.
update public.agreement_versions v
set snapshot = public.site_service_scope(a.site_id) || jsonb_build_object('takenAt', now())
from public.agreements a
where a.id = v.agreement_id
  and v.snapshot = '{}'::jsonb
  and not (a.status = 'draft'
           and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id));
