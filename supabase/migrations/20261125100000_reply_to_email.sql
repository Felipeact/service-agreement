-- Reply-to address (workspace setting): customer emails (agreement link and reminders) reply to the address the org sets, so
-- replies reach a company mailbox instead of the sender's personal login. Empty keeps the old behavior (the sender's login email).
-- Applied to the hosted project on 2026-11-25 with the owner's go-ahead.
alter table public.org_settings
  add column reply_to_email text check (reply_to_email is null or (length(reply_to_email) <= 254 and reply_to_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- automation_claim as of 20261108100000_contract_automation.sql, with the one reply-to line changed. Grants are unchanged.
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
  if v_kind = 'contract_ready' then
    return private.claim_contract_ready(r);
  end if;
  if v_kind = 'customer_signing_link' then
    return private.claim_signing_link(r);
  end if;
  if v_kind = 'contract_signed_copy' then
    return private.claim_signed_copy(r);
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
  -- The workspace's reply-to address wins; without one, the person who sent it, as before.
  select coalesce((select t.reply_to_email from public.org_settings t where t.org_id = v_agreement.org_id),
                  (select u.email from auth.users u where u.id = v_event.actor_id)) into v_reply;
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
