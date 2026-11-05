-- Contract generation (.specs/features/contract-generation/plan.md). An accepted agreement becomes one contract whose
-- parties are frozen when staff generate it.

-- Door 1: who the contract binds. `{}` means not recorded (AD-058's rule for `snapshot`), which keeps every insert that
-- names two columns valid; `create_contract` always writes schema 1.
alter table public.contracts
  add column parties jsonb not null default '{}'
    constraint contracts_parties_object check (jsonb_typeof(parties) = 'object');

-- Door 2: members no longer insert or delete contracts, and update only the status, which `apply_contract_transition`
-- (security invoker) writes. The writer is `create_contract`.
revoke insert, update, delete on public.contracts from authenticated;
grant update (status) on public.contracts to authenticated;

-- Door 5: the one place that decides who signs for the customer: the site's approver, else its site contact, among those
-- with an email. `customer_recipient` is now its email, so the email that goes out and the name on the contract agree.
create function private.customer_signer(p_site_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('name', c.name, 'email', btrim(c.email)) from public.sites s
      join public.contacts c on c.id = s.approver_contact_id and c.customer_id = s.customer_id
      where s.id = p_site_id and nullif(btrim(c.email), '') is not null),
    (select jsonb_build_object('name', c.name, 'email', btrim(c.email)) from public.sites s
      join public.contacts c on c.id = s.site_contact_id and c.customer_id = s.customer_id
      where s.id = p_site_id and nullif(btrim(c.email), '') is not null));
$$;
revoke execute on function private.customer_signer(uuid) from public, anon, authenticated;

create or replace function private.customer_recipient(p_site_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select private.customer_signer(p_site_id) ->> 'email';
$$;

-- The parties document (door 1) for a site, as it stands now. Used by `create_contract`, by the backfill below and by
-- `seed.sql`, so there is one builder.
create function private.contract_parties(p_site_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schema', 1,
    'contractor', jsonb_build_object('legalName', os.legal_name, 'address', os.address, 'phone', os.phone),
    'customer', jsonb_build_object('name', cu.name),
    'site', jsonb_build_object('name', st.name, 'address', st.address),
    'signer', private.customer_signer(st.id))
  from public.sites st
  join public.customers cu on cu.id = st.customer_id and cu.org_id = st.org_id
  left join public.org_settings os on os.org_id = st.org_id
  where st.id = p_site_id;
$$;
revoke execute on function private.contract_parties(uuid) from public, anon, authenticated;

-- Door 6: the signer, for the confirm step, before any contract exists. A member of the site's org gets it; anyone else null.
create function public.contract_signer(p_site_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select private.customer_signer(s.id) from public.sites s
  where s.id = p_site_id and (select private.is_org_member(s.org_id));
$$;
revoke execute on function public.contract_signer(uuid) from public, anon;
grant execute on function public.contract_signer(uuid) to authenticated;

-- Doors 2 and 3: the only writer of a contract. The agreement is locked after the role check, so two calls for one
-- agreement take turns and the second finds the first one's contract; `contracts_agreement_version_id_key` backs that up.
-- Refusals are `55000` with a hint, in this order: not_accepted, auto_renewal, site_inactive, no_term_start, no_signer.
create function public.create_contract(p_agreement_id uuid)
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
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create a contract for agreement %', p_agreement_id using errcode = '42501';
  end if;

  select a.status, a.site_id into v_status, v_site from public.agreements a where a.id = p_agreement_id for update;
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
  -- A deactivation in flight is waited for, not read as active (create_agreement does the same).
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
          jsonb_build_object('from', null::text, 'to', 'pending_signature', 'versionNo', v_version_no), auth.uid());
  return v_contract;
end $$;
revoke execute on function public.create_contract(uuid) from public, anon;
grant execute on function public.create_contract(uuid) to authenticated;

-- The contracts that exist (the demo's, from seed.sql) get their parties from today's settings, as service-included did
-- for snapshots. Fictitious data only: nothing wrote a contract before this migration.
update public.contracts c
set parties = private.contract_parties(a.site_id)
from public.agreement_versions v
join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
where v.id = c.agreement_version_id and v.org_id = c.org_id and c.parties = '{}';
