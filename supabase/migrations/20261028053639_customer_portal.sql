-- Customer review portal, staff side and database (.specs/features/customer-portal, doors 1 to 3, 5 and 6).
-- The portal page and routes are built on top of portal_view, portal_record_view and portal_decide.

-- Door 1: one secret address per agreement version. Only the SHA-256 of the token is stored (64 lowercase hex), so a
-- read of the table never holds a live link. Members read their org's links; nobody writes the table but the
-- functions below.
create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  agreement_version_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  first_viewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (agreement_version_id, org_id) references public.agreement_versions (id, org_id)
);
create index portal_links_org_id_idx on public.portal_links (org_id);
create index portal_links_agreement_version_id_idx on public.portal_links (agreement_version_id, org_id);
-- A version has at most one link that is not revoked.
create unique index portal_links_one_live_per_version on public.portal_links (agreement_version_id) where revoked_at is null;

alter table public.portal_links enable row level security;
create policy portal_links_select on public.portal_links for select to authenticated
  using ((select private.is_org_member(org_id)));
revoke all on public.portal_links from anon, authenticated;
grant select on public.portal_links to authenticated;

-- Door 3: the org's six default terms as the document a snapshot holds under `terms` (camelCase, a key for every
-- term, null when unset). Null when the org has no settings row. Reachable only from other functions and the seed.
create function private.org_terms(p_org_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'repairDiscountPct', s.repair_discount_pct,
    'cpiCapPct', s.cpi_cap_pct,
    'cancellationNoticeDays', s.cancellation_notice_days,
    'paymentDays', s.payment_days,
    'governingProvince', s.governing_province,
    'taxNote', s.tax_note)
  from public.org_settings s where s.org_id = p_org_id
$$;

revoke execute on function private.org_terms(uuid) from public, anon, authenticated;

-- Door 3: the freeze writes the terms in the same statement as the scope. Otherwise as 20261027212052_service_included.sql.
create or replace function private.freeze_agreement_version(p_agreement_id uuid)
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
                 || coalesce(jsonb_build_object('terms', private.org_terms(v_org)), '{}'::jsonb)
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id);
end $$;

