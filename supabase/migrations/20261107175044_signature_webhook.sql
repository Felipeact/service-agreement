-- Signature webhook (.specs/features/signature-webhook/plan.md). DocuSeal tells the app who signed. The database checks
-- the HMAC itself (AD-148), applies the event, and stores the signed copy and DocuSeal's audit log in the transaction
-- that completes the request (AD-149).

-- Door 2: a request can end `completed` (both signed, copy stored) or `declined` (a signer declined in the form).
-- `completed_at` is set exactly when the request is `completed`.
alter table public.contract_signature_requests drop constraint contract_signature_requests_status_check;
alter table public.contract_signature_requests
  add constraint contract_signature_requests_status_check
    check (status in ('creating', 'open', 'failed', 'voided', 'completed', 'declined'));
alter table public.contract_signature_requests add column completed_at timestamptz;
alter table public.contract_signature_requests
  add constraint contract_signature_requests_completed_at_iff_completed
    check ((status = 'completed') = (completed_at is not null));
grant select (completed_at) on public.contract_signature_requests to authenticated;

-- Door 2: who signed, when, from where. Written by the webhook only, first write wins.
alter table public.contract_signers
  add column signed_at timestamptz,
  add column signed_ip text check (signed_ip is null or char_length(signed_ip) <= 64),
  add column signed_ua text check (signed_ua is null or char_length(signed_ua) <= 500);
grant select (signed_at, signed_ip, signed_ua) on public.contract_signers to authenticated;

-- Door 2: the signed contract and its audit log, as DocuSeal produced them, unchanged. One of each kind per request.
create table public.contract_signed_documents (
  request_id uuid not null,
  org_id uuid not null references public.orgs (id) on delete cascade,
  kind text not null check (kind in ('signed', 'audit_log')),
  content bytea not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  stored_at timestamptz not null default now(),
  primary key (request_id, kind),
  foreign key (request_id, org_id) references public.contract_signature_requests (id, org_id) on delete cascade
);
create index contract_signed_documents_org_id_idx on public.contract_signed_documents (org_id);

alter table public.contract_signed_documents enable row level security;
create policy contract_signed_documents_select on public.contract_signed_documents for select to authenticated
  using ((select private.is_org_member(org_id)));
revoke all on public.contract_signed_documents from anon, authenticated;
grant select on public.contract_signed_documents to authenticated;

-- A stored document is never updated or deleted. A delete that comes from a cascade (a request or an org going away)
-- runs one trigger level deeper than a statement of its own, and is let through.
create function private.contract_signed_documents_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'a stored signed document is never changed' using errcode = '55000';
end $$;

create trigger contract_signed_documents_immutable
  before update or delete on public.contract_signed_documents
  for each row execute function private.contract_signed_documents_immutable();

-- Door 3: contract status stops being a staff write. The only writer of `client_signed`, `completed` and `declined` is
-- `signature_webhook` (through the private mover below).
revoke update (status) on public.contracts from authenticated;
revoke execute on function public.apply_contract_transition(uuid, text, text, text, jsonb) from authenticated;

