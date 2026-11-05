-- Proposal expiry (.specs/features/proposal-expiry/plan.md). Send stamps each version with the last day it can be
-- decided; the review page refuses a decision after it; W8 runs daily, expires each overdue sent agreement and claims
-- one email per expiry for the member who sent it.

-- Door 1: the last day a sent version can be decided, inclusive. Written only by private.stamp_valid_until (from
-- send_agreement) and the backfill below; authenticated still has no update on agreement_versions (AD-060).
alter table public.agreement_versions add column valid_until date
  check (valid_until between '2000-01-01' and '2099-12-31');

-- Door 2: how many days a proposal is valid.
alter table public.org_settings add column proposal_validity_days integer not null default 30
  check (proposal_validity_days between 1 and 365);

-- Door 6: the estimator's email.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'customer_renewal',
                  'staff_renewal', 'staff_expired'));

-- Door 3: the latest version of a sent agreement is valid through today in America/Vancouver plus the org's days.
-- Security definer, as private.freeze_agreement_version, because members cannot update agreement_versions.
create function private.stamp_valid_until(p_agreement_id uuid)
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
    raise exception 'not allowed to stamp agreement %', p_agreement_id using errcode = '42501';
  end if;
  if v_status <> 'sent' then
    raise exception 'agreement % is not sent', p_agreement_id using errcode = '55000';
  end if;

  update public.agreement_versions v
  set valid_until = (now() at time zone 'America/Vancouver')::date
                    + coalesce((select s.proposal_validity_days from public.org_settings s where s.org_id = v_org), 30)
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id);
end $$;

revoke execute on function private.stamp_valid_until(uuid) from public, anon;
grant execute on function private.stamp_valid_until(uuid) to authenticated;

-- Door 3: as 20261102164904_term_dates.sql, plus the validity date of the version sent.
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

  perform private.stamp_valid_until(p_agreement_id);
  perform private.issue_portal_link(p_agreement_id, p_token_hash, p_token_sealed);
  return v_event;
end $$;

