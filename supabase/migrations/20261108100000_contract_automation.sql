-- contract-automation (Phase 4 item 4): n8n W2 and W4.
--   Door 1: four notification kinds, three skip reasons.
--   Door 2: private.make_contract, shared by create_contract and the system path private.create_contract_for_system.
--   Door 3: complete_signature_request enqueues the contract.sent_for_signature event.
--   Doors 1 and 4: automation_request, automation_claim and automation_complete know the three new kinds.

-- Door 1.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'customer_renewal',
                  'staff_renewal', 'staff_expired', 'staff_contract_ready', 'customer_signing_link',
                  'contract_signed_copy', 'staff_contract_signed'));
alter table public.notifications drop constraint notifications_skip_reason_check;
alter table public.notifications add constraint notifications_skip_reason_check
  check (skip_reason in ('decided', 'superseded', 'viewed', 'no_recipient', 'no_link_secret', 'reserved_domain',
                         'not_signable', 'not_completed', 'no_documents'));

-- Door 2: the rules of create_contract without its caller check. p_actor is the member (null for the system); p_via is
-- written into the event payload when given. Refusals are 55000 with the same hints as before.
create function private.make_contract(p_agreement_id uuid, p_actor uuid, p_via text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_site uuid;
  v_version uuid;
  v_version_no integer;
  v_start date;
  v_contract uuid;
  v_inactive boolean;
begin
  select a.org_id, a.status, a.site_id into v_org, v_status, v_site from public.agreements a where a.id = p_agreement_id for update;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  select v.id, v.version_no, v.term_start into v_version, v_version_no, v_start
  from public.agreement_versions v where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;

  select c.id into v_contract from public.contracts c where c.agreement_version_id = v_version and c.org_id = v_org;
  if found then
    return v_contract;
  end if;

  if v_status <> 'accepted' then
    raise exception 'agreement % is not accepted', p_agreement_id using errcode = '55000', hint = 'not_accepted';
  end if;
  if exists (select 1 from public.events e
             where e.entity_type = 'agreement' and e.entity_id = p_agreement_id and e.type = 'agreement.renewed') then
    raise exception 'agreement % was renewed automatically', p_agreement_id using errcode = '55000', hint = 'auto_renewal';
  end if;
  select s.deactivated_at is not null into v_inactive from public.sites s where s.id = v_site for share;
  if v_inactive then
    raise exception 'site % is inactive', v_site using errcode = '55000', hint = 'site_inactive';
  end if;
  if v_start is null then
    raise exception 'agreement % has no term start', p_agreement_id using errcode = '55000', hint = 'no_term_start';
  end if;
  if private.customer_signer(v_site) is null then
    raise exception 'site % has nobody with an email to sign', v_site using errcode = '55000', hint = 'no_signer';
  end if;

  insert into public.contracts (org_id, agreement_version_id, parties)
  values (v_org, v_version, private.contract_parties(v_site))
  returning id into v_contract;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'contract', v_contract, 'contract.pending_signature',
          jsonb_build_object('from', null::text, 'to', 'pending_signature', 'versionNo', v_version_no)
          || case when p_via is not null then jsonb_build_object('via', p_via) else '{}'::jsonb end, p_actor);
  return v_contract;
end $$;
revoke execute on function private.make_contract(uuid, uuid, text) from public, anon, authenticated;

create function private.create_contract_for_system(p_agreement_id uuid)
returns uuid
language sql security definer
set search_path = ''
as $$ select private.make_contract(p_agreement_id, null, 'w2') $$;
revoke execute on function private.create_contract_for_system(uuid) from public, anon, authenticated;

