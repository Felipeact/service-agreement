-- Deactivation (.specs/features/deactivation/plan.md). Customers, sites and assets are deactivated, never deleted.

-- Door 1: the inactive marker, when and by whom, set together.
alter table public.customers
  add column deactivated_at timestamptz,
  add column deactivated_by uuid,
  add constraint customers_deactivated_together check ((deactivated_at is null) = (deactivated_by is null));
alter table public.sites
  add column deactivated_at timestamptz,
  add column deactivated_by uuid,
  add constraint sites_deactivated_together check ((deactivated_at is null) = (deactivated_by is null));
alter table public.assets
  add column deactivated_at timestamptz,
  add column deactivated_by uuid,
  add constraint assets_deactivated_together check ((deactivated_at is null) = (deactivated_by is null));

-- Door 4: a removed unit links to the unit that replaced it, on the same site.
alter table public.assets
  add column replaced_by_asset_id uuid,
  add constraint assets_id_site_id_key unique (id, site_id),
  add constraint assets_replaced_by_same_site foreign key (replaced_by_asset_id, site_id) references public.assets (id, site_id),
  add constraint assets_replaced_by_not_self check (replaced_by_asset_id <> id),
  add constraint assets_replaced_by_only_inactive check (replaced_by_asset_id is null or deactivated_at is not null);
create index assets_replaced_by_idx on public.assets (replaced_by_asset_id, site_id);

-- Door 2: members update only the columns the forms edit; the deactivation columns have one writer each (door 3),
-- and an asset is never deleted (supersedes AD-030 for assets).
revoke update on public.customers, public.sites, public.assets from authenticated;
grant update (name) on public.customers to authenticated;
grant update (name, address, site_contact_id) on public.sites to authenticated;
grant update (asset_type_id, unit_no, type_model, location) on public.assets to authenticated;
revoke delete on public.assets from authenticated;

