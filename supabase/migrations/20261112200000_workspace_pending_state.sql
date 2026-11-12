-- workspace-pending-state doors 2 and 3 (.specs/features/workspace-pending-state/plan.md): two read-only answers over the Stripe
-- ledger's process state (AD-174), so the page Stripe returns a visitor to, and the no-workspace screen, can say whether a paid
-- workspace is being built, is ready or could not be built. Neither writes anything; neither returns the stored body or a code.

-- Door 2: the anonymous read, by Checkout session id. `ready` beats `refused` beats `pending`, and anything it cannot match
-- (null, empty, malformed, unknown, another event type) is `pending`, so it cannot be used to probe which ids exist.
create function public.checkout_workspace_status(p_session_id text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when coalesce(bool_or(e.processed_at is not null), false) then 'ready'
    when coalesce(bool_or(e.process_error is not null), false) then 'refused'
    else 'pending'
  end
  from private.stripe_events e
  where p_session_id is not null
    and p_session_id <> ''
    and e.type = 'checkout.session.completed'
    and e.body #>> '{data,object,id}' = p_session_id
$$;

revoke all on function public.checkout_workspace_status(text) from public, anon, authenticated;
grant execute on function public.checkout_workspace_status(text) to anon, authenticated;

-- Door 3: the signed-in read, by the caller's own email (never an argument). A processed event for the email means the
-- workspace exists, so the answer is `none` and today's copy stands; otherwise `refused` when any stored checkout was refused,
-- `pending` when one is stored with neither stamp, else `none`.
create function public.my_workspace_state()
returns text
language sql stable security definer
set search_path = ''
as $$
  with me as (
    select lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) as email
  )
  select case
    when coalesce(bool_or(e.processed_at is not null), false) then 'none'
    when coalesce(bool_or(e.process_error is not null), false) then 'refused'
    when count(*) > 0 then 'pending'
    else 'none'
  end
  from private.stripe_events e
  where e.type = 'checkout.session.completed'
    and (select email from me) <> ''
    and lower(btrim(coalesce(e.body #>> '{data,object,customer_details,email}', e.body #>> '{data,object,customer_email}', '')))
        = (select email from me)
$$;

revoke all on function public.my_workspace_state() from public, anon, authenticated;
grant execute on function public.my_workspace_state() to authenticated;
