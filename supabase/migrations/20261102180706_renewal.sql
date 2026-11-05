-- Renewal (.specs/features/renewal/plan.md). W7 runs daily through the signed automation path. Each accepted agreement
-- whose notice date has come gets one renewal: an accepted agreement with CPI-raised prices below the threshold, a
-- draft for staff otherwise. The claim then returns one email per renewal not yet sent.

-- Door 1: a renewal is a new agreement linked to the one it renews, once, within the org.
alter table public.agreements
  add column renews_agreement_id uuid,
  add constraint agreements_renews_agreement_id_key unique (renews_agreement_id),
  add constraint agreements_renews_agreement_fkey foreign key (renews_agreement_id, org_id)
    references public.agreements (id, org_id),
  add constraint agreements_renews_not_self check (renews_agreement_id is distinct from id);

-- Door 2: the CPI the tenant renews with, and the date it was published. Both or neither.
alter table public.org_settings
  add column renewal_cpi_pct numeric(5, 2) check (renewal_cpi_pct between -20 and 100),
  add column renewal_cpi_as_of date check (renewal_cpi_as_of between '2000-01-01' and '2099-12-31'),
  add constraint org_settings_renewal_cpi_paired check ((renewal_cpi_pct is null) = (renewal_cpi_as_of is null));

-- Door 6: the two renewal emails.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'customer_renewal', 'staff_renewal'));

-- Doors 3 and 4: creates the renewal of every accepted agreement whose notice date is on or before p_run_date and
-- that nothing renews yet. Returns the ids created. An agreement whose site already has a live agreement is left for
-- a later run (agreements_one_live_per_site); every other error aborts the run.
create function private.run_renewals(p_run_date date)
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
    join lateral (
      select w.* from public.agreement_versions w
      where w.agreement_id = a.id and w.org_id = a.org_id order by w.version_no desc limit 1) v on true
    left join public.org_settings s on s.org_id = a.org_id
    where a.status = 'accepted'
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

-- Door 5: as 20261029165430_outbox_dispatch.sql, plus the W7 kind renewal_daily, whose key is w7:<yyyy-mm-dd> with a
-- date within one day of the database's. Returns {kind, key, runDate, executionId} for it.
create or replace function private.automation_request(p_body text, p_timestamp text, p_signature text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_secret text;
  v jsonb;
  v_kind text;
  v_key text;
  v_event uuid;
  v_agreement uuid;
  v_date date;
begin
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'automation_hmac_secret';
  if v_secret is null or p_body is null or p_signature is null or p_timestamp is null or p_timestamp !~ '^[0-9]{1,12}$'
     or abs(floor(extract(epoch from now()))::bigint - p_timestamp::bigint) > 300
     or p_signature is distinct from 'sha256=' || encode(extensions.hmac(p_timestamp || '.' || p_body, v_secret, 'sha256'), 'hex') then
    raise exception 'bad or stale signature' using errcode = '42501';
  end if;

  begin
    v := p_body::jsonb;
  exception when others then
    raise exception 'the body is not JSON' using errcode = '22023';
  end;
  if jsonb_typeof(v) is distinct from 'object' then
    raise exception 'the body is not a JSON object' using errcode = '22023';
  end if;

  v_kind := v ->> 'kind';
  v_key := v ->> 'idempotencyKey';
  if v_kind is null or v_kind not in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'renewal_daily') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if v_key is null then
    raise exception 'idempotencyKey is required' using errcode = '22023';
  end if;
  if v ? 'executionId' and jsonb_typeof(v -> 'executionId') is distinct from 'string' then
    raise exception 'executionId must be a string' using errcode = '22023';
  end if;

  if v_kind = 'staff_stale' then
    if v_key !~ '^w5:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'idempotencyKey is not w5:<yyyy-mm-dd>' using errcode = '22023';
    end if;
    begin
      perform substr(v_key, 4)::date;
    exception when others then
      raise exception 'idempotencyKey is not a date' using errcode = '22023';
    end;
    return jsonb_build_object('kind', v_kind, 'key', v_key, 'executionId', v -> 'executionId');
  end if;

  if v_kind = 'renewal_daily' then
    if v_key !~ '^w7:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'idempotencyKey is not w7:<yyyy-mm-dd>' using errcode = '22023';
    end if;
    begin
      v_date := substr(v_key, 4)::date;
    exception when others then
      raise exception 'idempotencyKey is not a date' using errcode = '22023';
    end;
    if abs(v_date - current_date) > 1 then
      raise exception 'the W7 date is more than one day from today' using errcode = '22023';
    end if;
    return jsonb_build_object('kind', v_kind, 'key', v_key, 'runDate', v_date, 'executionId', v -> 'executionId');
  end if;

  begin
    v_event := (v ->> 'eventId')::uuid;
    v_agreement := (v ->> 'agreementId')::uuid;
  exception when others then
    raise exception 'eventId and agreementId must be uuids' using errcode = '22023';
  end;
  if v_event is null or v_agreement is null then
    raise exception 'eventId and agreementId are required' using errcode = '22023';
  end if;
  if not v_key = any (case v_kind
       when 'customer_link' then array['w1:' || v_event || ':link']
       when 'customer_reminder' then array['w1:' || v_event || ':day3', 'w1:' || v_event || ':day7']
       else array['w3:' || v_event] end) then
    raise exception 'idempotencyKey does not match kind and eventId' using errcode = '22023';
  end if;
  return jsonb_build_object('kind', v_kind, 'key', v_key, 'eventId', v_event, 'agreementId', v_agreement,
                            'executionId', v -> 'executionId');