create or replace function public.create_contract(p_agreement_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create a contract for agreement %', p_agreement_id using errcode = '42501';
  end if;
  return private.make_contract(p_agreement_id, auth.uid(), null);
end $$;
revoke execute on function public.create_contract(uuid) from public, anon;
grant execute on function public.create_contract(uuid) to authenticated;

-- Door 3: as 20261106154448_signature_provider.sql, plus the outbox row of the contract.sent_for_signature event.
create or replace function public.complete_signature_request(
  p_request_id uuid,
  p_submission_id text,
  p_signers jsonb,
  p_customer_link_sealed text,
  p_document_sha256 text
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_contract uuid;
  v_status text;
  v_version_no integer;
  v_sealed constant text := '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$';
  v_signer jsonb;
  v_event uuid;
begin
  select r.org_id, r.contract_id into v_org, v_contract from public.contract_signature_requests r where r.id = p_request_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'signature request % not found', p_request_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to complete signature request %', p_request_id using errcode = '42501';
  end if;

  select r.status into v_status from public.contract_signature_requests r where r.id = p_request_id for update;
  if v_status <> 'creating' then
    raise exception 'signature request % is not being created', p_request_id using errcode = '55000', hint = 'not_creating';
  end if;

  if p_submission_id is null or btrim(p_submission_id) = ''
     or p_document_sha256 is null or p_document_sha256 !~ '^[0-9a-f]{64}$'
     or p_customer_link_sealed is null or p_customer_link_sealed !~ v_sealed
     or jsonb_typeof(p_signers) is distinct from 'array' or jsonb_array_length(p_signers) <> 2
     or (select count(distinct e ->> 'role') from jsonb_array_elements(p_signers) e where e ->> 'role' in ('customer', 'contractor')) <> 2 then
    raise exception 'malformed signature request answer' using errcode = '22023';
  end if;
  for v_signer in select * from jsonb_array_elements(p_signers) loop
    if coalesce(btrim(v_signer ->> 'submitterId'), '') = '' or coalesce(v_signer ->> 'embedSealed', '') !~ v_sealed then
      raise exception 'malformed signer in the signature request answer' using errcode = '22023';
    end if;
  end loop;

  update public.contract_signers s
  set provider_submitter_id = e ->> 'submitterId',
      embed_sealed = e ->> 'embedSealed',
      link_sealed = case when s.role = 'customer' then p_customer_link_sealed end
  from jsonb_array_elements(p_signers) e
  where s.request_id = p_request_id and s.org_id = v_org and s.role = e ->> 'role';

  update public.contract_signature_requests
  set status = 'open', provider_submission_id = btrim(p_submission_id), document_sha256 = p_document_sha256
  where id = p_request_id;

  select v.version_no into v_version_no
  from public.contracts c join public.agreement_versions v on v.id = c.agreement_version_id and v.org_id = c.org_id
  where c.id = v_contract;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'contract', v_contract, 'contract.sent_for_signature',
          jsonb_build_object('requestId', p_request_id, 'provider', 'docuseal', 'versionNo', v_version_no), auth.uid())
  returning id into v_event;
  -- The signing link is emailed by W2b (contract-automation door 3).
  perform private.enqueue_outbox(v_event);

end $$;

-- Doors 1 and 4: the request kinds, the claim and the completion.
create or replace function private.automation_request(p_body text, p_timestamp text, p_signature text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_secret text;
  v jsonb;
  v_kind text;
  v_key text;
  v_event uuid;
  v_agreement uuid;
  v_contract uuid;
  v_date date;
begin
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'automation_hmac_secret';
  if v_secret is null or p_body is null or p_signature is null or p_timestamp is null or p_timestamp !~ '^[0-9]{1,12}$'
     or abs(floor(extract(epoch from now()))::bigint - p_timestamp::bigint) > 300
     or p_signature is distinct from 'sha256=' || encode(extensions.hmac(p_timestamp || '.' || p_body, v_secret, 'sha256'), 'hex') then
    raise exception 'bad or stale signature' using errcode = '42501';
  end if;

  begin
    v := p_body::jsonb;
  exception when others then
    raise exception 'the body is not JSON' using errcode = '22023';
  end;
  if jsonb_typeof(v) is distinct from 'object' then
    raise exception 'the body is not a JSON object' using errcode = '22023';
  end if;

  v_kind := v ->> 'kind';
  v_key := v ->> 'idempotencyKey';
  if v_kind is null or v_kind not in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'renewal_daily', 'expiry_daily',
                              'contract_ready', 'customer_signing_link', 'contract_signed_copy') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if v_key is null then
    raise exception 'idempotencyKey is required' using errcode = '22023';
  end if;
  if v ? 'executionId' and jsonb_typeof(v -> 'executionId') is distinct from 'string' then
    raise exception 'executionId must be a string' using errcode = '22023';
  end if;

  if v_kind = 'staff_stale' then
    if v_key !~ '^w5:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'idempotencyKey is not w5:<yyyy-mm-dd>' using errcode = '22023';
    end if;
    begin
      perform substr(v_key, 4)::date;
    exception when others then
      raise exception 'idempotencyKey is not a date' using errcode = '22023';
    end;
    return jsonb_build_object('kind', v_kind, 'key', v_key, 'executionId', v -> 'executionId');
  end if;

  if v_kind in ('renewal_daily', 'expiry_daily') then
    if v_key !~ ('^' || case v_kind when 'renewal_daily' then 'w7' else 'w8' end || ':[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'idempotencyKey is not %:<yyyy-mm-dd>', case v_kind when 'renewal_daily' then 'w7' else 'w8' end
        using errcode = '22023';
    end if;
    begin
      v_date := substr(v_key, 4)::date;
    exception when others then
      raise exception 'idempotencyKey is not a date' using errcode = '22023';
    end;
    if abs(v_date - current_date) > 1 then
      raise exception 'the run date is more than one day from today' using errcode = '22023';
    end if;
    return jsonb_build_object('kind', v_kind, 'key', v_key, 'runDate', v_date, 'executionId', v -> 'executionId');
  end if;

  if v_kind in ('customer_signing_link', 'contract_signed_copy') then
    begin
      v_event := (v ->> 'eventId')::uuid;
      v_contract := (v ->> 'contractId')::uuid;
    exception when others then
      raise exception 'eventId and contractId must be uuids' using errcode = '22023';
    end;
    if v_event is null or v_contract is null then
      raise exception 'eventId and contractId are required' using errcode = '22023';
    end if;
    if v_key <> (case v_kind when 'customer_signing_link' then 'w2:' || v_event || ':link' else 'w4:' || v_event || ':copy' end) then
      raise exception 'idempotencyKey does not match kind and eventId' using errcode = '22023';
    end if;
    return jsonb_build_object('kind', v_kind, 'key', v_key, 'eventId', v_event, 'contractId', v_contract,
                              'executionId', v -> 'executionId');
  end if;

  begin
    v_event := (v ->> 'eventId')::uuid;
    v_agreement := (v ->> 'agreementId')::uuid;
  exception when others then
    raise exception 'eventId and agreementId must be uuids' using errcode = '22023';
  end;
  if v_event is null or v_agreement is null then
    raise exception 'eventId and agreementId are required' using errcode = '22023';
  end if;
  if not v_key = any (case v_kind
       when 'customer_link' then array['w1:' || v_event || ':link']
       when 'customer_reminder' then array['w1:' || v_event || ':day3', 'w1:' || v_event || ':day7']
       when 'contract_ready' then array['w2:' || v_event || ':ready']
       else array['w3:' || v_event] end) then
    raise exception 'idempotencyKey does not match kind and eventId' using errcode = '22023';
  end if;
  return jsonb_build_object('kind', v_kind, 'key', v_key, 'eventId', v_event, 'agreementId', v_agreement,
                            'executionId', v -> 'executionId');
end $$;

-- W2a. The event is the agreement's acceptance. The contract is made (or found) before the email is decided, so a retry
-- after a failed send finds it and sends the same message. A refusal of the rules is a message, not an error.
create function private.claim_contract_ready(r jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_agreement public.agreements;
  v_claim record;
  v_contract uuid;
  v_refusal text;
  v_recipients text[];
begin
  select * into v_event from public.events e
  where e.id = (r ->> 'eventId')::uuid and e.entity_type = 'agreement' and e.entity_id = (r ->> 'agreementId')::uuid
    and e.type = 'agreement.accepted';
  if not found then
    raise exception 'unknown event for this agreement' using errcode = 'P0002';
  end if;
  select * into v_agreement from public.agreements a where a.id = v_event.entity_id and a.org_id = v_event.org_id;
  if not found then
    raise exception 'unknown agreement' using errcode = 'P0002';
  end if;
  if r ->> 'executionId' is not null then
    update public.events set n8n_execution_id = r ->> 'executionId' where id = v_event.id and n8n_execution_id is null;
  end if;

  select * into v_claim from private.claim_notification(r ->> 'key', 'staff_contract_ready', v_agreement.org_id, v_agreement.id, v_event.id);
  if v_claim.o_state <> 'send' then
    return jsonb_build_object('decision', v_claim.o_state, 'messages', '[]'::jsonb);
  end if;

  begin
    v_contract := private.create_contract_for_system(v_agreement.id);
  exception when sqlstate '55000' then
    get stacked diagnostics v_refusal = pg_exception_hint;
  end;

  v_recipients := private.org_managers(v_agreement.org_id);
  if cardinality(v_recipients) = 0 then
    update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
    return jsonb_build_object('decision', 'skip', 'reason', 'no_recipient', 'messages', '[]'::jsonb);
  end if;
  update public.notifications set recipients = v_recipients where id = v_claim.o_id;
  return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
    'notificationId', v_claim.o_id, 'kind', 'staff_contract_ready', 'to', to_jsonb(v_recipients),
    'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
               from public.org_settings t where t.org_id = v_agreement.org_id),
    'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'contract', case when v_contract is not null then jsonb_build_object('id', v_contract) end,
    'refusal', v_refusal)));
