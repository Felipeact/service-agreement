-- contract-templates (.specs/features/contract-templates/plan.md): the wording of a contract becomes immutable, versioned data
-- that each contract points at.
-- Door 1: templates and their versions; rows with no org are the system's own and every member reads them. A version is never
-- updated, and never deleted except with the org that owns it.
-- Door 2: contracts.template_version_id. The column default is the system contract template's version 1, which is also what
-- every existing contract was drawn from, so adding the column backfills them truthfully.
-- Door 3: body = { "schema": 1, "blocks": [ { "type": "heading" | "paragraph" | "clause", "text": "..." } ] }.
-- Door 4: the merge-variable names are the list in web/domain/contract/template.ts; a parity test keeps this body equal to the
-- code's copy of the system wording.

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs (id) on delete cascade,
  kind text not null check (kind in ('agreement', 'contract')),
  created_at timestamptz not null default now()
);
-- One template per org per kind, and exactly one system template per kind (org_id null counts as one value).
create unique index document_templates_one_per_org_kind
  on public.document_templates (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);
create index document_templates_org_id_idx on public.document_templates (org_id);

create table public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates (id) on delete cascade,
  org_id uuid references public.orgs (id) on delete cascade,
  version_no integer not null check (version_no > 0),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);
create index document_template_versions_org_id_idx on public.document_template_versions (org_id);

-- A version never changes. It is deleted only when the org that owns it is deleted (the org row is already gone when the
-- cascade reaches here); a system version is never deleted.
create function private.template_version_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'a template version cannot be changed' using errcode = '55000', hint = 'template_version_frozen';
  end if;
  if old.org_id is null or exists (select 1 from public.orgs o where o.id = old.org_id) then
    raise exception 'a template version cannot be deleted' using errcode = '55000', hint = 'template_version_frozen';
  end if;
  return old;
end $$;

create trigger document_template_versions_frozen
  before update or delete on public.document_template_versions
  for each row execute function private.template_version_frozen();

alter table public.document_templates enable row level security;
alter table public.document_template_versions enable row level security;
revoke all on public.document_templates, public.document_template_versions from public, anon, authenticated;
grant select on public.document_templates, public.document_template_versions to authenticated;
create policy document_templates_select on public.document_templates for select to authenticated
  using (org_id is null or (select private.is_org_member(org_id)));
create policy document_template_versions_select on public.document_template_versions for select to authenticated
  using (org_id is null or (select private.is_org_member(org_id)));

-- The system contract template and its version 1: the six sentences that used to be written in contractClauses().
insert into public.document_templates (id, org_id, kind)
values ('00000000-0000-4000-8000-00000000c001', null, 'contract');
insert into public.document_template_versions (id, template_id, org_id, version_no, body)
values ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c001', null, 1, $body${
  "schema": 1,
  "blocks": [
    { "type": "heading", "text": "Terms" },
    { "type": "clause", "text": "Invoices are payable within {{terms.paymentDays}}." },
    { "type": "clause", "text": "Either party may cancel this contract with {{terms.cancellationNoticeDays}} written notice." },
    { "type": "clause", "text": "Repair work is discounted by {{terms.repairDiscountPct}}." },
    { "type": "clause", "text": "The annual price may rise with CPI, capped at {{terms.cpiCapPct}}." },
    { "type": "clause", "text": "This contract is governed by the laws of {{province}}." },
    { "type": "clause", "text": "This contract renews for successive {{term.label}} terms unless CPI is at or above {{terms.cpiRenegotiationThresholdPct}}, when the parties renegotiate; the customer is notified {{terms.renewalNoticeDays}} before the end date." }
  ]
}$body$::jsonb);

alter table public.contracts
  add column template_version_id uuid not null default '00000000-0000-4000-8000-00000000c101'
  references public.document_template_versions (id);
create index contracts_template_version_id_idx on public.contracts (template_version_id);

-- The same function as before (20261108100000), writing the template version the contract is made from: the org's own latest
-- contract template version, or the system's when the org has none.
create or replace function private.make_contract(p_agreement_id uuid, p_actor uuid, p_via text)
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
  v_template uuid;
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

  select tv.id into v_template
  from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
  where t.kind = 'contract' and t.org_id = v_org
  order by tv.version_no desc limit 1;
  if v_template is null then
    select tv.id into v_template
    from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
    where t.kind = 'contract' and t.org_id is null
    order by tv.version_no desc limit 1;
  end if;

  insert into public.contracts (org_id, agreement_version_id, parties, template_version_id)
  values (v_org, v_version, private.contract_parties(v_site), v_template)
  returning id into v_contract;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'contract', v_contract, 'contract.pending_signature',
          jsonb_build_object('from', null::text, 'to', 'pending_signature', 'versionNo', v_version_no)
          || case when p_via is not null then jsonb_build_object('via', p_via) else '{}'::jsonb end, p_actor);
  return v_contract;
end $$;
revoke execute on function private.make_contract(uuid, uuid, text) from public, anon, authenticated;
