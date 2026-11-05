-- Deactivation door 6, corrected: the site is locked `for share` only after the role check. A `for share` read needs
-- the update policy to pass, so reading the site that way first made a viewer's call answer P0002 instead of 42501
-- (agreement-builder C738).
create or replace function public.create_agreement(p_site_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_inactive boolean;
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
  -- A create waits for a deactivation in flight instead of reading the site as active.
  select s.deactivated_at is not null into v_inactive from public.sites s where s.id = p_site_id for share;
  if v_inactive then
    raise exception 'site % is inactive', p_site_id using errcode = '55000', hint = 'site_inactive';
  end if;

  -- Two creates in one org take turns here, so they cannot read the same highest number.
  perform pg_advisory_xact_lock(hashtextextended('agreement_number:' || v_org::text, 0));
  select 'AG-' || (coalesce(max(substring(a.number from '^AG-([0-9]+)$')::integer), 1000) + 1) into v_number
  from public.agreements a where a.org_id = v_org;

  insert into public.agreements (org_id, site_id, number) values (v_org, p_site_id, v_number)
  returning id into v_agreement;
  insert into public.agreement_versions (org_id, agreement_id, version_no, term_months)
  values (v_org, v_agreement, 1,
          coalesce((select s.default_term_months from public.org_settings s where s.org_id = v_org), 12));
  return v_agreement;
end $$;
