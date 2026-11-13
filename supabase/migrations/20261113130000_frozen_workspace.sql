-- A company whose subscription ended (canceled, unpaid, or never completed) can still sign in, but its workspace is read-only until
-- it renews. Stripe's own statuses are mirrored on org_billing; an org with no org_billing row (the demo org) is never frozen.

alter table public.org_billing
  add column status text not null default 'active',
  add column status_event_at bigint not null default 0;

-- Keeps org_billing.status in step with Stripe. Events can arrive out of order, so one older than the last applied is ignored.
-- A renewal is a Checkout for the org's existing Stripe customer that carries metadata.sa_renew_org: it swaps in the new
-- subscription and thaws the org, and is not a new workspace, so it is marked processed here.
create function private.apply_billing_event()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_obj jsonb := new.body -> 'data' -> 'object';
  v_created bigint := case when jsonb_typeof(new.body -> 'created') = 'number' then (new.body ->> 'created')::bigint else 0 end;
  v_meta jsonb;
begin
  if jsonb_typeof(v_obj) is distinct from 'object' then
    return null;
  end if;
  if new.type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    update public.org_billing b
    set status = case when new.type = 'customer.subscription.deleted' then 'canceled' else coalesce(v_obj ->> 'status', b.status) end,
        status_event_at = v_created
    where b.stripe_subscription_id = v_obj ->> 'id' and b.status_event_at <= v_created;
  elsif new.type = 'checkout.session.completed' then
    v_meta := v_obj -> 'metadata';
    if jsonb_typeof(v_meta) = 'object'
       and (v_meta ->> 'sa_renew_org') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and jsonb_typeof(v_obj -> 'subscription') = 'string' then
      update public.org_billing b
      set stripe_subscription_id = v_obj ->> 'subscription', status = 'active', status_event_at = v_created
      where b.org_id = (v_meta ->> 'sa_renew_org')::uuid and b.stripe_customer_id = v_obj ->> 'customer';
      update private.stripe_events set processed_at = now(), process_error = null where id = new.id;
    end if;
  end if;
  return null;
end $$;

revoke execute on function private.apply_billing_event() from public, anon, authenticated;

create trigger stripe_events_apply_billing after insert on private.stripe_events
for each row execute function private.apply_billing_event();

-- Whether the caller's org is frozen. A boolean only, so every role can ask (org_billing itself is visible to owners and admins).
create function public.my_org_frozen()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select b.status in ('canceled', 'unpaid', 'incomplete_expired')
    from public.memberships m join public.org_billing b on b.org_id = m.org_id
    where m.user_id = (select auth.uid())
    order by m.created_at
    limit 1
  ), false)
$$;

revoke all on function public.my_org_frozen() from public, anon;
grant execute on function public.my_org_frozen() to authenticated;
