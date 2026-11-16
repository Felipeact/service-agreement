-- A draft agreement can switch the template it is pinned to (.specs/features/agreement-template-switch/). Only the pin changes: the
-- service lines, the term and the scope stay as the estimator left them. The pin of any version that is not the current version of
-- a draft stays frozen (agreement_version_pin_frozen, 20261112240000).
-- NOT applied to the hosted project: applying it needs the owner's go-ahead.
--
-- 42501: the caller may not write the agreement (a viewer, another org, a frozen org). P0002: no such agreement. P0001: the agreement
-- is not a draft. 22023: the template version is not an agreement template of the org or the system.
create function public.set_agreement_template(p_agreement_id uuid, p_template_version_id uuid)
returns void
language plpgsql security definer
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
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'agreement % is no longer a draft', p_agreement_id using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
    where tv.id = p_template_version_id and t.kind = 'agreement' and (tv.org_id is null or tv.org_id = v_org)
  ) then
    raise exception 'template version % is not an agreement template of this org', p_template_version_id using errcode = '22023';
  end if;

  update public.agreement_versions v
  set template_version_id = p_template_version_id
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id)
    and v.template_version_id is distinct from p_template_version_id;
end $$;

revoke execute on function public.set_agreement_template(uuid, uuid) from public, anon;
grant execute on function public.set_agreement_template(uuid, uuid) to authenticated;
