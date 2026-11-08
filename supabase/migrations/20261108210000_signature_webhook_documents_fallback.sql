-- signature-webhook, found in the live run of contract-automation (C1819): when a submission's combined_document_url is null,
-- the signed PDF is the first entry of documents[]. Only the extraction of the signed file's address changes; grants stay.

create or replace function public.signature_webhook(p_body text, p_signature text, p_documents jsonb default null)
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
    -- Found in the live run (2026-11-08): this DocuSeal account sends combined_document_url as null; the signed PDF is documents[0].url.
    v_signed_url := coalesce(nullif(v_data -> 'combined_document_url', 'null'::jsonb), v_data #> '{documents,0,url}');
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
