-- billing-checkout door 3: the ledger of Stripe's events and the one function that fills it.
--
-- Stripe's webhook has no session and no org (the tenant does not exist until provisioning reads these rows), so the table is
-- a platform table in the unexposed `private` schema, not a tenant table (AD-003 does not apply). Like DocuSeal's webhook
-- (AD-148) the database verifies the signature itself against a Vault secret, so the app never holds the webhook secret and
-- no service-role key is needed (AD-037, AD-073). The Vault secret is `stripe_webhook_secret` (the endpoint's `whsec_...`).

create table private.stripe_events (
  id text primary key check (id ~ '^evt_'),
  type text not null,
  body jsonb not null,
  received_at timestamptz not null default now()
);

alter table private.stripe_events enable row level security;
revoke all on private.stripe_events from public, anon, authenticated;

-- Header `Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>][,v0=<hex>]`; each `v1` is
-- HMAC-SHA256(secret, t || '.' || raw body), within 300 s of now; several `v1` appear while a secret rolls, and any one may
-- match (Stripe's docs, read 2026-11-09). Answers `{outcome}`: `recorded`, `duplicate` (the event id is already stored) or
-- `ignored` (a verified type we do not keep). Errors: 42501 (header shape, signature, age), 55000 (no secret in Vault, so
-- the app answers 503 and Stripe retries), 22023 (a verified body that is not an event).
create function public.stripe_receive_event(p_body text, p_signature text)
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
  return jsonb_build_object('outcome', case when v_rows = 1 then 'recorded' else 'duplicate' end);
end;
$$;

revoke all on function public.stripe_receive_event(text, text) from public;
grant execute on function public.stripe_receive_event(text, text) to anon, authenticated;