end $$;
revoke execute on function private.claim_contract_ready(jsonb) from public, anon, authenticated;

-- W2b. The event is the send; the request it names must still be open on a pending_signature contract.
create function private.claim_signing_link(r jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_contract public.contracts;
  v_agreement public.agreements;
  v_request public.contract_signature_requests;
  v_signer public.contract_signers;
  v_claim record;
  v_reason text;
begin
  select * into v_event from public.events e
  where e.id = (r ->> 'eventId')::uuid and e.entity_type = 'contract' and e.entity_id = (r ->> 'contractId')::uuid
    and e.type = 'contract.sent_for_signature';
  if not found then
    raise exception 'unknown event for this contract' using errcode = 'P0002';
  end if;
  select * into v_contract from public.contracts c where c.id = v_event.entity_id and c.org_id = v_event.org_id;
  if not found then
    raise exception 'unknown contract' using errcode = 'P0002';
  end if;
  select a.* into v_agreement from public.agreement_versions v
  join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  where v.id = v_contract.agreement_version_id and v.org_id = v_contract.org_id;
  if r ->> 'executionId' is not null then
    update public.events set n8n_execution_id = r ->> 'executionId' where id = v_event.id and n8n_execution_id is null;
  end if;

  select * into v_claim from private.claim_notification(r ->> 'key', 'customer_signing_link', v_contract.org_id, v_agreement.id, v_event.id);
  if v_claim.o_state <> 'send' then
    return jsonb_build_object('decision', v_claim.o_state, 'messages', '[]'::jsonb);
  end if;

  select * into v_request from public.contract_signature_requests q
  where q.id = (v_event.payload ->> 'requestId')::uuid and q.contract_id = v_contract.id and q.org_id = v_contract.org_id;
  select * into v_signer from public.contract_signers s
  where s.request_id = v_request.id and s.org_id = v_request.org_id and s.role = 'customer';
  if v_signer.request_id is null or v_request.status <> 'open' or v_contract.status <> 'pending_signature' then
    v_reason := 'not_signable';
  elsif v_signer.link_sealed is null then
    v_reason := 'no_link_secret';
  end if;
  if v_reason is not null then
    update public.notifications set status = 'skipped', skip_reason = v_reason where id = v_claim.o_id;
    return jsonb_build_object('decision', 'skip', 'reason', v_reason, 'messages', '[]'::jsonb);
  end if;

  update public.notifications set recipients = array[v_signer.email] where id = v_claim.o_id;
  return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
    'notificationId', v_claim.o_id, 'kind', 'customer_signing_link', 'to', jsonb_build_array(v_signer.email),
    'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
               from public.org_settings t where t.org_id = v_contract.org_id),
    'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'contract', jsonb_build_object('id', v_contract.id),
    'signerName', v_signer.name,
    'linkSealed', v_signer.link_sealed)));
