-- Transition write path (ports-adapters doors 3 and 4). A transition sets the status, appends the
-- event and enqueues its outbox row in one transaction, or writes nothing.
-- The TS domain decides the move (AD-005); these functions record it.

-- The only writer of outbox rows. Reachable only from other functions: private is not exposed (AD-004).
create function private.enqueue_outbox(p_event_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.outbox (org_id, event_id)
  select e.org_id, e.id from public.events e
  where e.id = p_event_id and (select private.is_org_member(e.org_id))
$$;

revoke execute on function private.enqueue_outbox(uuid) from public, anon;
grant execute on function private.enqueue_outbox(uuid) to authenticated;

-- Raises P0002 when the agreement is missing or outside the caller's orgs, 42501 when the caller
-- cannot write it, and 40001 when its status is no longer p_expected_status.
create function public.apply_agreement_transition(
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

  -- A revision starts the next version from the content of the current one.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot)
    values (v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(
      (select v.snapshot from public.agreement_versions v
       where v.agreement_id = p_agreement_id and v.version_no = v_version), '{}'));
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

-- Same contract as apply_agreement_transition, against public.contracts.
create function public.apply_contract_transition(
  p_contract_id uuid,
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
  v_event uuid;
begin
  select c.org_id into v_org from public.contracts c where c.id = p_contract_id;
  if v_org is null then
    raise exception 'contract % not found', p_contract_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change contract %', p_contract_id using errcode = '42501';
  end if;

  update public.contracts set status = p_to_status
  where id = p_contract_id and status = p_expected_status;
  if not found then
    raise exception 'contract % is no longer %', p_contract_id, p_expected_status using errcode = '40001';
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'contract', p_contract_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.apply_contract_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.apply_contract_transition(uuid, text, text, text, jsonb) to authenticated;
