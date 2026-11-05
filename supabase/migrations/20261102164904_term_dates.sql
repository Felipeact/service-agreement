-- Term dates and renewal settings (.specs/features/term-dates/plan.md). Each version carries a start date and term
-- months, its end date follows, a draft cannot be sent without a start date, and a sent version freezes the tenant's
-- renewal settings beside its other terms.

-- Door 1: the term on a version. The end is the start plus the months, less one day; null while there is no start.
alter table public.agreement_versions
  add column term_start date check (term_start between '2000-01-01' and '2099-12-31'),
  add column term_months smallint not null default 12 check (term_months between 1 and 60),
  add column term_end date generated always as ((term_start + make_interval(months => term_months::integer))::date - 1) stored;

-- Door 2: the tenant's renewal settings, with ROADMAP's defaults.
alter table public.org_settings
  add column default_term_months smallint not null default 12 check (default_term_months between 1 and 60),
  add column renewal_notice_days integer not null default 30 check (renewal_notice_days between 0 and 365),
  add column cpi_renegotiation_threshold_pct numeric(5, 2) not null default 5
    check (cpi_renegotiation_threshold_pct between 0 and 100);

-- Door 5: the terms a version freezes also carry the two renewal settings. Amends AD-071; otherwise as
-- 20261028053639_customer_portal.sql. Snapshots frozen before this keep what they were sent with.
create or replace function private.org_terms(p_org_id uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'repairDiscountPct', s.repair_discount_pct,
    'cpiCapPct', s.cpi_cap_pct,
    'cancellationNoticeDays', s.cancellation_notice_days,
    'paymentDays', s.payment_days,
    'governingProvince', s.governing_province,
    'taxNote', s.tax_note,
    'renewalNoticeDays', s.renewal_notice_days,
    'cpiRenegotiationThresholdPct', s.cpi_renegotiation_threshold_pct)
  from public.org_settings s where s.org_id = p_org_id
$$;

revoke execute on function private.org_terms(uuid) from public, anon, authenticated;

-- Door 6: version 1 takes the org's default term months (12 without a settings row). Amends AD-053; otherwise as
-- 20261027202354_agreement_builder.sql.
create or replace function public.create_agreement(p_site_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
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

revoke execute on function public.create_agreement(uuid) from public, anon;
grant execute on function public.create_agreement(uuid) to authenticated;

-- Door 6: a revision also copies the term. Amends AD-055 again; otherwise as 20261030120000_cadence.sql.
create or replace function public.apply_agreement_transition(
  p_agreement_id uuid,
  p_expected_status text,
  p_to_status text,
  p_event_type text,
  p_payload jsonb
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_version integer;
  v_from uuid;
  v_to uuid;
  v_event uuid;
  v_line record;
  v_copy uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;

  update public.agreements set status = p_to_status, updated_at = now()
  where id = p_agreement_id and status = p_expected_status;
  if not found then
    raise exception 'agreement % is no longer %', p_agreement_id, p_expected_status using errcode = '40001';
  end if;

  -- A draft that stops being a draft keeps what it covered at that moment.
  if p_expected_status = 'draft' then
    perform private.freeze_agreement_version(p_agreement_id);
  end if;

  -- A revision starts the next version from the content of the current one: its snapshot, its term, its lines and
  -- their coverage.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot, term_start, term_months)
    select v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(f.snapshot, '{}'), f.term_start,
           coalesce(f.term_months, 12)
    from (select 1) one
    left join public.agreement_versions f on f.id = v_from
    returning id into v_to;
    for v_line in
      select l.id, l.org_id, l.position, l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents
      from public.service_lines l
      where l.agreement_version_id = v_from
      order by l.position, l.created_at
    loop
      insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                        cost_per_visit_cents)
      values (v_line.org_id, v_to, v_line.position, v_line.description, v_line.visit_months, v_line.visits_per_year,
              v_line.cost_per_visit_cents)
      returning id into v_copy;
      insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
      select c.org_id, v_copy, c.asset_type_id from public.service_line_asset_types c where c.service_line_id = v_line.id;
    end loop;
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;

-- Door 3: the only writer of a version's term. Definer, because members have no update on agreement_versions
-- (AD-060); it checks membership and role itself, so another org's agreement reads as missing.
create function public.save_agreement_term(p_agreement_id uuid, p_term_start date, p_term_months smallint)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_version uuid;
begin
  select a.org_id, a.status into v_org, v_status from public.agreements a where a.id = p_agreement_id for update;
  if v_org is null or not (select private.is_org_member(v_org)) then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'agreement % is no longer a draft', p_agreement_id using errcode = '55000';
  end if;

  update public.agreement_versions v set term_start = p_term_start, term_months = p_term_months
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id)
  returning v.id into v_version;
  return v_version;