end $$;

revoke execute on function private.automation_request(text, text, text) from public, anon, authenticated;

-- Doors 4 and 6: W7's claim. Runs the renewals for the key's date, then claims the email of every renewal whose email
-- is not yet sent or skipped: customer_renewal for an auto-renewal, staff_renewal for a renewal draft.
create function private.claim_renewals(r jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  e record;
  v_claim record;
  v_kind text;
  v_key text;
  v_recipients text[];
  v_messages jsonb := '[]';
  v_states text[] := '{}';
begin
  perform private.run_renewals((r ->> 'runDate')::date);

  for e in
    select ev.id as event_id, ev.type, ev.payload, a.id, a.org_id, a.number, a.site_id,
           o.number as renews_number, ov.id as renews_version_id, ov.term_end as renews_term_end,
           nv.id as version_id, nv.term_start, nv.term_end, nv.term_months
    from public.events ev
    join public.agreements a on a.id = ev.entity_id and a.org_id = ev.org_id
    join public.agreements o on o.id = a.renews_agreement_id and o.org_id = a.org_id
    join lateral (select w.id, w.term_end from public.agreement_versions w
                  where w.agreement_id = o.id and w.org_id = o.org_id order by w.version_no desc limit 1) ov on true
    join public.agreement_versions nv on nv.agreement_id = a.id and nv.org_id = a.org_id and nv.version_no = 1
    where ev.entity_type = 'agreement' and ev.type in ('agreement.renewed', 'agreement.renewal_drafted')
    order by ev.created_at, ev.id
  loop
    v_kind := case when e.type = 'agreement.renewed' then 'customer_renewal' else 'staff_renewal' end;
    v_key := 'w7:' || e.id || case when v_kind = 'customer_renewal' then ':customer' else ':staff' end;
    if exists (select 1 from public.notifications n where n.idempotency_key = v_key and n.status in ('sent', 'skipped')) then
      v_states := v_states || 'duplicate'::text;
      continue;
    end if;
    select * into v_claim from private.claim_notification(v_key, v_kind, e.org_id, e.id, e.event_id);
    v_states := v_states || v_claim.o_state;
    continue when v_claim.o_state <> 'send';

    if v_kind = 'customer_renewal' then
      select array[nullif(btrim(c.email), '')] into v_recipients from public.sites s
      join public.contacts c on c.id = s.site_contact_id and c.customer_id = s.customer_id
      where s.id = e.site_id and s.org_id = e.org_id;
      v_recipients := array_remove(coalesce(v_recipients, '{}'), null);
    else
      v_recipients := private.org_managers(e.org_id);
    end if;
    if cardinality(v_recipients) = 0 then
      update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
      continue;
    end if;
    update public.notifications set recipients = v_recipients where id = v_claim.o_id;

    v_messages := v_messages || (jsonb_build_object(
      'notificationId', v_claim.o_id, 'kind', v_kind, 'idempotencyKey', v_key, 'to', to_jsonb(v_recipients),
      'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
                 from public.org_settings t where t.org_id = e.org_id),
      'agreement', jsonb_build_object('id', e.id, 'number', e.number),
      'site', (select jsonb_build_object('name', s.name) from public.sites s where s.id = e.site_id and s.org_id = e.org_id))
      || case when v_kind = 'customer_renewal' then jsonb_build_object(
        'renews', jsonb_build_object('number', e.renews_number),
        'oldAnnualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents) from public.service_lines l
                                    where l.agreement_version_id = e.renews_version_id and l.org_id = e.org_id), 0),
        'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents) from public.service_lines l
                                 where l.agreement_version_id = e.version_id and l.org_id = e.org_id), 0),
        'appliedPct', e.payload -> 'appliedPct',
        'term', jsonb_build_object('start', e.term_start, 'end', e.term_end, 'months', e.term_months))
      else jsonb_build_object(
        'renews', jsonb_build_object('number', e.renews_number, 'termEnd', e.renews_term_end),
        'customer', (select jsonb_build_object('name', c.name) from public.sites s
                     join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                     where s.id = e.site_id and s.org_id = e.org_id),
        'reason', e.payload ->> 'reason',
        'cpiPct', e.payload -> 'cpiPct')
      end);
  end loop;

  return jsonb_build_object('messages', v_messages) || case
    when jsonb_array_length(v_messages) > 0 then jsonb_build_object('decision', 'send')
    when 'in_flight' = any (v_states) then jsonb_build_object('decision', 'in_flight')
    when 'duplicate' = any (v_states) then jsonb_build_object('decision', 'duplicate')
    else jsonb_build_object('decision', 'skip', 'reason', 'none') end;
