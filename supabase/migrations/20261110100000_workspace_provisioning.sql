-- workspace-provisioning doors 1 and 2 (.specs/features/workspace-provisioning/plan.md): the first reader of Stripe's ledger.
-- A recorded `checkout.session.completed` becomes an org, its settings, its Stripe ids, the starter catalog of the ticked
-- trades and an owner invitation, in the same transaction as the event. No service-role key (AD-037, AD-073): the work is a
-- security-definer function the signed webhook function calls. The metadata keys it reads are the contract of AD-169, AD-172.

-- Door 1: what an org bought, readable by its managers only, written by the provisioner only. The two unique columns are the
-- backstop that makes provisioning idempotent when an event id differs but the subscription does not.
create table public.org_billing (
  org_id uuid primary key references public.orgs (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text not null unique,
  plan text not null check (plan in ('starter', 'team', 'business')),
  seats integer not null check (seats between 1 and 50),
  trades text[] not null check (cardinality(trades) between 1 and 4),
  other_trade boolean not null,
  created_at timestamptz not null default now()
);

alter table public.org_billing enable row level security;
revoke all on public.org_billing from public, anon, authenticated;
grant select on public.org_billing to authenticated;
create policy org_billing_select on public.org_billing for select to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])));

-- Door 2: where the ledger remembers what happened to an event. Both null: not tried (or not a checkout). The reason is a
-- closed code, never a piece of the delivery.
alter table private.stripe_events
  add column processed_at timestamptz,
  add column process_error text check (process_error in
    ('invalid_metadata', 'email_in_use', 'already_provisioned', 'no_pack', 'not_a_subscription', 'failed'));

-- Reads the stored event and builds the workspace. Returns the owner's email. Raises P0001 with a closed code as the message
-- for a refusal; anything else the database raises is a failure the caller turns into `failed` or `no_pack` (55000).
create function private.provision_workspace(p_event_id text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session jsonb;
  v_meta jsonb;
  v_customer text;
  v_subscription text;
  v_email text;
  v_plan text;
  v_trades text[];
  v_trade text;
  v_seats_text text;
  v_seats integer;
  v_included integer;
  v_company text;
  v_phone text;
  v_org uuid;
begin
  select e.body -> 'data' -> 'object' into v_session from private.stripe_events e where e.id = p_event_id;
  v_meta := case when jsonb_typeof(v_session -> 'metadata') = 'object' then v_session -> 'metadata' else '{}'::jsonb end;

  v_customer := case when jsonb_typeof(v_session -> 'customer') = 'string' then v_session ->> 'customer' end;
  v_subscription := case when jsonb_typeof(v_session -> 'subscription') = 'string' then v_session ->> 'subscription' end;
  if v_session ->> 'mode' is distinct from 'subscription' or coalesce(v_customer, '') = '' or coalesce(v_subscription, '') = '' then
    raise exception 'not_a_subscription' using errcode = 'P0001';
  end if;

  -- The same subscription under another event id: the first provisioning stands. Before the email check, which the first
  -- provisioning's own invitation would trip.
  if exists (select 1 from public.org_billing b where b.stripe_subscription_id = v_subscription) then
    raise exception 'already_provisioned' using errcode = 'P0001';
  end if;

  v_email := lower(btrim(coalesce(
    case when jsonb_typeof(v_session -> 'customer_details' -> 'email') = 'string' then v_session -> 'customer_details' ->> 'email' end,
    case when jsonb_typeof(v_session -> 'customer_email') = 'string' then v_session ->> 'customer_email' end, '')));
  v_plan := case when jsonb_typeof(v_meta -> 'plan') = 'string' then v_meta ->> 'plan' end;
  v_included := case v_plan when 'starter' then 2 when 'team' then 5 when 'business' then 10 end;
  v_trades := case when jsonb_typeof(v_meta -> 'trades') = 'string' then string_to_array(v_meta ->> 'trades', ',') end;
  v_seats_text := case when jsonb_typeof(v_meta -> 'seats') = 'string' then v_meta ->> 'seats' end;
  v_company := case when jsonb_typeof(v_meta -> 'company') = 'string' then btrim(v_meta ->> 'company') end;
  v_phone := case when jsonb_typeof(v_meta -> 'phone') = 'string' then nullif(btrim(v_meta ->> 'phone'), '') end;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254
     or v_included is null
     or v_trades is null or cardinality(v_trades) not between 1 and 4
     or v_seats_text is null or v_seats_text !~ '^[0-9]{1,3}$'
     or coalesce(char_length(v_company), 0) not between 1 and 120 then
    raise exception 'invalid_metadata' using errcode = 'P0001';
  end if;
  foreach v_trade in array v_trades loop
    if v_trade not in ('hvac', 'plumbing', 'electrical', 'other') then
      raise exception 'invalid_metadata' using errcode = 'P0001';
    end if;
  end loop;
  v_seats := v_seats_text::integer;
  if v_seats not between v_included and 50 then
    raise exception 'invalid_metadata' using errcode = 'P0001';
  end if;

  -- One org per person until there is an org switcher (decision 9, AD-131): a membership, or a live invitation, anywhere.
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id where lower(u.email) = v_email
  ) or exists (
    select 1 from public.invitations i where i.email = v_email and i.accepted_at is null and i.expires_at > now()
  ) then
    raise exception 'email_in_use' using errcode = 'P0001';
  end if;

  insert into public.orgs (name) values (v_company) returning id into v_org;
  insert into public.org_settings (org_id, legal_name, phone) values (v_org, v_company, v_phone);
  insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
  values (v_org, v_customer, v_subscription, v_plan, v_seats, v_trades, 'other' = any (v_trades));
  foreach v_trade in array v_trades loop
    if v_trade <> 'other' then
      perform private.seed_org_catalog(v_org, v_trade);
    end if;
  end loop;
  insert into public.invitations (org_id, email, role, invited_by, expires_at)
  values (v_org, v_email, 'owner', null, now() + interval '30 days');
  return v_email;