-- Door 5: refuses with 55000 when a site cannot be deactivated. The detail is JSON the app reads.
create function private.assert_site_deactivatable(p_site_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Vancouver')::date;
  v_site text;
  v_number text;
  v_end date;
begin
  select s.name into v_site from public.sites s where s.id = p_site_id;

  select a.number, v.term_end into v_number, v_end
  from public.agreements a
  join lateral (
    select w.term_end from public.agreement_versions w
    where w.agreement_id = a.id and w.org_id = a.org_id order by w.version_no desc limit 1) v on true
  where a.site_id = p_site_id
    and a.status = 'accepted'
    and (v.term_end is null
         or v.term_end >= v_today
         or exists (select 1 from public.contracts c
                    join public.agreement_versions cv on cv.id = c.agreement_version_id and cv.org_id = c.org_id
                    where cv.agreement_id = a.id and c.status in ('pending_signature', 'client_signed', 'completed')))
  order by v.term_end desc nulls first, a.id
  limit 1;
  if found then
    raise exception 'site % has an agreement in term', p_site_id using errcode = '55000', hint = 'in_term',
      detail = jsonb_build_object('site', v_site, 'number', v_number, 'termEnd', v_end)::text;
  end if;

  select a.number into v_number from public.agreements a
  where a.site_id = p_site_id and a.status = 'changes_requested' order by a.id limit 1;
  if found then
    raise exception 'site % has changes requested', p_site_id using errcode = '55000', hint = 'changes_requested',
      detail = jsonb_build_object('site', v_site, 'number', v_number)::text;
  end if;
end $$;

-- Withdraws the site's draft or sent agreement through the one transition writer (AD-015), then stamps the site.
-- The caller has checked membership, role and the rule above.
create function private.deactivate_site(p_site_id uuid, p_at timestamptz)
returns uuid[]
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  v_withdrawn uuid[] := '{}';
begin
  for r in
    select a.id, a.status from public.agreements a
    where a.site_id = p_site_id and a.status in ('draft', 'sent')
    order by a.id
  loop
    perform public.apply_agreement_transition(r.id, r.status, 'withdrawn', 'agreement.withdrawn',
      jsonb_build_object('from', r.status, 'to', 'withdrawn', 'via', 'deactivation'));
    v_withdrawn := v_withdrawn || r.id;
  end loop;
  update public.sites set deactivated_at = p_at, deactivated_by = auth.uid() where id = p_site_id;
  return v_withdrawn;
end $$;

revoke execute on function private.assert_site_deactivatable(uuid) from public, anon, authenticated;
revoke execute on function private.deactivate_site(uuid, timestamptz) from public, anon, authenticated;

-- Door 3: the writers. Definer, because door 2 keeps the columns from members; each checks membership and role
-- itself, so another org's row reads as missing (as save_agreement_term, AD-090).
create function public.set_site_active(p_site_id uuid, p_active boolean)
returns uuid[]
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_customer uuid;
  v_at timestamptz;
  v_customer_name text;
  v_customer_at timestamptz;
begin
  select s.org_id, s.customer_id, s.deactivated_at into v_org, v_customer, v_at
  from public.sites s where s.id = p_site_id for update;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'site % not found', p_site_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change site %', p_site_id using errcode = '42501';
  end if;

  if p_active then
    if v_at is null then
      return '{}';
    end if;
    select c.name, c.deactivated_at into v_customer_name, v_customer_at from public.customers c where c.id = v_customer;
    if v_customer_at is not null then
      raise exception 'customer of site % is inactive', p_site_id using errcode = '55000', hint = 'customer_inactive',
        detail = jsonb_build_object('customer', v_customer_name)::text;
    end if;
    update public.sites set deactivated_at = null, deactivated_by = null where id = p_site_id;
    return '{}';
  end if;

  if v_at is not null then
    return '{}';
  end if;
  perform private.assert_site_deactivatable(p_site_id);
  return private.deactivate_site(p_site_id, now());
end $$;

create function public.set_customer_active(p_customer_id uuid, p_active boolean)
returns uuid[]
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_at timestamptz;
  v_now timestamptz := now();
  v_site uuid;
  v_withdrawn uuid[] := '{}';
begin
  select c.org_id, c.deactivated_at into v_org, v_at from public.customers c where c.id = p_customer_id for update;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'customer % not found', p_customer_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change customer %', p_customer_id using errcode = '42501';
  end if;

  if p_active then
    -- The customer only: a site deactivated on its own must not come back with it.
    if v_at is not null then
      update public.customers set deactivated_at = null, deactivated_by = null where id = p_customer_id;
    end if;
    return '{}';
  end if;

  if v_at is not null then
    return '{}';
  end if;
  -- Every active site is checked before any is changed.
  for v_site in
    select s.id from public.sites s
    where s.customer_id = p_customer_id and s.deactivated_at is null order by s.created_at, s.id for update
  loop
    perform private.assert_site_deactivatable(v_site);
  end loop;
  for v_site in
    select s.id from public.sites s
    where s.customer_id = p_customer_id and s.deactivated_at is null order by s.created_at, s.id
  loop
    v_withdrawn := v_withdrawn || private.deactivate_site(v_site, v_now);
  end loop;
  update public.customers set deactivated_at = v_now, deactivated_by = auth.uid() where id = p_customer_id;
  return v_withdrawn;
end $$;

create function public.set_asset_active(p_asset_id uuid, p_active boolean, p_replaced_by uuid default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_site uuid;
  v_at timestamptz;
  v_site_name text;
  v_site_at timestamptz;
begin
  select a.org_id, a.site_id, a.deactivated_at into v_org, v_site, v_at
  from public.assets a where a.id = p_asset_id for update;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'asset % not found', p_asset_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change asset %', p_asset_id using errcode = '42501';
  end if;

  if p_active then
    if v_at is null then
      return;
    end if;
    select s.name, s.deactivated_at into v_site_name, v_site_at from public.sites s where s.id = v_site;
    if v_site_at is not null then
      raise exception 'site of asset % is inactive', p_asset_id using errcode = '55000', hint = 'site_inactive',
        detail = jsonb_build_object('site', v_site_name)::text;
    end if;
    update public.assets set deactivated_at = null, deactivated_by = null, replaced_by_asset_id = null where id = p_asset_id;
    return;
  end if;

  if v_at is not null then
    return;
  end if;
  if p_replaced_by is not null and not exists (
    select 1 from public.assets r
    where r.id = p_replaced_by and r.site_id = v_site and r.org_id = v_org and r.id <> p_asset_id and r.deactivated_at is null
  ) then
    raise exception 'asset % cannot be replaced by %', p_asset_id, p_replaced_by using errcode = '23514',
      hint = 'replacement_invalid';
  end if;
  update public.assets set deactivated_at = now(), deactivated_by = auth.uid(), replaced_by_asset_id = p_replaced_by
  where id = p_asset_id;
end $$;

revoke execute on function public.set_site_active(uuid, boolean) from public, anon;
grant execute on function public.set_site_active(uuid, boolean) to authenticated;
revoke execute on function public.set_customer_active(uuid, boolean) from public, anon;
grant execute on function public.set_customer_active(uuid, boolean) to authenticated;
revoke execute on function public.set_asset_active(uuid, boolean, uuid) from public, anon;
grant execute on function public.set_asset_active(uuid, boolean, uuid) to authenticated;

-- Door 6: an inactive site starts no agreement. The site is read `for share`, so a create waits for a deactivation
-- in flight instead of reading the site as active. Otherwise as term-dates left it (AD-051, AD-053, AD-093).
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
  select s.org_id, s.deactivated_at is not null into v_org, v_inactive from public.sites s where s.id = p_site_id for share;
  if v_org is null then
    raise exception 'site % not found', p_site_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create an agreement for site %', p_site_id using errcode = '42501';
  end if;
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

-- Door 6: W7 renews nothing on an inactive site. Otherwise as renewal left it (AD-097, AD-098).
create or replace function private.run_renewals(p_run_date date)
returns setof uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  d record;
  v_cap numeric;
  v_threshold numeric;
  v_applied numeric;
  v_reason text;
  v_number text;
  v_new uuid;
  v_version uuid;
  v_line record;
  v_copy uuid;
  v_event uuid;
  v_constraint text;
begin
  -- Two runs take turns, so the second finds what the first created.
  perform pg_advisory_xact_lock(hashtext('renewals'));

  for d in
    select a.id, a.org_id, a.site_id, v.id as version_id, v.snapshot, v.term_end, v.term_months,
           s.renewal_cpi_pct, s.renewal_cpi_as_of, s.cpi_renegotiation_threshold_pct as org_threshold
    from public.agreements a
    join public.sites site on site.id = a.site_id and site.org_id = a.org_id
    join lateral (
      select w.* from public.agreement_versions w
      where w.agreement_id = a.id and w.org_id = a.org_id order by w.version_no desc limit 1) v on true
    left join public.org_settings s on s.org_id = a.org_id
    where a.status = 'accepted'
      and site.deactivated_at is null
      and v.term_end is not null
      and v.term_end - coalesce((v.snapshot -> 'terms' ->> 'renewalNoticeDays')::integer, s.renewal_notice_days, 30)
          <= p_run_date
      and not exists (select 1 from public.agreements r where r.renews_agreement_id = a.id)
    order by v.term_end, a.id
  loop
    v_cap := (d.snapshot -> 'terms' ->> 'cpiCapPct')::numeric;
    v_threshold := coalesce((d.snapshot -> 'terms' ->> 'cpiRenegotiationThresholdPct')::numeric, d.org_threshold, 5);
    v_reason := case
      when d.renewal_cpi_pct is null or v_cap is null then 'cpi_unset'
      when d.renewal_cpi_as_of < p_run_date - interval '13 months' then 'cpi_stale'
      when d.renewal_cpi_pct >= v_threshold then 'at_threshold'
    end;
    v_applied := case when v_reason is null then greatest(0, least(d.renewal_cpi_pct, v_cap)) else 0 end;

    begin
      perform pg_advisory_xact_lock(hashtextextended('agreement_number:' || d.org_id::text, 0));
      select 'AG-' || (coalesce(max(substring(a.number from '^AG-([0-9]+)$')::integer), 1000) + 1) into v_number
      from public.agreements a where a.org_id = d.org_id;

      insert into public.agreements (org_id, site_id, number, renews_agreement_id)
      values (d.org_id, d.site_id, v_number, d.id)
      returning id into v_new;
      insert into public.agreement_versions (org_id, agreement_id, version_no, term_start, term_months, snapshot)
      values (d.org_id, v_new, 1, d.term_end + 1, d.term_months,
              case when v_reason is null then d.snapshot else '{}'::jsonb end)
      returning id into v_version;

      for v_line in
        select l.id, l.position, l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents
        from public.service_lines l
        where l.agreement_version_id = d.version_id and l.org_id = d.org_id
        order by l.position, l.created_at
      loop
        insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months,
                                          visits_per_year, cost_per_visit_cents)
        values (d.org_id, v_version, v_line.position, v_line.description, v_line.visit_months, v_line.visits_per_year,
                round(v_line.cost_per_visit_cents * (1 + v_applied / 100))::bigint)
        returning id into v_copy;
        insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
        select c.org_id, v_copy, c.asset_type_id from public.service_line_asset_types c where c.service_line_id = v_line.id;
      end loop;

      if v_reason is null then
        update public.agreements set status = 'accepted', updated_at = now() where id = v_new;
        insert into public.events (org_id, entity_type, entity_id, type, payload)
        values (d.org_id, 'agreement', v_new, 'agreement.renewed', jsonb_build_object(
          'renewsAgreementId', d.id, 'cpiPct', d.renewal_cpi_pct, 'appliedPct', v_applied,
          'cpiAsOf', d.renewal_cpi_as_of))
        returning id into v_event;
      else
        insert into public.events (org_id, entity_type, entity_id, type, payload)
        values (d.org_id, 'agreement', v_new, 'agreement.renewal_drafted', jsonb_build_object(
          'renewsAgreementId', d.id, 'cpiPct', d.renewal_cpi_pct, 'cpiAsOf', d.renewal_cpi_as_of,
          'reason', v_reason))
        returning id into v_event;
      end if;
      perform private.enqueue_outbox_for_system(v_event);
      return next v_new;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'agreements_one_live_per_site' then
        raise;
      end if;
    end;
  end loop;
end $$;

revoke execute on function private.run_renewals(date) from public, anon, authenticated;

-- Door 7: a removed unit is not in the next draft's scope. Frozen snapshots are never rewritten (AD-086).
create or replace function public.site_service_scope(p_site_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object('schema', 2, 'types', coalesce(jsonb_agg(g.doc order by g.name, g.code), '[]'::jsonb))
  from (
    select t.code, t.name, jsonb_build_object(
      'code', t.code,
      'name', t.name,
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('description', k.description, 'visitMonths', to_jsonb(k.visit_months))
                                          order by k.position, k.created_at, k.id)
                         from public.asset_type_tasks k
                         where k.asset_type_id = t.id and k.org_id = t.org_id), '[]'::jsonb),
      'assets', jsonb_agg(jsonb_build_object('unitNo', a.unit_no, 'typeModel', a.type_model, 'location', a.location)
                          order by a.unit_no nulls last, a.created_at, a.id)
    ) as doc
    from public.assets a
    join public.asset_types t on t.id = a.asset_type_id and t.org_id = a.org_id
    where a.site_id = p_site_id and a.deactivated_at is null
    group by t.id, t.org_id, t.code, t.name
  ) g
$$;

revoke execute on function public.site_service_scope(uuid) from public, anon;
grant execute on function public.site_service_scope(uuid) to authenticated;