end $$;

revoke execute on function private.claim_renewals(jsonb) from public, anon, authenticated;

-- Door 4: as 20261029165430_outbox_dispatch.sql, plus renewal_daily, which private.claim_renewals answers.
create or replace function public.automation_claim(p_body text, p_timestamp text, p_signature text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := private.automation_request(p_body, p_timestamp, p_signature);
  v_kind text := r ->> 'kind';
  v_event public.events;
  v_agreement public.agreements;
  v_version public.agreement_versions;
  v_claim record;
  v_reason text;
  v_to text;
  v_link public.portal_links;
  v_actor uuid;
  v_reply text;
  v_recipients text[];
  v_tenant jsonb;
  v_messages jsonb := '[]';
  v_states text[] := '{}';
  o record;
begin
  if v_kind = 'renewal_daily' then
    return private.claim_renewals(r);
  end if;

  if v_kind = 'staff_stale' then
    for o in
      select a.org_id,
             jsonb_agg(jsonb_build_object('id', a.id, 'number', a.number, 'customerName', c.name, 'sentAt', x.sent_at)
                       order by x.sent_at, a.number) as agreements
      from public.agreements a
      join public.sites s on s.id = a.site_id and s.org_id = a.org_id
      join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
      cross join lateral (
        select max(e.created_at) as sent_at from public.events e
        where e.org_id = a.org_id and e.entity_type = 'agreement' and e.entity_id = a.id and e.type = 'agreement.sent') x
      where a.status = 'sent'
        and x.sent_at <= now() - interval '7 days'
        and not exists (
          select 1 from public.portal_links l
          join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
          where v.agreement_id = a.id and v.org_id = a.org_id and l.revoked_at is null and l.first_viewed_at is not null
            and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id))
      group by a.org_id
      order by a.org_id
    loop
      select * into v_claim from private.claim_notification((r ->> 'key') || ':' || o.org_id, 'staff_stale', o.org_id, null, null);
      v_states := v_states || v_claim.o_state;
      continue when v_claim.o_state <> 'send';
      v_recipients := private.org_managers(o.org_id);
      if cardinality(v_recipients) = 0 then
        update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
        continue;
      end if;
      update public.notifications set recipients = v_recipients where id = v_claim.o_id;
      v_messages := v_messages || jsonb_build_object(
        'notificationId', v_claim.o_id, 'kind', v_kind, 'orgId', o.org_id, 'to', to_jsonb(v_recipients),
        'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
                   from public.org_settings t where t.org_id = o.org_id),
        'agreements', o.agreements);
    end loop;
    return jsonb_build_object('messages', v_messages) || case
      when jsonb_array_length(v_messages) > 0 then jsonb_build_object('decision', 'send')
      when 'in_flight' = any (v_states) then jsonb_build_object('decision', 'in_flight')
      when 'duplicate' = any (v_states) then jsonb_build_object('decision', 'duplicate')
      else jsonb_build_object('decision', 'skip', 'reason', 'none') end;
  end if;

  select * into v_event from public.events e
  where e.id = (r ->> 'eventId')::uuid and e.entity_type = 'agreement' and e.entity_id = (r ->> 'agreementId')::uuid
    and e.type = any (case when v_kind = 'staff_decision' then array['agreement.refused', 'agreement.changes_requested']
                           else array['agreement.sent'] end);
  if not found then
    raise exception 'unknown event for this agreement' using errcode = 'P0002';
  end if;
  select * into v_agreement from public.agreements a where a.id = v_event.entity_id and a.org_id = v_event.org_id;
  if not found then
    raise exception 'unknown agreement' using errcode = 'P0002';
  end if;

  if r ->> 'executionId' is not null then
    update public.events set n8n_execution_id = r ->> 'executionId' where id = v_event.id and n8n_execution_id is null;
  end if;

  select * into v_claim from private.claim_notification(r ->> 'key', v_kind, v_agreement.org_id, v_agreement.id, v_event.id);
  if v_claim.o_state <> 'send' then
    return jsonb_build_object('decision', v_claim.o_state, 'messages', '[]'::jsonb);
  end if;

  select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
  into v_tenant from public.org_settings t where t.org_id = v_agreement.org_id;

  if v_kind = 'staff_decision' then
    -- The member who sent the decided version: the actor of the agreement's latest agreement.sent before the decision.
    select e.actor_id into v_actor from public.events e
    where e.org_id = v_agreement.org_id and e.entity_type = 'agreement' and e.entity_id = v_agreement.id
      and e.type = 'agreement.sent' and e.created_at <= v_event.created_at
    order by e.created_at desc limit 1;
    select array[u.email::text] into v_recipients from auth.users u
    where u.id = v_actor and u.email is not null
      and exists (select 1 from public.memberships m where m.org_id = v_agreement.org_id and m.user_id = v_actor);
    if v_recipients is null then
      v_recipients := private.org_managers(v_agreement.org_id);
    end if;
    if cardinality(v_recipients) = 0 then
      update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
      return jsonb_build_object('decision', 'skip', 'reason', 'no_recipient', 'messages', '[]'::jsonb);
    end if;
    update public.notifications set recipients = v_recipients where id = v_claim.o_id;
    return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
      'notificationId', v_claim.o_id, 'kind', v_kind, 'to', to_jsonb(v_recipients), 'tenant', v_tenant,
      'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
      'customer', (select jsonb_build_object('name', c.name) from public.sites s
                   join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                   where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
      'decision', substr(v_event.type, length('agreement.') + 1),
      'reason', v_event.payload ->> 'reason')));
  end if;

  -- W1. The event's version is the newest one that existed when it was sent; a newer one supersedes it.
  select * into v_version from public.agreement_versions v
  where v.agreement_id = v_agreement.id and v.org_id = v_agreement.org_id and v.created_at <= v_event.created_at
  order by v.version_no desc limit 1;
  if not found then
    select * into v_version from public.agreement_versions v
    where v.agreement_id = v_agreement.id and v.org_id = v_agreement.org_id order by v.version_no desc limit 1;
  end if;
  select * into v_link from public.portal_links l
  where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id and l.revoked_at is null;

  if v_kind = 'customer_reminder' then
    if exists (select 1 from public.agreement_versions w where w.agreement_id = v_agreement.id and w.version_no > v_version.version_no) then
      v_reason := 'superseded';
    elsif v_agreement.status <> 'sent' then
      v_reason := 'decided';
    elsif v_link.first_viewed_at is not null then
      v_reason := 'viewed';
    end if;
  end if;
  if v_reason is null then
    select nullif(btrim(c.email), '') into v_to from public.sites s
    join public.contacts c on c.id = s.site_contact_id and c.customer_id = s.customer_id
    where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id;
    if v_to is null then
      v_reason := 'no_recipient';
    elsif v_link.token_sealed is null then
      v_reason := 'no_link_secret';
    end if;
  end if;
  if v_reason is not null then
    update public.notifications set status = 'skipped', skip_reason = v_reason where id = v_claim.o_id;
    return jsonb_build_object('decision', 'skip', 'reason', v_reason, 'messages', '[]'::jsonb);
  end if;

  update public.notifications set recipients = array[v_to] where id = v_claim.o_id;
  select u.email into v_reply from auth.users u where u.id = v_event.actor_id;
  return jsonb_build_object('decision', 'send', 'messages', jsonb_build_array(jsonb_build_object(
    'notificationId', v_claim.o_id, 'kind', v_kind, 'to', jsonb_build_array(v_to), 'tenant', v_tenant,
    'agreement', jsonb_build_object('id', v_agreement.id, 'number', v_agreement.number),
    'customer', (select jsonb_build_object('name', c.name) from public.sites s
                 join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                 where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents) from public.service_lines l
                             where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), 0),
    'tokenSealed', v_link.token_sealed,
    'reminder', case when v_kind = 'customer_reminder' then substr(r ->> 'key', length(r ->> 'key') - 3) end)
    || case when v_reply is not null then jsonb_build_object('replyTo', v_reply) else '{}'::jsonb end));