end $$;
revoke execute on function private.claim_signing_link(jsonb) from public, anon, authenticated;

-- W4. The parties' copy and the managers' note are two notifications under one callback (keys :copy and :staff). Each is
-- claimed on its own, so a retry sends only what has not gone out.
create function private.claim_signed_copy(r jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_contract public.contracts;
  v_agreement public.agreements;
  v_request public.contract_signature_requests;
  v_copy record;
  v_staff record;
  v_reason text;
  v_tenant jsonb;
  v_site jsonb;
  v_documents jsonb;
  v_messages jsonb := '[]';
  v_managers text[];
  v_emails text[] := '{}';
  v_party record;
  v_seen text[] := '{}';
begin
  select * into v_event from public.events e
  where e.id = (r ->> 'eventId')::uuid and e.entity_type = 'contract' and e.entity_id = (r ->> 'contractId')::uuid
    and e.type = 'contract.completed';
  if not found then
    raise exception 'unknown event for this contract' using errcode = 'P0002';
  end if;
  select * into v_contract from public.contracts c where c.id = v_event.entity_id and c.org_id = v_event.org_id;
  if not found then
    raise exception 'unknown contract' using errcode = 'P0002';
  end if;
  select a.* into v_agreement from public.agreement_versions v
  join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  where v.id = v_contract.agreement_version_id and v.org_id = v_contract.org_id;
  if r ->> 'executionId' is not null then
    update public.events set n8n_execution_id = r ->> 'executionId' where id = v_event.id and n8n_execution_id is null;
  end if;

  select * into v_copy from private.claim_notification(r ->> 'key', 'contract_signed_copy', v_contract.org_id, v_agreement.id, v_event.id);
  select * into v_staff from private.claim_notification('w4:' || v_event.id || ':staff', 'staff_contract_signed', v_contract.org_id, v_agreement.id, v_event.id);
  if v_copy.o_state <> 'send' and v_staff.o_state <> 'send' then
    return jsonb_build_object('decision', case when 'in_flight' in (v_copy.o_state, v_staff.o_state) then 'in_flight' else 'duplicate' end,
                              'messages', '[]'::jsonb);
  end if;

  select * into v_request from public.contract_signature_requests q
  where q.contract_id = v_contract.id and q.org_id = v_contract.org_id and q.status = 'completed'
  order by q.completed_at desc limit 1;
  if v_contract.status <> 'completed' then
    v_reason := 'not_completed';
  elsif v_request.id is null or (select count(*) from public.contract_signed_documents d where d.request_id = v_request.id) <> 2 then
    v_reason := 'no_documents';
  end if;
  if v_reason is not null then
    update public.notifications set status = 'skipped', skip_reason = v_reason
    where id in (v_copy.o_id, v_staff.o_id) and status = 'claimed';
    return jsonb_build_object('decision', 'skip', 'reason', v_reason, 'messages', '[]'::jsonb);
  end if;

  v_tenant := (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
               from public.org_settings t where t.org_id = v_contract.org_id);
  v_site := (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id);

  if v_copy.o_state = 'send' then
    v_documents := (select jsonb_agg(jsonb_build_object(
                      'kind', d.kind, 'sizeBytes', d.size_bytes, 'sha256', d.sha256,
                      'contentBase64', replace(encode(d.content, 'base64'), E'\n', '')) order by d.kind)
                    from public.contract_signed_documents d where d.request_id = v_request.id);
    for v_party in
      select s.role, s.name, s.email from public.contract_signers s
      where s.request_id = v_request.id and s.org_id = v_request.org_id
      order by case s.role when 'customer' then 0 else 1 end
    loop
      continue when lower(btrim(v_party.email)) = any (v_seen);
      v_seen := v_seen || lower(btrim(v_party.email));
      v_emails := v_emails || v_party.email;
      v_messages := v_messages || jsonb_build_object(
        'notificationId', v_copy.o_id, 'kind', 'contract_signed_copy',
        'idempotencyKey', (r ->> 'key') || ':' || v_party.role,
        'to', jsonb_build_array(v_party.email), 'tenant', v_tenant,
        'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
        'site', v_site, 'contract', jsonb_build_object('id', v_contract.id),
        'role', v_party.role, 'signerName', v_party.name, 'documents', v_documents);
    end loop;
    update public.notifications set recipients = v_emails where id = v_copy.o_id;
  end if;

  if v_staff.o_state = 'send' then
    v_managers := private.org_managers(v_contract.org_id);
    if cardinality(v_managers) = 0 then
      update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_staff.o_id;
    else
      update public.notifications set recipients = v_managers where id = v_staff.o_id;
      v_messages := v_messages || jsonb_build_object(
        'notificationId', v_staff.o_id, 'kind', 'staff_contract_signed',
        'idempotencyKey', 'w4:' || v_event.id || ':staff',
        'to', to_jsonb(v_managers), 'tenant', v_tenant,
        'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
        'site', v_site, 'contract', jsonb_build_object('id', v_contract.id),
        'customer', (select jsonb_build_object('name', c.name) from public.sites s
                     join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                     where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id));
    end if;
  end if;

  if jsonb_array_length(v_messages) = 0 then
    return jsonb_build_object('decision', 'skip', 'reason', 'no_recipient', 'messages', '[]'::jsonb);
  end if;
  return jsonb_build_object('decision', 'send', 'messages', v_messages);
end $$;
revoke execute on function private.claim_signed_copy(jsonb) from public, anon, authenticated;

create or replace function public.automation_claim(p_body text, p_timestamp text, p_signature text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := private.automation_request(p_body, p_timestamp, p_signature);
  v_kind text := r ->> 'kind';
  v_event public.events;
  v_agreement public.agreements;
  v_version public.agreement_versions;
  v_claim record;
  v_reason text;
  v_to text;
  v_link public.portal_links;
  v_actor uuid;
  v_reply text;
  v_recipients text[];
  v_tenant jsonb;
  v_messages jsonb := '[]';
  v_states text[] := '{}';
  o record;
begin
  if v_kind = 'renewal_daily' then
    return private.claim_renewals(r);
  end if;
  if v_kind = 'expiry_daily' then
    return private.claim_expiries(r);
  end if;
  if v_kind = 'contract_ready' then
    return private.claim_contract_ready(r);
  end if;
  if v_kind = 'customer_signing_link' then
    return private.claim_signing_link(r);
  end if;
  if v_kind = 'contract_signed_copy' then
    return private.claim_signed_copy(r);
  end if;

  if v_kind = 'staff_stale' then
    for o in
      select a.org_id,
             jsonb_agg(jsonb_build_object('id', a.id, 'number', a.number, 'customerName', c.name, 'sentAt', x.sent_at)
                       order by x.sent_at, a.number) as agreements
      from public.agreements a
      join public.sites s on s.id = a.site_id and s.org_id = a.org_id
      join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
      cross join lateral (
        select max(e.created_at) as sent_at from public.events e
        where e.org_id = a.org_id and e.entity_type = 'agreement' and e.entity_id = a.id and e.type = 'agreement.sent') x
      where a.status = 'sent'
        and x.sent_at <= now() - interval '7 days'
        and not exists (
          select 1 from public.portal_links l
          join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
          where v.agreement_id = a.id and v.org_id = a.org_id and l.revoked_at is null and l.first_viewed_at is not null
            and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id))
      group by a.org_id
      order by a.org_id
    loop
      select * into v_claim from private.claim_notification((r ->> 'key') || ':' || o.org_id, 'staff_stale', o.org_id, null, null);
      v_states := v_states || v_claim.o_state;
      continue when v_claim.o_state <> 'send';
      v_recipients := private.org_managers(o.org_id);
      if cardinality(v_recipients) = 0 then
        update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
        continue;
      end if;
      update public.notifications set recipients = v_recipients where id = v_claim.o_id;
      v_messages := v_messages || jsonb_build_object(
        'notificationId', v_claim.o_id, 'kind', v_kind, 'orgId', o.org_id, 'to', to_jsonb(v_recipients),
        'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
                   from public.org_settings t where t.org_id = o.org_id),
        'agreements', o.agreements);
    end loop;
    return jsonb_build_object('messages', v_messages) || case
      when jsonb_array_length(v_messages) > 0 then jsonb_build_object('decision', 'send')
      when 'in_flight' = any (v_states) then jsonb_build_object('decision', 'in_flight')
      when 'duplicate' = any (v_states) then jsonb_build_object('decision', 'duplicate')
      else jsonb_build_object('decision', 'skip', 'reason', 'none') end;
  end if;

  select * into v_event from public.events e
  where e.id = (r ->> 'eventId')::uuid and e.entity_type = 'agreement' and e.entity_id = (r ->> 'agreementId')::uuid
    and e.type = any (case when v_kind = 'staff_decision' then array['agreement.refused', 'agreement.changes_requested']
                           else array['agreement.sent'] end);
  if not found then
    raise exception 'unknown event for this agreement' using errcode = 'P0002';
  end if;
  select * into v_agreement from public.agreements a where a.id = v_event.entity_id and a.org_id = v_event.org_id;
  if not found then
    raise exception 'unknown agreement' using errcode = 'P0002';
  end if;

  if r ->> 'executionId' is not null then
    update public.events set n8n_execution_id = r ->> 'executionId' where id = v_event.id and n8n_execution_id is null;
  end if;

  select * into v_claim from private.claim_notification(r ->> 'key', v_kind, v_agreement.org_id, v_agreement.id, v_event.id);
  if v_claim.o_state <> 'send' then
    return jsonb_build_object('decision', v_claim.o_state, 'messages', '[]'::jsonb);
  end if;

  select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
  into v_tenant from public.org_settings t where t.org_id = v_agreement.org_id;

  if v_kind = 'staff_decision' then
    -- The member who sent the decided version: the actor of the agreement's latest agreement.sent before the decision.
    select e.actor_id into v_actor from public.events e
    where e.org_id = v_agreement.org_id and e.entity_type = 'agreement' and e.entity_id = v_agreement.id
      and e.type = 'agreement.sent' and e.created_at <= v_event.created_at
    order by e.created_at desc limit 1;
    select array[u.email::text] into v_recipients from auth.users u
    where u.id = v_actor and u.email is not null
      and exists (select 1 from public.memberships m where m.org_id = v_agreement.org_id and m.user_id = v_actor);
    if v_recipients is null then
      v_recipients := private.org_managers(v_agreement.org_id);
    end if;
    if cardinality(v_recipients) = 0 then
      update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
      return jsonb_build_object('decision', 'skip', 'reason', 'no_recipient', 'messages', '[]'::jsonb);
    end if;
    update public.notifications set recipients = v_recipients where id = v_claim.o_id;
    return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
      'notificationId', v_claim.o_id, 'kind', v_kind, 'to', to_jsonb(v_recipients), 'tenant', v_tenant,
      'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
      'customer', (select jsonb_build_object('name', c.name) from public.sites s
                   join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                   where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
      'decision', substr(v_event.type, length('agreement.') + 1),
      'reason', v_event.payload ->> 'reason')));
  end if;

  -- W1. The event's version is the newest one that existed when it was sent; a newer one supersedes it.
  select * into v_version from public.agreement_versions v
  where v.agreement_id = v_agreement.id and v.org_id = v_agreement.org_id and v.created_at <= v_event.created_at
  order by v.version_no desc limit 1;
  if not found then
    select * into v_version from public.agreement_versions v
    where v.agreement_id = v_agreement.id and v.org_id = v_agreement.org_id order by v.version_no desc limit 1;
  end if;
  select * into v_link from public.portal_links l
  where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id and l.revoked_at is null;

  if v_kind = 'customer_reminder' then
    if exists (select 1 from public.agreement_versions w where w.agreement_id = v_agreement.id and w.version_no > v_version.version_no) then
      v_reason := 'superseded';
    elsif v_agreement.status <> 'sent' then
      v_reason := 'decided';
    elsif v_link.first_viewed_at is not null then
      v_reason := 'viewed';
    end if;
  end if;
  if v_reason is null then
    v_to := private.customer_recipient(v_agreement.site_id);
    if v_to is null then
      v_reason := 'no_recipient';
    elsif v_link.token_sealed is null then
      v_reason := 'no_link_secret';
    end if;
  end if;
  if v_reason is not null then
    update public.notifications set status = 'skipped', skip_reason = v_reason where id = v_claim.o_id;
    return jsonb_build_object('decision', 'skip', 'reason', v_reason, 'messages', '[]'::jsonb);
  end if;

  update public.notifications set recipients = array[v_to] where id = v_claim.o_id;
  select u.email into v_reply from auth.users u where u.id = v_event.actor_id;
  return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
    'notificationId', v_claim.o_id, 'kind', v_kind, 'to', jsonb_build_array(v_to), 'tenant', v_tenant,
    'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
    'customer', (select jsonb_build_object('name', c.name) from public.sites s
                 join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                 where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents) from public.service_lines l
                             where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), 0),
    'tokenSealed', v_link.token_sealed,
    'reminder', case when v_kind = 'customer_reminder' then substr(r ->> 'key', length(r ->> 'key') - 3) end)
    || case when v_reply is not null then jsonb_build_object('replyTo', v_reply) else '{}'::jsonb end));
