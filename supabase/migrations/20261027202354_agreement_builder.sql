-- Agreement builder: create an agreement for a site, price it with service lines, keep its versions
-- (.specs/features/agreement-builder, doors 1 to 5).
-- Checked on the live project before this migration (2026-10-27): 12 agreements, every one numbered, no org with a
-- repeated number and no site with two agreements in draft, sent or changes_requested. Nothing to backfill.

-- Door 1: a number is unique in its org. Nulls stay allowed; every agreement created from now on gets one.
alter table public.agreements add constraint agreements_org_id_number_key unique (org_id, number);

-- Door 2: a site has at most one live agreement. Accepted, refused, expired and withdrawn free the site.
create unique index agreements_one_live_per_site on public.agreements (site_id)
  where status in ('draft', 'sent', 'changes_requested');

-- Door 3: the agreement, its number and version 1 in one transaction. Raises P0002 when the site is missing or outside
-- the caller's orgs, 42501 when the caller cannot write it, and 23505 (door 2's index) when the site has a live
-- agreement. Creation is not a transition, so no event is written.
create function public.create_agreement(p_site_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_number text;
  v_agreement uuid;
begin
  select s.org_id into v_org from public.sites s where s.id = p_site_id;
  if v_org is null then
    raise exception 'site % not found', p_site_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create an agreement for site %', p_site_id using errcode = '42501';
  end if;

  -- Two creates in one org take turns here, so they cannot read the same highest number.
  perform pg_advisory_xact_lock(hashtextextended('agreement_number:' || v_org::text, 0));
  select 'AG-' || (coalesce(max(substring(a.number from '^AG-([0-9]+)$')::integer), 1000) + 1) into v_number
  from public.agreements a where a.org_id = v_org;

  insert into public.agreements (org_id, site_id, number) values (v_org, p_site_id, v_number)
  returning id into v_agreement;
  insert into public.agreement_versions (org_id, agreement_id, version_no) values (v_org, v_agreement, 1);
  return v_agreement;
end $$;

revoke execute on function public.create_agreement(uuid) from public, anon;
grant execute on function public.create_agreement(uuid) to authenticated;

-- Door 4: a member changes a line only on the latest version of a draft agreement. The agreement is read `for share`,
-- so a line write and a withdraw or revise serialise. Without a signed-in user (seed, migrations, service role) the
-- trigger stands aside. A version not found in the row's org passes: the foreign key or the org cascade decides.
create function private.service_lines_frozen()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_versions uuid[] := '{}';
  v_orgs uuid[] := '{}';
  v_status text;
  v_latest boolean;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- The version the line leaves and the one it lands on: an update checks both.
  if tg_op <> 'INSERT' then
    v_versions := v_versions || old.agreement_version_id;
    v_orgs := v_orgs || old.org_id;
  end if;
  if tg_op <> 'DELETE' then
    v_versions := v_versions || new.agreement_version_id;
    v_orgs := v_orgs || new.org_id;
  end if;
  for i in 1 .. array_length(v_versions, 1) loop
    select a.status,
           v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)
      into v_status, v_latest
    from public.agreement_versions v
    join public.agreements a on a.id = v.agreement_id
    where v.id = v_versions[i] and v.org_id = v_orgs[i]
    for share of a;
    if found and not (v_status = 'draft' and v_latest) then
      raise exception 'agreement version % can no longer be changed', v_versions[i] using errcode = '55000';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function private.service_lines_frozen() from public, anon, authenticated;

create trigger service_lines_frozen before insert or update or delete on public.service_lines
  for each row execute function private.service_lines_frozen();

-- Door 5: a revision starts version n + 1 from version n's snapshot and its service lines, in the same transaction.
-- Same signature, contract and grants as 20261023222239_transition_rpcs.sql.
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
