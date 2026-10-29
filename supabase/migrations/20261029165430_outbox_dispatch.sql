-- Outbox dispatch, signed callbacks and notifications (.specs/features/outbox-dispatch, doors 1 to 5, Landing 9 to 11).
-- The database sends outbox rows to n8n (pg_cron + pg_net) and verifies n8n's callbacks itself, so the app holds
-- neither the shared secret nor a service-role key. Secrets live in Vault: n8n_events_url, automation_hmac_secret.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Door 1: a row is pending, then sending while its request is in flight, then sent (2xx), or back to pending with
-- backoff, or failed after 8 attempts. dispatched_at drives the 10-minute rule (Landing 9).
alter table public.outbox drop constraint outbox_status_check;
alter table public.outbox add constraint outbox_status_check check (status in ('pending', 'sending', 'sent', 'failed'));
alter table public.outbox add column request_id bigint, add column dispatched_at timestamptz;

-- AC 8: what was enqueued before dispatch existed is demo and live-run data; it is never sent.
update public.outbox set status = 'failed', last_error = 'enqueued before dispatch existed' where status = 'pending';

-- Door 1. Settles in-flight rows from pg_net's responses, then sends up to 50 due rows, each signed per door 2 over the
-- exact text pg_net sends (convert_to(body::text, 'UTF8')). Does nothing while either Vault secret is missing.
create function private.dispatch_outbox()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_backoff constant integer[] := array[1, 5, 15, 60, 240, 720, 1440];
  v_ts text;
  v_body jsonb;
  v_request bigint;
  v_error text;
  r record;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'n8n_events_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'automation_hmac_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  if not pg_try_advisory_xact_lock(hashtext('outbox-dispatch')) then
    return;
  end if;

  for r in
    select o.id, o.dispatched_at, x.status_code, x.timed_out, x.error_msg, x.answered
    from public.outbox o
    left join lateral (
      select h.status_code, h.timed_out, h.error_msg, true as answered
      from net._http_response h where h.id = o.request_id order by h.created desc limit 1) x on true
    where o.status = 'sending'
    for update of o skip locked
  loop
    if r.answered and r.status_code between 200 and 299 then
      update public.outbox set status = 'sent', sent_at = now() where id = r.id;
    elsif r.answered or r.dispatched_at < now() - interval '10 minutes' then
      v_error := case
        when r.answered is null then 'no response within 10 minutes'
        when r.timed_out then 'timed out'
        when r.status_code is null then coalesce(nullif(r.error_msg, ''), 'no status')
        else 'HTTP ' || r.status_code end;
      update public.outbox
      set attempts = attempts + 1,
          last_error = v_error,
          status = case when attempts + 1 >= 8 then 'failed' else 'pending' end,
          available_at = case when attempts + 1 >= 8 then available_at
                              else now() + make_interval(mins => v_backoff[attempts + 1]) end
      where id = r.id;
    end if;
  end loop;

  for r in
    select o.id, o.event_id, o.org_id from public.outbox o
    where o.status = 'pending' and o.available_at <= now()
    order by o.available_at, o.id
    limit 50
    for update skip locked
  loop
    select jsonb_build_object('deliveryId', r.id, 'eventId', e.id, 'type', e.type, 'entityType', e.entity_type,
                              'entityId', e.entity_id, 'orgId', e.org_id, 'payload', e.payload, 'occurredAt', e.created_at)
    into v_body from public.events e where e.id = r.event_id and e.org_id = r.org_id;
    v_ts := floor(extract(epoch from now()))::bigint::text;
    v_request := net.http_post(
      url := v_url,
      body := v_body,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-SA-Timestamp', v_ts,
        'X-SA-Signature', 'sha256=' || encode(extensions.hmac(v_ts || '.' || v_body::text, v_secret, 'sha256'), 'hex')));
    update public.outbox set status = 'sending', request_id = v_request, dispatched_at = now() where id = r.id;
  end loop;
end $$;

revoke execute on function private.dispatch_outbox() from public, anon, authenticated;