-- One move of a contract: compare-and-set on the status read under lock, then the event `contract.<to>` with no actor and
-- its outbox row (AD-011, AD-069, AD-136). 40001 if the status changed under it, which a lock already prevents.
create function private.docuseal_move_contract(p_contract_id uuid, p_org_id uuid, p_from text, p_to text, p_payload jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  update public.contracts set status = p_to where id = p_contract_id and org_id = p_org_id and status = p_from;
  if not found then
    raise exception 'contract % is no longer %', p_contract_id, p_from using errcode = '40001';
  end if;
  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (p_org_id, 'contract', p_contract_id, 'contract.' || p_to, p_payload, null)
  returning id into v_event;
  perform private.enqueue_outbox_for_system(v_event);
end $$;
revoke execute on function private.docuseal_move_contract(uuid, uuid, text, text, jsonb) from public, anon, authenticated;

-- Door 1: DocuSeal's webhook. Header `X-Docuseal-Signature: <unix seconds>.<hex>` where hex is
-- HMAC-SHA256(secret, seconds || '.' || raw body), within 300 s of now (DocuSeal's docs, read 2026-11-07). The secret is
-- the Vault secret `docuseal_webhook_secret`; without it every call is refused. Answers `{outcome, reason?}`:
-- `applied` (something was written), `duplicate`, `ignored` (reasons event_not_handled, unknown_submission, request_closed,
-- signer_mismatch) or `documents_needed` (a first call for `submission.completed`: the two file URLs, nothing written).
-- The second call passes `p_documents` = [{kind: 'signed', content: <base64>}, {kind: 'audit_log', content: <base64>}].
-- Errors: 42501 (signature), 22023 (malformed body, event or documents).
create function public.signature_webhook(p_body text, p_signature text, p_documents jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_ts text;
  v jsonb;
  v_event text;
  v_data jsonb;
  v_submission text;
  v_request public.contract_signature_requests;
  v_contract public.contracts;
  v_signer public.contract_signers;
  v_version_no integer;
  v_external text;
  v_completed_at timestamptz;
  v_reason text;
  v_changed boolean := false;
  v_signed bytea;
  v_audit bytea;
  v_element jsonb;
  v_bytes bytea;
  v_signed_url jsonb;
  v_audit_url jsonb;
  v_ignored constant text := 'ignored';
begin
  -- The signature first, and closed: no secret, no answer but 42501.
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'docuseal_webhook_secret';
  if v_secret is null or v_secret = '' or p_body is null or p_signature is null
     or p_signature !~ '^[0-9]{1,12}\.[0-9a-f]{64}$' then
    raise exception 'bad or unconfigured signature' using errcode = '42501';
  end if;
  v_ts := split_part(p_signature, '.', 1);
  if abs(floor(extract(epoch from now()))::bigint - v_ts::bigint) > 300
     or split_part(p_signature, '.', 2) is distinct from encode(extensions.hmac(v_ts || '.' || p_body, v_secret, 'sha256'), 'hex') then
    raise exception 'bad or stale signature' using errcode = '42501';
  end if;

  begin
    v := p_body::jsonb;
  exception when others then
    raise exception 'the body is not JSON' using errcode = '22023';
  end;
  if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v -> 'event_type') is distinct from 'string' then
    raise exception 'the body has no event_type' using errcode = '22023';
  end if;

  -- The documents of the second call, validated before anything is read or written.
  if p_documents is not null then
    if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents) <> 2
       or (select count(distinct e ->> 'kind') from jsonb_array_elements(p_documents) e where e ->> 'kind' in ('signed', 'audit_log')) <> 2 then
      raise exception 'documents must be one signed and one audit_log entry' using errcode = '22023';
    end if;
    for v_element in select * from jsonb_array_elements(p_documents) loop
      if jsonb_typeof(v_element -> 'content') is distinct from 'string' then
        raise exception 'a document has no content' using errcode = '22023';
      end if;
      begin
        v_bytes := decode(v_element ->> 'content', 'base64');
      exception when others then
        raise exception 'a document is not base64' using errcode = '22023';
      end;
      if octet_length(v_bytes) not between 1 and 10485760 or substring(v_bytes from 1 for 5) is distinct from '\x255044462d'::bytea then
        raise exception 'a document is empty, over 10 MiB, or not a PDF' using errcode = '22023';
      end if;
      if v_element ->> 'kind' = 'signed' then v_signed := v_bytes; else v_audit := v_bytes; end if;
    end loop;
  end if;

  v_event := v ->> 'event_type';
  if v_event not in ('form.completed', 'form.declined', 'submission.completed') then
    return jsonb_build_object('outcome', v_ignored, 'reason', 'event_not_handled');
  end if;
  v_data := v -> 'data';
  if jsonb_typeof(v_data) is distinct from 'object' then
    raise exception 'the event has no data' using errcode = '22023';
  end if;

  -- The request by the provider's submission id, locked first and the contract second (the lock order every delivery
  -- takes, so two deliveries of one event take turns).
  v_submission := case when v_event = 'submission.completed' then v_data ->> 'id' else v_data -> 'submission' ->> 'id' end;
  select r.* into v_request from public.contract_signature_requests r
  where r.provider_submission_id = v_submission and v_submission is not null
  order by r.created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('outcome', v_ignored, 'reason', 'unknown_submission');
  end if;
  select c.* into v_contract from public.contracts c where c.id = v_request.contract_id and c.org_id = v_request.org_id for update;
  select w.version_no into v_version_no
  from public.agreement_versions w where w.id = v_contract.agreement_version_id and w.org_id = v_contract.org_id;

  -- A completed request answers only a repeat (and a late form.completed still records its signer's facts).
  if v_request.status = 'completed' then
    if v_event = 'submission.completed' then
      return jsonb_build_object('outcome', 'duplicate');
    elsif v_event = 'form.declined' then
      return jsonb_build_object('outcome', v_ignored, 'reason', 'request_closed');
    end if;
  elsif v_request.status = 'declined' and v_event = 'form.declined' then
    return jsonb_build_object('outcome', 'duplicate');
  elsif v_request.status <> 'open'
     or v_contract.status in ('declined', 'voided')
     or (v_event = 'form.declined' and v_contract.status not in ('pending_signature', 'client_signed')) then
    return jsonb_build_object('outcome', v_ignored, 'reason', 'request_closed');
  end if;

  if v_event in ('form.completed', 'form.declined') then
    v_external := v_data ->> 'external_id';
    select s.* into v_signer from public.contract_signers s
    where s.request_id = v_request.id and s.org_id = v_request.org_id and s.provider_submitter_id = v_data ->> 'id';
    if not found or (v_external is not null and v_external <> v_contract.id::text || ':' || v_signer.role) then
      return jsonb_build_object('outcome', v_ignored, 'reason', 'signer_mismatch');
    end if;
  end if;

  if v_event = 'form.completed' then
    begin
      v_completed_at := (v_data ->> 'completed_at')::timestamptz;
    exception when others then
      v_completed_at := null;
    end;
    if v_completed_at is null then
      raise exception 'form.completed has no completed_at' using errcode = '22023';
    end if;
    if v_signer.signed_at is null then
      update public.contract_signers
      set signed_at = v_completed_at,
          signed_ip = left(nullif(btrim(v_data ->> 'ip'), ''), 64),
          signed_ua = left(nullif(btrim(v_data ->> 'ua'), ''), 500)
      where request_id = v_request.id and org_id = v_request.org_id and role = v_signer.role;
      v_changed := true;
    end if;
    if v_signer.role = 'customer' and v_request.status = 'open' and v_contract.status = 'pending_signature' then
      perform private.docuseal_move_contract(v_contract.id, v_contract.org_id, 'pending_signature', 'client_signed',
        jsonb_build_object('from', 'pending_signature', 'to', 'client_signed', 'versionNo', v_version_no, 'via', 'docuseal', 'requestId', v_request.id));
      v_changed := true;
    end if;
    return jsonb_build_object('outcome', case when v_changed then 'applied' else 'duplicate' end);
  end if;

  if v_event = 'form.declined' then
    v_reason := nullif(left(btrim(coalesce(v_data ->> 'decline_reason', '')), 500), '');
    update public.contract_signature_requests set status = 'declined' where id = v_request.id;
    perform private.docuseal_move_contract(v_contract.id, v_contract.org_id, v_contract.status, 'declined',
      jsonb_build_object('from', v_contract.status, 'to', 'declined', 'versionNo', v_version_no, 'via', 'docuseal', 'requestId', v_request.id, 'reason', v_reason));
    return jsonb_build_object('outcome', 'applied');
  end if;

  -- submission.completed on an open request.
  if p_documents is null then
    v_signed_url := v_data -> 'combined_document_url';
    v_audit_url := v_data -> 'audit_log_url';
    if jsonb_typeof(v_signed_url) is distinct from 'string' or jsonb_typeof(v_audit_url) is distinct from 'string'
       or (v_signed_url #>> '{}') = '' or (v_audit_url #>> '{}') = '' then
      raise exception 'submission.completed has no document urls' using errcode = '22023';
    end if;
    return jsonb_build_object('outcome', 'documents_needed', 'documents', jsonb_build_array(
      jsonb_build_object('kind', 'signed', 'url', v_signed_url #>> '{}'),
      jsonb_build_object('kind', 'audit_log', 'url', v_audit_url #>> '{}')));
  end if;

  insert into public.contract_signed_documents (request_id, org_id, kind, content, size_bytes, sha256)
  select v_request.id, v_request.org_id, d.kind, d.content, octet_length(d.content), encode(sha256(d.content), 'hex')
  from (values ('signed', v_signed), ('audit_log', v_audit)) as d (kind, content);

  if v_contract.status = 'pending_signature' then
    perform private.docuseal_move_contract(v_contract.id, v_contract.org_id, 'pending_signature', 'client_signed',
      jsonb_build_object('from', 'pending_signature', 'to', 'client_signed', 'versionNo', v_version_no, 'via', 'docuseal', 'requestId', v_request.id));
    v_contract.status := 'client_signed';
  end if;
  if v_contract.status = 'client_signed' then
    perform private.docuseal_move_contract(v_contract.id, v_contract.org_id, 'client_signed', 'completed',
      jsonb_build_object('from', 'client_signed', 'to', 'completed', 'versionNo', v_version_no, 'via', 'docuseal', 'requestId', v_request.id));
  end if;
  update public.contract_signature_requests set status = 'completed', completed_at = now() where id = v_request.id;
  return jsonb_build_object('outcome', 'applied');
end $$;

revoke execute on function public.signature_webhook(text, text, jsonb) from public;
grant execute on function public.signature_webhook(text, text, jsonb) to anon, authenticated;
