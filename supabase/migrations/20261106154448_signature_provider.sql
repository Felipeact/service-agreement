-- Signature provider (.specs/features/signature-provider/plan.md). A contract is sent to DocuSeal for signature: one request
-- per attempt, with a customer signer and a contractor signer. The provider's embed links and the customer's link are
-- stored sealed (AD-077's way), so a database read, or a member, cannot sign as the customer.

-- Door 9: the parent key every tenant reference needs (AD-003). `contracts` was created without it.
alter table public.contracts add constraint contracts_id_org_id_key unique (id, org_id);

-- Door 2: what is stored. `status` is text with a check (AD-005); item 3 extends it and adds `completed_at`.
create table public.contract_signature_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  contract_id uuid not null,
  status text not null default 'creating' check (status in ('creating', 'open', 'failed', 'voided')),
  provider text not null default 'docuseal' check (provider in ('docuseal')),
  provider_submission_id text check (provider_submission_id is null or btrim(provider_submission_id) <> ''),
  document_sha256 text check (document_sha256 is null or document_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (contract_id, org_id) references public.contracts (id, org_id),
  constraint contract_signature_requests_open_has_document
    check (status <> 'open' or (provider_submission_id is not null and document_sha256 is not null))
);
create index contract_signature_requests_org_id_idx on public.contract_signature_requests (org_id);
create index contract_signature_requests_contract_id_idx on public.contract_signature_requests (contract_id, org_id);
-- A contract has at most one request being made or waiting for signatures.
create unique index contract_signature_requests_one_live on public.contract_signature_requests (contract_id)
  where status in ('creating', 'open');

create table public.contract_signers (
  request_id uuid not null,
  org_id uuid not null references public.orgs (id) on delete cascade,
  role text not null check (role in ('customer', 'contractor')),
  name text not null check (btrim(name) <> ''),
  email text not null check (btrim(email) <> ''),
  provider_submitter_id text check (provider_submitter_id is null or btrim(provider_submitter_id) <> ''),
  embed_sealed text check (embed_sealed is null or embed_sealed ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'),
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  link_sealed text check (link_sealed is null or link_sealed ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$'),
  primary key (request_id, role),
  foreign key (request_id, org_id) references public.contract_signature_requests (id, org_id) on delete cascade,
  -- Only the customer has a link of its own; the contractor signs inside the signed-in app.
  constraint contract_signers_customer_has_link check ((role = 'customer') = (token_hash is not null)),
  constraint contract_signers_link_is_customers check (role = 'customer' or link_sealed is null)
);
create index contract_signers_org_id_idx on public.contract_signers (org_id);

alter table public.contract_signature_requests enable row level security;
alter table public.contract_signers enable row level security;
create policy contract_signature_requests_select on public.contract_signature_requests for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy contract_signers_select on public.contract_signers for select to authenticated
  using ((select private.is_org_member(org_id)));

-- Members read the columns that hold no secret and write nothing; the functions below are the writers (door 3).
revoke all on public.contract_signature_requests from anon, authenticated;
revoke all on public.contract_signers from anon, authenticated;
grant select (id, org_id, contract_id, status, provider, provider_submission_id, document_sha256, created_by, created_at)
  on public.contract_signature_requests to authenticated;
grant select (request_id, org_id, role, name, email, provider_submitter_id) on public.contract_signers to authenticated;

-- Door 3: begin. The caller must be an owner or admin of the contract's org (the contractor signs for the company). The
-- contract is locked after the role check, so two sends for one contract take turns and the second sees the first's request;
-- the partial unique index backs that up. Refusals: P0002, 42501, 23514 / invalid_name, then 55000 with the hints
-- not_pending, parties_missing, already_open.
create function public.begin_signature_request(p_contract_id uuid, p_contractor_name text, p_customer_token_hash text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_parties jsonb;
  v_name text := btrim(coalesce(p_contractor_name, ''));
  v_email text;
  v_request uuid;
begin
  select c.org_id into v_org from public.contracts c where c.id = p_contract_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'contract % not found', p_contract_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to send contract % for signature', p_contract_id using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'the signer name must be 1 to 120 characters' using errcode = '23514', hint = 'invalid_name';
  end if;
  if p_customer_token_hash is null or p_customer_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'malformed signing token hash' using errcode = '22023';
  end if;

  select c.status, c.parties into v_status, v_parties from public.contracts c where c.id = p_contract_id for update;
  if v_status <> 'pending_signature' then
    raise exception 'contract % is not pending signature', p_contract_id using errcode = '55000', hint = 'not_pending';
  end if;
  if jsonb_typeof(v_parties -> 'signer') is distinct from 'object' then
    raise exception 'contract % has no recorded signer', p_contract_id using errcode = '55000', hint = 'parties_missing';
  end if;
  if exists (select 1 from public.contract_signature_requests r
             where r.contract_id = p_contract_id and r.org_id = v_org and r.status in ('creating', 'open')) then
    raise exception 'contract % already has a live signature request', p_contract_id using errcode = '55000', hint = 'already_open';
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();

  insert into public.contract_signature_requests (org_id, contract_id) values (v_org, p_contract_id) returning id into v_request;
  insert into public.contract_signers (request_id, org_id, role, name, email, token_hash) values
    (v_request, v_org, 'customer', v_parties -> 'signer' ->> 'name', v_parties -> 'signer' ->> 'email', p_customer_token_hash),
    (v_request, v_org, 'contractor', v_name, v_email, null);
  return v_request;
end $$;

-- Door 3: complete. The app made the request at the provider; this stores what came back and opens the request. The
-- signers document is `[{"role", "submitterId", "embedSealed"}, ...]` for exactly the two roles.
create function public.complete_signature_request(
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
          jsonb_build_object('requestId', p_request_id, 'provider', 'docuseal', 'versionNo', v_version_no), auth.uid());
end $$;

-- Door 3: fail. Only a request still being made can fail; a repeat, or a request that is already open, changes nothing.
create function public.fail_signature_request(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select r.org_id into v_org from public.contract_signature_requests r where r.id = p_request_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'signature request % not found', p_request_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to fail signature request %', p_request_id using errcode = '42501';
  end if;
  update public.contract_signature_requests set status = 'failed' where id = p_request_id and status = 'creating';
end $$;

-- Door 3: the customer's page. The second anonymous read (after portal_view): the token's hash finds the customer signer.
-- The sealed embed link is withheld unless the request is open and the contract still waits for the customer.
create function public.signature_view(p_token_hash text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_signer public.contract_signers;
  v_request public.contract_signature_requests;
  v_contract public.contracts;
  v_number text;
begin
  select s.* into v_signer from public.contract_signers s where s.token_hash = p_token_hash and s.role = 'customer';
  if not found then
    return null;
  end if;
  select r.* into v_request from public.contract_signature_requests r where r.id = v_signer.request_id and r.org_id = v_signer.org_id;
  if v_request.status = 'creating' then
    return null;
  end if;
  select c.* into v_contract from public.contracts c where c.id = v_request.contract_id and c.org_id = v_request.org_id;
  select a.number into v_number
  from public.agreement_versions v join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  where v.id = v_contract.agreement_version_id and v.org_id = v_contract.org_id;

  return jsonb_build_object(
    'tenant', (select jsonb_build_object('name', o.legal_name, 'address', o.address, 'phone', o.phone, 'accent', o.accent_color)
               from public.org_settings o where o.org_id = v_request.org_id),
    'agreement', jsonb_build_object('number', v_number),
    'signer', jsonb_build_object('name', v_signer.name),
    'contractStatus', v_contract.status,
    'requestStatus', v_request.status,
    'embedSealed', case when v_request.status = 'open' and v_contract.status = 'pending_signature' then v_signer.embed_sealed end);
end $$;

-- Door 3: the contractor's embed link, for an owner or admin, once the customer has signed.
create function public.contractor_signing_source(p_contract_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_sealed text;
begin
  select c.org_id, c.status into v_org, v_status from public.contracts c where c.id = p_contract_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'contract % not found', p_contract_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to countersign contract %', p_contract_id using errcode = '42501';
  end if;
  if v_status <> 'client_signed' then
    raise exception 'contract % is not waiting for the contractor', p_contract_id using errcode = '55000', hint = 'not_client_signed';
  end if;
  select s.embed_sealed into v_sealed
  from public.contract_signature_requests r
  join public.contract_signers s on s.request_id = r.id and s.org_id = r.org_id and s.role = 'contractor'
  where r.contract_id = p_contract_id and r.org_id = v_org and r.status = 'open'
  order by r.created_at desc limit 1;
  if v_sealed is null then
    raise exception 'contract % has no open signature request', p_contract_id using errcode = '55000', hint = 'no_request';
  end if;
  return v_sealed;
end $$;

-- Door 3: the customer's link, rebuilt by the app for an owner or admin from the sealed token.
create function public.customer_signing_link(p_contract_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_sealed text;
begin
  select c.org_id into v_org from public.contracts c where c.id = p_contract_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'contract % not found', p_contract_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to read the signing link of contract %', p_contract_id using errcode = '42501';
  end if;
  select s.link_sealed into v_sealed
  from public.contract_signature_requests r
  join public.contract_signers s on s.request_id = r.id and s.org_id = r.org_id and s.role = 'customer'
  where r.contract_id = p_contract_id and r.org_id = v_org and r.status = 'open'
  order by r.created_at desc limit 1;
  if v_sealed is null then
    raise exception 'contract % has no open signature request', p_contract_id using errcode = '55000', hint = 'no_request';
  end if;
  return v_sealed;
end $$;

revoke execute on function public.begin_signature_request(uuid, text, text) from public, anon;
revoke execute on function public.complete_signature_request(uuid, text, jsonb, text, text) from public, anon;
revoke execute on function public.fail_signature_request(uuid) from public, anon;
revoke execute on function public.signature_view(text) from public;
revoke execute on function public.contractor_signing_source(uuid) from public, anon;
revoke execute on function public.customer_signing_link(uuid) from public, anon;
grant execute on function public.begin_signature_request(uuid, text, text) to authenticated;
grant execute on function public.complete_signature_request(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.fail_signature_request(uuid) to authenticated;
grant execute on function public.signature_view(text) to anon, authenticated;
grant execute on function public.contractor_signing_source(uuid) to authenticated;
grant execute on function public.customer_signing_link(uuid) to authenticated;