revoke execute on function public.send_agreement(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.send_agreement(uuid, text, text, jsonb, text) to authenticated;

-- Door 7: the review page also gets the version's validity date and today's date in America/Vancouver.
-- Otherwise as 20261102164904_term_dates.sql.
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
    'version', jsonb_build_object('validUntil', to_char(v_version.valid_until, 'YYYY-MM-DD')),
    'today', to_char((now() at time zone 'America/Vancouver')::date, 'YYYY-MM-DD'),
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;

-- Door 7: as 20261028053639_customer_portal.sql, plus no decision after the version's validity date.
create or replace function public.portal_decide(p_token_hash text, p_to_status text, p_event_type text, p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_link_id uuid;
  v_org uuid;
  v_revoked timestamptz;
  v_version_no integer;
  v_agreement uuid;
  v_status text;
  v_current boolean;
  v_event uuid;
  v_payload jsonb;
  v_valid date;
begin
  if (p_to_status, p_event_type) not in (
       ('accepted', 'agreement.accepted'), ('refused', 'agreement.refused'), ('changes_requested', 'agreement.changes_requested')) then
    raise exception 'decision % with event % is not allowed', p_to_status, p_event_type using errcode = '42501';
  end if;

  if p_to_status <> 'accepted' then
    v_reason := regexp_replace(coalesce(p_payload ->> 'reason', ''), '^\s+|\s+$', '', 'g');
    if char_length(v_reason) < 1 or char_length(v_reason) > 2000 then
      raise exception 'a reason of 1 to 2000 characters is required' using errcode = '23514';
    end if;
  end if;

  select l.id, l.org_id, l.revoked_at, v.version_no, v.agreement_id, v.valid_until
  into v_link_id, v_org, v_revoked, v_version_no, v_agreement, v_valid
  from public.portal_links l
  join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
  where l.token_hash = p_token_hash;
  if not found then
    raise exception 'unknown link' using errcode = 'P0002';
  end if;

  -- Holds the link and the agreement, so a reissue, a withdraw or a second decision takes its turn.
  perform 1 from public.portal_links l where l.id = v_link_id for update;
  select a.status, v_version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)
  into v_status, v_current
  from public.agreements a where a.id = v_agreement for update;
  select l.revoked_at into v_revoked from public.portal_links l where l.id = v_link_id;

  -- Door 7: valid through valid_until in America/Vancouver, whether or not W8 has run yet.
  if v_revoked is not null or not v_current or v_status <> 'sent'
     or v_valid < (now() at time zone 'America/Vancouver')::date then
    raise exception 'this link is no longer open' using errcode = '40001';
  end if;

  update public.agreements set status = p_to_status, updated_at = now() where id = v_agreement and status = 'sent';
  if not found then
    raise exception 'this link is no longer open' using errcode = '40001';
  end if;

  v_payload := jsonb_build_object('from', 'sent', 'to', p_to_status, 'versionNo', v_version_no, 'via', 'portal');
  if v_reason is not null then
    v_payload := v_payload || jsonb_build_object('reason', v_reason);
  end if;
  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', v_agreement, p_event_type, v_payload, null)
  returning id into v_event;
  perform private.enqueue_outbox_for_system(v_event);
  return v_event;
end $$;

revoke execute on function public.portal_decide(text, text, text, jsonb) from public;
grant execute on function public.portal_decide(text, text, text, jsonb) to anon, authenticated;

-- Door 4: expires every sent agreement whose latest version's validity date is before p_run_date, and returns the
-- ids expired. The update locks each agreement and re-checks sent, so a decision committed first wins.
create function private.run_expiries(p_run_date date)
returns setof uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  d record;
  v_event uuid;
begin
  -- Two runs take turns, so the second finds nothing left to expire.
  perform pg_advisory_xact_lock(hashtext('expiries'));

  for d in
    select a.id, a.org_id, v.version_no, v.valid_until
    from public.agreements a
    join lateral (
      select w.version_no, w.valid_until from public.agreement_versions w
      where w.agreement_id = a.id and w.org_id = a.org_id order by w.version_no desc limit 1) v on true
    where a.status = 'sent' and v.valid_until < p_run_date
    order by v.valid_until, a.id
  loop
    update public.agreements set status = 'expired', updated_at = now() where id = d.id and status = 'sent';
    continue when not found;
    insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
    values (d.org_id, 'agreement', d.id, 'agreement.expired', jsonb_build_object(
      'from', 'sent', 'to', 'expired', 'versionNo', d.version_no,
      'validUntil', to_char(d.valid_until, 'YYYY-MM-DD'), 'via', 'w8'), null)
    returning id into v_event;
    perform private.enqueue_outbox_for_system(v_event);
    return next d.id;
  end loop;
end $$;

revoke execute on function private.run_expiries(date) from public, anon, authenticated;

-- Doors 4 and 6: W8's claim. Runs the expiries for the key's date, then claims the email of every expiry whose email
-- is not yet sent or skipped, for the member who sent the expired version, else the org's owners and admins.
create function private.claim_expiries(r jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  e record;
  v_claim record;
  v_key text;
  v_actor uuid;
  v_recipients text[];
  v_messages jsonb := '[]';
  v_states text[] := '{}';
begin
  perform private.run_expiries((r ->> 'runDate')::date);

  for e in
    select ev.id as event_id, ev.created_at, ev.payload, a.id, a.org_id, a.number, a.site_id
    from public.events ev
    join public.agreements a on a.id = ev.entity_id and a.org_id = ev.org_id
    where ev.entity_type = 'agreement' and ev.type = 'agreement.expired'
    order by ev.created_at, ev.id
  loop
    v_key := 'w8:' || e.event_id;
    if exists (select 1 from public.notifications n where n.idempotency_key = v_key and n.status in ('sent', 'skipped')) then
      v_states := v_states || 'duplicate'::text;
      continue;
    end if;
    select * into v_claim from private.claim_notification(v_key, 'staff_expired', e.org_id, e.id, e.event_id);
    v_states := v_states || v_claim.o_state;
    continue when v_claim.o_state <> 'send';

    if r ->> 'executionId' is not null then
      update public.events set n8n_execution_id = r ->> 'executionId' where id = e.event_id and n8n_execution_id is null;
    end if;

    -- The member who sent the expired version: the actor of the latest agreement.sent before the expiry.
    v_actor := null;
    v_recipients := null;
    select x.actor_id into v_actor from public.events x
    where x.org_id = e.org_id and x.entity_type = 'agreement' and x.entity_id = e.id
      and x.type = 'agreement.sent' and x.created_at <= e.created_at
    order by x.created_at desc limit 1;
    select array[u.email::text] into v_recipients from auth.users u
    where u.id = v_actor and u.email is not null
      and exists (select 1 from public.memberships m where m.org_id = e.org_id and m.user_id = v_actor);
    if v_recipients is null then
      v_recipients := private.org_managers(e.org_id);
    end if;
    if cardinality(v_recipients) = 0 then
      update public.notifications set status = 'skipped', skip_reason = 'no_recipient' where id = v_claim.o_id;
      continue;
    end if;
    update public.notifications set recipients = v_recipients where id = v_claim.o_id;

    v_messages := v_messages || jsonb_build_object(
      'notificationId', v_claim.o_id, 'kind', 'staff_expired', 'idempotencyKey', v_key, 'to', to_jsonb(v_recipients),
      'tenant', (select jsonb_build_object('legalName', t.legal_name, 'phone', t.phone, 'accent', t.accent_color)
                 from public.org_settings t where t.org_id = e.org_id),
      'agreement', jsonb_build_object('id', e.id, 'number', e.number),
      'customer', (select jsonb_build_object('name', c.name) from public.sites s
                   join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                   where s.id = e.site_id and s.org_id = e.org_id),
      'site', (select jsonb_build_object('name', s.name) from public.sites s where s.id = e.site_id and s.org_id = e.org_id),
      'validUntil', e.payload ->> 'validUntil');
  end loop;

  return jsonb_build_object('messages', v_messages) || case
    when jsonb_array_length(v_messages) > 0 then jsonb_build_object('decision', 'send')
    when 'in_flight' = any (v_states) then jsonb_build_object('decision', 'in_flight')
    when 'duplicate' = any (v_states) then jsonb_build_object('decision', 'duplicate')
    else jsonb_build_object('decision', 'skip', 'reason', 'none') end;
end $$;

revoke execute on function private.claim_expiries(jsonb) from public, anon, authenticated;

-- Door 5: as 20261102180706_renewal.sql, plus the W8 kind expiry_daily, whose key is w8:<yyyy-mm-dd> with a date
-- within one day of the database's. Returns {kind, key, runDate, executionId} for it.
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
  if v_kind is null or v_kind not in ('customer_link', 'customer_reminder', 'staff_decision', 'staff_stale', 'renewal_daily', 'expiry_daily') then
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

  if v_kind in ('renewal_daily', 'expiry_daily') then
    if v_key !~ ('^' || case v_kind when 'renewal_daily' then 'w7' else 'w8' end || ':[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'idempotencyKey is not %:<yyyy-mm-dd>', case v_kind when 'renewal_daily' then 'w7' else 'w8' end
        using errcode = '22023';
    end if;
    begin
      v_date := substr(v_key, 4)::date;
    exception when others then
      raise exception 'idempotencyKey is not a date' using errcode = '22023';
    end;
    if abs(v_date - current_date) > 1 then
      raise exception 'the run date is more than one day from today' using errcode = '22023';
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

-- Door 5: as 20261102180706_renewal.sql, plus expiry_daily, which private.claim_expiries answers.
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

-- Door 6: as 20261102180706_renewal.sql, plus expiry_daily, whose results name staff_expired notifications.
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
  v_expiry boolean := r ->> 'kind' = 'expiry_daily';
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
             or (v_renewal and n.kind in ('customer_renewal', 'staff_renewal'))
             or (v_expiry and n.kind = 'staff_expired')))) then
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

-- Impact, stored data: the latest version of every agreement now sent is valid for 30 days from its last
-- agreement.sent in America/Vancouver. An agreement with no such event, and every other version, stays null.
update public.agreement_versions v
set valid_until = (x.sent_at at time zone 'America/Vancouver')::date + 30
from public.agreements a
cross join lateral (
  select max(e.created_at) as sent_at from public.events e
  where e.org_id = a.org_id and e.entity_type = 'agreement' and e.entity_id = a.id and e.type = 'agreement.sent') x
where a.id = v.agreement_id and a.org_id = v.org_id
  and a.status = 'sent'
  and x.sent_at is not null
  and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id);
