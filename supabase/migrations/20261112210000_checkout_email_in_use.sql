-- checkout-email-in-use doors 1 and 2 (.specs/features/checkout-email-in-use/plan.md): the register form can ask, before
-- Checkout opens, whether an email already belongs to an org, by the same rule the webhook applies after payment.

-- Door 2: the one definition of "in use" (decision 9, AD-131): a membership, or a live invitation, anywhere. The argument is
-- already lower-cased and trimmed. Not executable by anon or authenticated; the two callers below are definers.
create function private.email_in_use(p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id where lower(u.email) = p_email
  ) or exists (
    select 1 from public.invitations i where i.email = p_email and i.accepted_at is null and i.expires_at > now()
  )
$$;

revoke execute on function private.email_in_use(text) from public, anon, authenticated;

-- Door 1: the anonymous read. Normalises as the webhook does and answers false, never an error, for null, empty or malformed
-- input. Answers a boolean only: no role, org or count.
create function public.email_has_workspace(p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    case
      when n.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(n.email) <= 254 then private.email_in_use(n.email)
    end,
    false)
  from (select lower(btrim(coalesce(p_email, ''))) as email) n
$$;

revoke all on function public.email_has_workspace(text) from public, anon, authenticated;
grant execute on function public.email_has_workspace(text) to anon, authenticated;

-- Redefined from 20261110110000_first_login_setup.sql with one change: the inline membership-or-invitation test is a call to
-- private.email_in_use, so the form and the webhook cannot disagree.
create or replace function private.provision_workspace(p_event_id text)
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
  if private.email_in_use(v_email) then
    raise exception 'email_in_use' using errcode = 'P0001';
  end if;

  insert into public.orgs (name) values (v_company) returning id into v_org;
  insert into public.org_settings (org_id, legal_name, phone, setup_completed_at) values (v_org, v_company, v_phone, null);
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