end $$;

revoke execute on function public.save_agreement_term(uuid, date, smallint) from public, anon;
grant execute on function public.save_agreement_term(uuid, date, smallint) to authenticated;

-- Door 4: a draft with no start date is not sent. The hint tells it apart from "no service line", which keeps no hint.
-- Otherwise as 20261029165430_outbox_dispatch.sql; the 4-argument overload still calls this one.
create or replace function public.send_agreement(p_agreement_id uuid, p_token_hash text, p_event_type text, p_payload jsonb, p_token_sealed text)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_event uuid;
  v_version uuid;
  v_start date;
begin
  if p_event_type is distinct from 'agreement.sent' then
    raise exception 'send_agreement writes agreement.sent only' using errcode = '23514';
  end if;

  v_event := public.apply_agreement_transition(p_agreement_id, 'draft', 'sent', p_event_type, p_payload);

  -- After the status update, which holds the agreement's row: a line or a term cannot change meanwhile.
  select v.id, v.term_start into v_version, v_start from public.agreement_versions v
  where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
  if not exists (select 1 from public.service_lines l where l.agreement_version_id = v_version) then
    raise exception 'agreement % has no service line', p_agreement_id using errcode = '23514';
  end if;
  if v_start is null then
    raise exception 'agreement % has no term start date', p_agreement_id using errcode = '23514', hint = 'no_term_start';
  end if;

  perform private.issue_portal_link(p_agreement_id, p_token_hash, p_token_sealed);
  return v_event;
end $$;

revoke execute on function public.send_agreement(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.send_agreement(uuid, text, text, jsonb, text) to authenticated;

-- Door 7: the review page also gets the version's term. Otherwise as 20261030120000_cadence.sql.
create or replace function public.portal_view(p_token_hash text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_link public.portal_links;
  v_version public.agreement_versions;
  v_agreement public.agreements;
  v_current boolean;
  v_decision jsonb;
  v_tenant jsonb;
begin
  select * into v_link from public.portal_links l where l.token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  select * into v_version from public.agreement_versions v where v.id = v_link.agreement_version_id and v.org_id = v_link.org_id;
  select * into v_agreement from public.agreements a where a.id = v_version.agreement_id and a.org_id = v_link.org_id;
  v_current := v_version.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = v_agreement.id);

  if v_agreement.status in ('accepted', 'refused', 'changes_requested') then
    select jsonb_build_object('status', v_agreement.status, 'decidedAt', e.created_at, 'reason', e.payload -> 'reason')
    into v_decision
    from public.events e
    where e.org_id = v_agreement.org_id and e.entity_type = 'agreement' and e.entity_id = v_agreement.id
      and e.type = 'agreement.' || v_agreement.status
    order by e.created_at desc, e.id limit 1;
  end if;

  select jsonb_build_object('name', s.legal_name, 'address', s.address, 'phone', s.phone, 'accent', s.accent_color)
  into v_tenant from public.org_settings s where s.org_id = v_link.org_id;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'versionNo', v_version.version_no,
      'current', v_current,
      'revoked', v_link.revoked_at is not null,
      'revokedAt', v_link.revoked_at,
      'firstViewedAt', v_link.first_viewed_at),
    'agreement', jsonb_build_object('number', v_agreement.number, 'status', v_agreement.status),
    'tenant', v_tenant,
    'customer', (select jsonb_build_object('name', c.name) from public.sites s
                 join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                 where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                  'description', l.description,
                  'visitsPerYear', l.visits_per_year,
                  'costPerVisitCents', l.cost_per_visit_cents,
                  'annualCents', l.visits_per_year * l.cost_per_visit_cents,
                  'visitMonths', to_jsonb(l.visit_months),
                  'equipment', coalesce((select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name) order by t.name, t.code)
                                         from public.service_line_asset_types c
                                         join public.asset_types t on t.id = c.asset_type_id and t.org_id = c.org_id
                                         where c.service_line_id = l.id and c.org_id = l.org_id), '[]'::jsonb))
                order by l.position, l.created_at, l.id)
              from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), '[]'::jsonb),
    'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents)
                             from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), 0),
    'scope', case when v_version.snapshot = '{}'::jsonb then null else v_version.snapshot - 'terms' end,
    'terms', v_version.snapshot -> 'terms',
    'term', jsonb_build_object(
      'start', to_char(v_version.term_start, 'YYYY-MM-DD'),
      'months', v_version.term_months,
      'end', to_char(v_version.term_end, 'YYYY-MM-DD')),
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;
