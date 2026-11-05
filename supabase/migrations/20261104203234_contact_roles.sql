-- Contact roles (.specs/features/contact-roles/plan.md). A site gets an approver and a customer a billing contact, beside the
-- existing site contact; customer emails go to the approver, else the site contact.

-- Door 1: each role is a nullable composite FK to a contact of the same customer (AD-003); deleting a role holder is refused.
alter table public.sites
  add column approver_contact_id uuid,
  add constraint sites_approver_contact_fkey foreign key (approver_contact_id, customer_id) references public.contacts (id, customer_id);
create index sites_approver_contact_id_idx on public.sites (approver_contact_id, customer_id);
alter table public.customers
  add column billing_contact_id uuid,
  add constraint customers_billing_contact_fkey foreign key (billing_contact_id, id) references public.contacts (id, customer_id);
create index customers_billing_contact_id_idx on public.customers (billing_contact_id, id);

-- Members edit only the columns the forms edit (deactivation door 2); the new columns join that list.
grant update (approver_contact_id) on public.sites to authenticated;
grant update (billing_contact_id) on public.customers to authenticated;

-- Door 2: the one place that decides who a customer email goes to: the site's approver, else its site contact; null when
-- neither has an email.
create function private.customer_recipient(p_site_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(c.email), '') from public.sites s
      join public.contacts c on c.id = s.approver_contact_id and c.customer_id = s.customer_id
      where s.id = p_site_id),
    (select nullif(btrim(c.email), '') from public.sites s
      join public.contacts c on c.id = s.site_contact_id and c.customer_id = s.customer_id
      where s.id = p_site_id));
$$;
revoke execute on function private.customer_recipient(uuid) from public, anon, authenticated;

-- As 20261102180706_renewal.sql, with the resolver in place of the inline join.
create or replace function private.claim_renewals(r jsonb)
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
      v_recipients := array_remove(array[private.customer_recipient(e.site_id)], null);
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

-- As 20261102222043_proposal_expiry.sql, with the resolver in place of the inline join.
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
  if v_kind = 'expiry_daily' then
    return private.claim_expiries(r);
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
    v_to := private.customer_recipient(v_agreement.site_id);
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