end $$;

revoke execute on function public.automation_claim(text, text, text) from public;
grant execute on function public.automation_claim(text, text, text) to anon, authenticated;

-- Door 6: as 20261029165430_outbox_dispatch.sql, plus renewal_daily, whose results name renewal notifications.
create or replace function public.automation_complete(p_body text, p_timestamp text, p_signature text, p_results jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := private.automation_request(p_body, p_timestamp, p_signature);
  v_key text := r ->> 'key';
  v_stale boolean := r ->> 'kind' = 'staff_stale';
  v_renewal boolean := r ->> 'kind' = 'renewal_daily';
  x jsonb;
  g record;
begin
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'results must be a non-empty array' using errcode = '22023';
  end if;
  for x in select value from jsonb_array_elements(p_results) loop
    if jsonb_typeof(x) is distinct from 'object' or coalesce(x ->> 'id', '') !~ '^[0-9a-fA-F-]{36}$'
       or x ->> 'outcome' is null or x ->> 'outcome' not in ('sent', 'failed', 'skipped')
       or (x ->> 'outcome' = 'skipped' and coalesce(x ->> 'reason', '') not in
           ('decided', 'superseded', 'viewed', 'no_recipient', 'no_link_secret', 'reserved_domain')) then
      raise exception 'malformed result %', x using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_results) e
    where not exists (
      select 1 from public.notifications n
      where n.id = (e.value ->> 'id')::uuid
        and (n.idempotency_key = v_key or (v_stale and n.idempotency_key like v_key || ':%')
             or (v_renewal and n.kind in ('customer_renewal', 'staff_renewal'))))) then
    raise exception 'a result names a notification of another key' using errcode = 'P0002';
  end if;

  for g in
    select (e.value ->> 'id')::uuid as id,
           bool_or(e.value ->> 'outcome' = 'failed') as failed,
           bool_or(e.value ->> 'outcome' = 'sent') as sent,
           string_agg(coalesce(nullif(e.value ->> 'error', ''), 'failed'), '; ') filter (where e.value ->> 'outcome' = 'failed') as error,
           string_agg(e.value ->> 'providerMessageId', ',') filter (where e.value ->> 'outcome' = 'sent') as provider,
           min(e.value ->> 'reason') filter (where e.value ->> 'outcome' = 'skipped') as reason
    from jsonb_array_elements(p_results) e
    group by 1
  loop
    update public.notifications set
      status = case when g.failed then 'failed' when g.sent then 'sent' else 'skipped' end,
      error = case when g.failed then g.error end,
      provider_message_id = case when not g.failed and g.sent then g.provider end,
      sent_at = case when not g.failed and g.sent then now() end,
      skip_reason = case when not g.failed and not g.sent then g.reason end
    where id = g.id and status = 'claimed';
  end loop;
end $$;

revoke execute on function public.automation_complete(text, text, text, jsonb) from public;
grant execute on function public.automation_complete(text, text, text, jsonb) to anon, authenticated;