end $$;

revoke execute on function private.provision_workspace(text) from public, anon, authenticated;

-- The processing step of a stored checkout event. It is new, or stored and not yet processed (a refused attempt that is valid
-- now, or an old row): the row is locked first, so two simultaneous deliveries take turns and the second finds `processed_at`
-- set. The attempt runs in a subtransaction: a refusal or failure rolls back everything it wrote and leaves a code on the
-- event. Returns the owner's email when this call created the org, else null. The only writer of the two ledger columns, so
-- `stripe_receive_event` keeps insert-on-conflict as its one write (billing-checkout C2528).
create function private.process_checkout_event(p_event_id text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_done timestamptz;
  v_email text;
  v_code text;
begin
  select e.processed_at into v_done from private.stripe_events e where e.id = p_event_id for update;
  if v_done is not null then
    return null;
  end if;
  begin
    v_email := private.provision_workspace(p_event_id);
    update private.stripe_events set processed_at = now(), process_error = null where id = p_event_id;
    return v_email;
  exception when others then
    v_code := case
      when sqlstate = '55000' then 'no_pack'
      when sqlstate = 'P0001' and sqlerrm in ('invalid_metadata', 'email_in_use', 'already_provisioned', 'not_a_subscription') then sqlerrm
      else 'failed'
    end;
    update private.stripe_events set process_error = v_code where id = p_event_id;
    return null;
  end;
end $$;

revoke execute on function private.process_checkout_event(text) from public, anon, authenticated;

-- stripe_receive_event, as billing-checkout door 3 built it, plus the processing step. The answer is still `recorded` or
-- `duplicate` whatever the step decides, so Stripe stops retrying a refusal that can never settle. `provisioned` appears only
-- on the delivery that created the org.
create or replace function public.stripe_receive_event(p_body text, p_signature text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_t text;
  v_v1 text[] := '{}';
  v_part text;
  v_secret text;
  v_expected text;
  v jsonb;
  v_id text;
  v_type text;
  v_rows integer;
  v_email text;
  v_answer jsonb;
begin
  -- The shape first, before any secret is read.
  if p_body is null or p_signature is null then
    raise exception 'bad signature' using errcode = '42501';
  end if;
  foreach v_part in array string_to_array(p_signature, ',') loop
    if v_part ~ '^t=[0-9]{1,12}$' then
      v_t := substr(v_part, 3);
    elsif v_part ~ '^v1=[0-9a-f]{64}$' then
      v_v1 := v_v1 || substr(v_part, 4);
    end if;
  end loop;
  if v_t is null or cardinality(v_v1) = 0 then
    raise exception 'bad signature' using errcode = '42501';
  end if;

  -- Closed when unconfigured, with its own code so the app answers 503 and not 401.
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'stripe_webhook_secret';
  if v_secret is null or v_secret = '' then
    raise exception 'stripe webhook secret is not set' using errcode = '55000';
  end if;

  if abs(floor(extract(epoch from now()))::bigint - v_t::bigint) > 300 then
    raise exception 'stale signature' using errcode = '42501';
  end if;
  v_expected := encode(extensions.hmac(v_t || '.' || p_body, v_secret, 'sha256'), 'hex');
  if not (v_expected = any (v_v1)) then
    raise exception 'bad signature' using errcode = '42501';
  end if;

  begin
    v := p_body::jsonb;
  exception when others then
    raise exception 'body is not JSON' using errcode = '22023';
  end;
  if jsonb_typeof(v) is distinct from 'object'
     or jsonb_typeof(v -> 'id') is distinct from 'string'
     or jsonb_typeof(v -> 'type') is distinct from 'string' then
    raise exception 'body is not an event' using errcode = '22023';
  end if;
  v_id := v ->> 'id';
  v_type := v ->> 'type';
  if v_id !~ '^evt_' then
    raise exception 'body is not an event' using errcode = '22023';
  end if;

  if v_type not in ('checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
                    'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed') then
    return jsonb_build_object('outcome', 'ignored');
  end if;

  insert into private.stripe_events (id, type, body) values (v_id, v_type, v) on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  v_answer := jsonb_build_object('outcome', case when v_rows = 1 then 'recorded' else 'duplicate' end);

  if v_type = 'checkout.session.completed' then
    v_email := private.process_checkout_event(v_id);
    if v_email is not null then
      v_answer := v_answer || jsonb_build_object('provisioned', jsonb_build_object('email', v_email));
    end if;
  end if;
  return v_answer;
end;
$$;