end $$;

create or replace function public.automation_complete(p_body text, p_timestamp text, p_signature text, p_results jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := private.automation_request(p_body, p_timestamp, p_signature);
  v_key text := r ->> 'key';
  v_stale boolean := r ->> 'kind' = 'staff_stale';
  v_renewal boolean := r ->> 'kind' = 'renewal_daily';
  v_expiry boolean := r ->> 'kind' = 'expiry_daily';
  x jsonb;
  g record;
begin
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'results must be a non-empty array' using errcode = '22023';
  end if;
  for x in select value from jsonb_array_elements(p_results) loop
    if jsonb_typeof(x) is distinct from 'object' or coalesce(x ->> 'id', '') !~ '^[0-9a-fA-F-]{36}$'
       or x ->> 'outcome' is null or x ->> 'outcome' not in ('sent', 'failed', 'skipped')
       or (x ->> 'outcome' = 'skipped' and coalesce(x ->> 'reason', '') not in
           ('decided', 'superseded', 'viewed', 'no_recipient', 'no_link_secret', 'reserved_domain')) then
      raise exception 'malformed result %', x using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_results) e
    where not exists (
      select 1 from public.notifications n
      where n.id = (e.value ->> 'id')::uuid
        and (n.idempotency_key = v_key or (v_stale and n.idempotency_key like v_key || ':%')
             or (v_renewal and n.kind in ('customer_renewal', 'staff_renewal'))
             or (v_expiry and n.kind = 'staff_expired')
             or (r ->> 'kind' = 'contract_signed_copy' and n.idempotency_key = 'w4:' || (r ->> 'eventId') || ':staff')))) then
    raise exception 'a result names a notification of another key' using errcode = 'P0002';
  end if;

  for g in
    select (e.value ->> 'id')::uuid as id,
           bool_or(e.value ->> 'outcome' = 'failed') as failed,
           bool_or(e.value ->> 'outcome' = 'sent') as sent,
           string_agg(coalesce(nullif(e.value ->> 'error', ''), 'failed'), '; ') filter (where e.value ->> 'outcome' = 'failed') as error,
           string_agg(e.value ->> 'providerMessageId', ',') filter (where e.value ->> 'outcome' = 'sent') as provider,
           min(e.value ->> 'reason') filter (where e.value ->> 'outcome' = 'skipped') as reason
    from jsonb_array_elements(p_results) e
    group by 1
  loop
    update public.notifications set
      status = case when g.failed then 'failed' when g.sent then 'sent' else 'skipped' end,
      error = case when g.failed then g.error end,
      provider_message_id = case when not g.failed and g.sent then g.provider end,
      sent_at = case when not g.failed and g.sent then now() end,
      skip_reason = case when not g.failed and not g.sent then g.reason end
    where id = g.id and status = 'claimed';
  end loop;
end $$;
