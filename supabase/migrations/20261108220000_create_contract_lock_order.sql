-- contract-automation regression found by C1604 (contract-generation): create_contract must lock the agreement before it
-- reads the contract. 20261108100000 moved the body into private.make_contract, so create_contract's own source no longer
-- showed the lock. It takes the lock and finds an existing contract itself, then lets make_contract apply the rules.
create or replace function public.create_contract(p_agreement_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
  v_contract uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create a contract for agreement %', p_agreement_id using errcode = '42501';
  end if;

  perform 1 from public.agreements a where a.id = p_agreement_id for update;
  select v.id into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
  select c.id into v_contract from public.contracts c where c.agreement_version_id = v_version and c.org_id = v_org;
  if found then
    return v_contract;
  end if;
  return private.make_contract(p_agreement_id, auth.uid(), null);
end $$;