-- Door 5: the second outbox writer, for a customer who is no member. Called only from portal_decide.
-- private.enqueue_outbox is unchanged.
create function private.enqueue_outbox_for_system(p_event_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.outbox (org_id, event_id)
  select e.org_id, e.id from public.events e where e.id = p_event_id
$$;

revoke execute on function private.enqueue_outbox_for_system(uuid) from public, anon, authenticated;

-- The only writer of portal_links for staff: revokes the version's live link, if any, and inserts the new one. Called
-- by send_agreement and reissue_portal_link, which are security invoker and so cannot write the table themselves.
-- Raises P0002 when the agreement is missing or outside the caller's orgs, 42501 when the caller cannot write it.
create function private.issue_portal_link(p_agreement_id uuid, p_token_hash text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
  v_link uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id for update;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to link agreement %', p_agreement_id using errcode = '42501';
  end if;

  select v.id into v_version from public.agreement_versions v
  where v.agreement_id = p_agreement_id and v.org_id = v_org
  order by v.version_no desc limit 1;

  update public.portal_links set revoked_at = now()
  where agreement_version_id = v_version and org_id = v_org and revoked_at is null;
  insert into public.portal_links (org_id, agreement_version_id, token_hash)
  values (v_org, v_version, p_token_hash)
  returning id into v_link;
  return v_link;
end $$;

revoke execute on function private.issue_portal_link(uuid, text) from public, anon;
grant execute on function private.issue_portal_link(uuid, text) to authenticated;

-- Door 2, staff side: draft -> sent, the freeze, the event, and the link for the current version, in one transaction.
-- Raises what apply_agreement_transition raises (P0002, 42501, 40001 when the agreement is no longer a draft) and
-- 23514 when the version has no service line or the event is not agreement.sent. Returns the event id.
create function public.send_agreement(p_agreement_id uuid, p_token_hash text, p_event_type text, p_payload jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_event uuid;
  v_version uuid;
begin
  if p_event_type is distinct from 'agreement.sent' then
    raise exception 'send_agreement writes agreement.sent only' using errcode = '23514';
  end if;

  v_event := public.apply_agreement_transition(p_agreement_id, 'draft', 'sent', p_event_type, p_payload);

  -- After the status update, which holds the agreement's row: a line cannot be added or removed meanwhile.
  select v.id into v_version from public.agreement_versions v
  where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
  if not exists (select 1 from public.service_lines l where l.agreement_version_id = v_version) then
    raise exception 'agreement % has no service line', p_agreement_id using errcode = '23514';
  end if;

  perform private.issue_portal_link(p_agreement_id, p_token_hash);
  return v_event;
end $$;

revoke execute on function public.send_agreement(uuid, text, text, jsonb) from public, anon;
grant execute on function public.send_agreement(uuid, text, text, jsonb) to authenticated;

-- Door 2, staff side: a new link for a sent agreement; the old one is revoked. Raises P0002, 42501, and 40001 unless
-- the agreement is sent. Returns the new link's id.
create function public.reissue_portal_link(p_agreement_id uuid, p_token_hash text)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
begin
  select a.org_id, a.status into v_org, v_status from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to link agreement %', p_agreement_id using errcode = '42501';
  end if;

  -- Locks the agreement, so a withdraw or a decision racing this call takes its turn.
  select a.status into v_status from public.agreements a where a.id = p_agreement_id for update;
  if v_status is distinct from 'sent' then
    raise exception 'agreement % is not sent', p_agreement_id using errcode = '40001';
  end if;
  return private.issue_portal_link(p_agreement_id, p_token_hash);
end $$;

revoke execute on function public.reissue_portal_link(uuid, text) from public, anon;
grant execute on function public.reissue_portal_link(uuid, text) to authenticated;

-- Door 2, customer side. Everything the page and the PDF need, as one document, for the link whose token hash this is;
-- null for an unknown hash. The caller applies the portal state (replaced, superseded, withdrawn...) to what comes
-- back. Writes nothing.
create function public.portal_view(p_token_hash text)
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
                  'annualCents', l.visits_per_year * l.cost_per_visit_cents)
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

-- Door 2, customer side: the first view of a live link stamps it and writes agreement.viewed (no outbox row, door 6).
-- A later call, a revoked link or an unknown hash writes nothing.
create function public.portal_record_view(p_token_hash text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
begin
  update public.portal_links l set first_viewed_at = now()
  where l.token_hash = p_token_hash and l.revoked_at is null and l.first_viewed_at is null
  returning l.org_id, l.agreement_version_id into v_org, v_version;
  if not found then
    return;
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  select v.org_id, 'agreement', v.agreement_id, 'agreement.viewed', jsonb_build_object('versionNo', v.version_no), null
  from public.agreement_versions v where v.id = v_version and v.org_id = v_org;
end $$;

revoke execute on function public.portal_record_view(text) from public;
grant execute on function public.portal_record_view(text) to anon, authenticated;

-- Door 2, customer side: the customer's decision. Whitelists three (status, event) pairs. The event payload is built
-- here (door 6): from, to, the version number, via 'portal', and the trimmed reason from p_payload for a refusal or a
-- request for changes; nothing else the caller sends is stored. The actor is null even for a signed-in member.
-- Raises 42501 for a pair not on the list, P0002 for an unknown hash, 23514 for a reason outside 1 to 2000 characters
-- after trimming, 40001 unless the link is live, its version the current one and the agreement still sent.
create function public.portal_decide(p_token_hash text, p_to_status text, p_event_type text, p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_link_id uuid;
  v_org uuid;
  v_revoked timestamptz;
  v_version_no integer;
  v_agreement uuid;
  v_status text;
  v_current boolean;
  v_event uuid;
  v_payload jsonb;
begin
  if (p_to_status, p_event_type) not in (
       ('accepted', 'agreement.accepted'), ('refused', 'agreement.refused'), ('changes_requested', 'agreement.changes_requested')) then
    raise exception 'decision % with event % is not allowed', p_to_status, p_event_type using errcode = '42501';
  end if;

  if p_to_status <> 'accepted' then
    v_reason := regexp_replace(coalesce(p_payload ->> 'reason', ''), '^\s+|\s+$', '', 'g');
    if char_length(v_reason) < 1 or char_length(v_reason) > 2000 then
      raise exception 'a reason of 1 to 2000 characters is required' using errcode = '23514';
    end if;
  end if;

  select l.id, l.org_id, l.revoked_at, v.version_no, v.agreement_id
  into v_link_id, v_org, v_revoked, v_version_no, v_agreement
  from public.portal_links l
  join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
  where l.token_hash = p_token_hash;
  if not found then
    raise exception 'unknown link' using errcode = 'P0002';
  end if;

  -- Holds the link and the agreement, so a reissue, a withdraw or a second decision takes its turn.
  perform 1 from public.portal_links l where l.id = v_link_id for update;
  select a.status, v_version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)
  into v_status, v_current
  from public.agreements a where a.id = v_agreement for update;
  select l.revoked_at into v_revoked from public.portal_links l where l.id = v_link_id;

  if v_revoked is not null or not v_current or v_status <> 'sent' then
    raise exception 'this link is no longer open' using errcode = '40001';
  end if;

  update public.agreements set status = p_to_status, updated_at = now() where id = v_agreement and status = 'sent';
  if not found then
    raise exception 'this link is no longer open' using errcode = '40001';
  end if;

  v_payload := jsonb_build_object('from', 'sent', 'to', p_to_status, 'versionNo', v_version_no, 'via', 'portal');
  if v_reason is not null then
    v_payload := v_payload || jsonb_build_object('reason', v_reason);
  end if;
  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', v_agreement, p_event_type, v_payload, null)
  returning id into v_event;
  perform private.enqueue_outbox_for_system(v_event);
  return v_event;
end $$;

revoke execute on function public.portal_decide(text, text, text, jsonb) from public;
grant execute on function public.portal_decide(text, text, text, jsonb) to anon, authenticated;

-- AC 34: every version that is no longer editable and has no terms gets the org's terms as of this run. The live
-- project holds only fictitious demo data, so today stands in for when it was sent. A version with terms keeps them.
update public.agreement_versions v
set snapshot = v.snapshot || jsonb_build_object('terms', private.org_terms(v.org_id))
from public.agreements a
where a.id = v.agreement_id
  and not (v.snapshot ? 'terms')
  and private.org_terms(v.org_id) is not null
  and not (a.status = 'draft'
           and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id));