select cron.schedule('outbox-dispatch', '* * * * *', 'select private.dispatch_outbox()');

-- Door 4: one email the system decided to send or skip, keyed by its idempotency key (Landing 11 for the extra columns).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  idempotency_key text not null unique,
  kind text not null check (kind in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale')),
  agreement_id uuid,
  event_id uuid,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'skipped', 'failed')),
  skip_reason text check (skip_reason in ('decided', 'superseded', 'viewed', 'no_recipient', 'no_link_secret', 'reserved_domain')),
  recipients text[] not null default '{}',
  provider_message_id text,
  error text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'skipped') = (skip_reason is not null)),
  foreign key (agreement_id, org_id) references public.agreements (id, org_id),
  foreign key (event_id, org_id) references public.events (id, org_id)
);
create index notifications_org_id_idx on public.notifications (org_id);
create index notifications_agreement_id_idx on public.notifications (agreement_id, org_id);
create index notifications_event_id_idx on public.notifications (event_id, org_id);

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using ((select private.is_org_member(org_id)));
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to anon, authenticated;

-- Door 5: the token sealed with the app-only PORTAL_LINK_KEY, so a reminder can rebuild the link.
alter table public.portal_links
  add column token_sealed text check (token_sealed ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$');

-- Door 5: the only writer of portal_links for staff, now with the sealed token. Otherwise as 20261028053639.
create function private.issue_portal_link(p_agreement_id uuid, p_token_hash text, p_token_sealed text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
  v_link uuid;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id for update;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to link agreement %', p_agreement_id using errcode = '42501';
  end if;

  select v.id into v_version from public.agreement_versions v
  where v.agreement_id = p_agreement_id and v.org_id = v_org
  order by v.version_no desc limit 1;

  update public.portal_links set revoked_at = now()
  where agreement_version_id = v_version and org_id = v_org and revoked_at is null;
  insert into public.portal_links (org_id, agreement_version_id, token_hash, token_sealed)
  values (v_org, v_version, p_token_hash, p_token_sealed)
  returning id into v_link;
  return v_link;
end $$;

revoke execute on function private.issue_portal_link(uuid, text, text) from public, anon;
grant execute on function private.issue_portal_link(uuid, text, text) to authenticated;

-- Landing 10: the old signatures stay for their callers and store no sealed token.
create or replace function private.issue_portal_link(p_agreement_id uuid, p_token_hash text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  return private.issue_portal_link(p_agreement_id, p_token_hash, null::text);
end $$;

-- Door 5, staff side: as the 4-argument send_agreement of 20261028053639, with the sealed token on the new link.
create function public.send_agreement(p_agreement_id uuid, p_token_hash text, p_event_type text, p_payload jsonb, p_token_sealed text)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_event uuid;
  v_version uuid;
begin
  if p_event_type is distinct from 'agreement.sent' then
    raise exception 'send_agreement writes agreement.sent only' using errcode = '23514';
  end if;

  v_event := public.apply_agreement_transition(p_agreement_id, 'draft', 'sent', p_event_type, p_payload);

  -- After the status update, which holds the agreement's row: a line cannot be added or removed meanwhile.
  select v.id into v_version from public.agreement_versions v
  where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
  if not exists (select 1 from public.service_lines l where l.agreement_version_id = v_version) then
    raise exception 'agreement % has no service line', p_agreement_id using errcode = '23514';
  end if;

  perform private.issue_portal_link(p_agreement_id, p_token_hash, p_token_sealed);
  return v_event;
end $$;

revoke execute on function public.send_agreement(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.send_agreement(uuid, text, text, jsonb, text) to authenticated;

create or replace function public.send_agreement(p_agreement_id uuid, p_token_hash text, p_event_type text, p_payload jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
begin
  return public.send_agreement(p_agreement_id, p_token_hash, p_event_type, p_payload, null::text);
end $$;

-- Door 5, staff side: as the 2-argument reissue_portal_link of 20261028053639, with the sealed token on the new link.
create function public.reissue_portal_link(p_agreement_id uuid, p_token_hash text, p_token_sealed text)
returns uuid
language plpgsql security invoker
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
    raise exception 'not allowed to link agreement %', p_agreement_id using errcode = '42501';
  end if;

  -- Locks the agreement, so a withdraw or a decision racing this call takes its turn.
  select a.status into v_status from public.agreements a where a.id = p_agreement_id for update;
  if v_status is distinct from 'sent' then
    raise exception 'agreement % is not sent', p_agreement_id using errcode = '40001';
  end if;
  return private.issue_portal_link(p_agreement_id, p_token_hash, p_token_sealed);
end $$;

revoke execute on function public.reissue_portal_link(uuid, text, text) from public, anon;
grant execute on function public.reissue_portal_link(uuid, text, text) to authenticated;

create or replace function public.reissue_portal_link(p_agreement_id uuid, p_token_hash text)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
begin
  return public.reissue_portal_link(p_agreement_id, p_token_hash, null::text);
end $$;

-- Doors 2 and 3: checks the signature and its age before anything is read, then the body. Raises 42501 for a missing,
-- malformed, wrong or stale signature (or no secret in Vault), 22023 for a body that is not a known kind with the
-- keys that kind needs and a key of door 4's format. Returns {kind, key, eventId, agreementId, executionId}.
create function private.automation_request(p_body text, p_timestamp text, p_signature text)
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
  if v_kind is null or v_kind not in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale') then
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

-- Door 4: takes the key. 'send' for a new key, a failed one, or one claimed more than 10 minutes ago (the row is then
-- claimed by this call); 'duplicate' once sent or skipped; 'in_flight' while another claim holds it.
create function private.claim_notification(p_key text, p_kind text, p_org uuid, p_agreement uuid, p_event uuid,
                                           out o_id uuid, out o_state text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
  v_claimed timestamptz;
begin
  insert into public.notifications (org_id, idempotency_key, kind, agreement_id, event_id)
  values (p_org, p_key, p_kind, p_agreement, p_event)
  on conflict (idempotency_key) do nothing
  returning id into o_id;
  if o_id is not null then
    o_state := 'send';
    return;
  end if;

  select n.id, n.status, n.claimed_at into o_id, v_status, v_claimed
  from public.notifications n where n.idempotency_key = p_key for update;
  if v_status in ('sent', 'skipped') then
    o_state := 'duplicate';
  elsif v_status = 'claimed' and v_claimed > now() - interval '10 minutes' then
    o_state := 'in_flight';
  else
    update public.notifications set status = 'claimed', claimed_at = now(), error = null where id = o_id;
    o_state := 'send';
  end if;
end $$;

revoke execute on function private.claim_notification(text, text, uuid, uuid, uuid) from public, anon, authenticated;

-- The emails of an org's owners and admins (AC 26, 27), read from auth.users: no public table holds member emails.
create function private.org_managers(p_org uuid)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.email::text order by u.email), '{}')
  from public.memberships m join auth.users u on u.id = m.user_id
  where m.org_id = p_org and m.role in ('owner', 'admin') and u.email is not null
$$;

revoke execute on function private.org_managers(uuid) from public, anon, authenticated;

-- Door 3: a signed callback from n8n. Verifies it, writes events.n8n_execution_id once, takes the idempotency key,
-- decides send or skip, and returns what the email needs (Landing 11). Raises 42501, 22023, and P0002 for an unknown
-- event or one that is not of this kind or not about the named agreement.
create function public.automation_claim(p_body text, p_timestamp text, p_signature text)
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

-- Door 3: records what happened to the claimed notifications of this signed body (Landing 11). Raises 42501, 22023
-- for malformed results, P0002 when an id is not a notification of this body's key. Leaves a row that is no longer
-- claimed as it is.
create function public.automation_complete(p_body text, p_timestamp text, p_signature text, p_results jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb := private.automation_request(p_body, p_timestamp, p_signature);
  v_key text := r ->> 'key';
  v_stale boolean := r ->> 'kind' = 'staff_stale';
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
        and (n.idempotency_key = v_key or (v_stale and n.idempotency_key like v_key || ':%')))) then
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
