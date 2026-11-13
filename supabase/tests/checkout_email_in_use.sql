-- checkout-email-in-use, database side: C4302-C4305, C4310, C4311, C4313 (.specs/features/checkout-email-in-use/checks.md).
-- Run after fixture.sql and the migration in the same execute_sql call (npm run test:db checkout_email_in_use): the recipe puts
-- 20261112210000_checkout_email_in_use.sql between them, inside the rolled-back transaction, so the hosted project needs no change.

reset role;
select set_config('request.jwt.claims', '', true);

-- The answer an anonymous caller gets.
create function tests.ceu_has(p_email text) returns boolean
language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as_anon();
  r := public.email_has_workspace(p_email);
  reset role;
  return r;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Invitations: one live, one expired, one accepted with no membership behind it. 'ua' holds a membership (fixture).
insert into public.invitations (org_id, email, role, expires_at) values
  (tests.id('orgA'), 'live@elsewhere.test', 'viewer', now() + interval '3 days'),
  (tests.id('orgA'), 'expired@elsewhere.test', 'viewer', now() - interval '1 day');
insert into public.invitations (org_id, email, role, expires_at, accepted_at, accepted_by) values
  (tests.id('orgA'), 'accepted@elsewhere.test', 'viewer', now() + interval '3 days', now(), tests.id('uX'));

-- C4302: a membership anywhere.
do $$
begin
  perform tests.ok('C4302 membership', tests.ceu_has('ua@example.test'), 'a member email was not in use');
end $$;

-- C4303: a live invitation.
do $$
begin
  perform tests.ok('C4303 live invitation', tests.ceu_has('live@elsewhere.test'), 'a live invitation was not in use');
end $$;

-- C4304: an expired invitation, an accepted one with no membership, and nothing at all.
do $$
begin
  perform tests.ok('C4304 expired invitation', not tests.ceu_has('expired@elsewhere.test'), 'an expired invitation blocked');
  perform tests.ok('C4304 accepted invitation', not tests.ceu_has('accepted@elsewhere.test'), 'an accepted invitation blocked');
  perform tests.ok('C4304 unknown email', not tests.ceu_has('nobody@nowhere.test'), 'an unknown email was in use');
end $$;

-- C4305: padded and mixed case match the lower-case holder.
do $$
begin
  perform tests.ok('C4305 padded mixed case membership', tests.ceu_has(' UA@Example.Test '), 'padding or case hid a membership');
  perform tests.ok('C4305 padded mixed case invitation', tests.ceu_has('  Live@Elsewhere.TEST '), 'padding or case hid an invitation');
end $$;

-- C4310: grants, and that the read writes nothing.
do $$
begin
  perform tests.ok('C4310 anon', has_function_privilege('anon', 'public.email_has_workspace(text)', 'execute'), 'anon cannot execute');
  perform tests.ok('C4310 authenticated', has_function_privilege('authenticated', 'public.email_has_workspace(text)', 'execute'), 'authenticated cannot execute');
  perform tests.ok('C4310 public', not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.email_has_workspace(text)'::regprocedure and a.grantee = 0), 'public can execute');
  perform tests.ok('C4310 stable', (select provolatile from pg_proc where oid = 'public.email_has_workspace(text)'::regprocedure) = 's', 'the read is not stable');
  perform tests.ok('C4310 predicate anon', not has_function_privilege('anon', 'private.email_in_use(text)', 'execute'), 'anon can run the predicate');
  perform tests.ok('C4310 predicate authenticated', not has_function_privilege('authenticated', 'private.email_in_use(text)', 'execute'), 'authenticated can run the predicate');
end $$;

-- C4311: input that is not an email answers false without an error.
do $$
begin
  perform tests.ok('C4311 null', tests.ceu_has(null) = false, 'null did not answer false');
  perform tests.ok('C4311 empty', tests.ceu_has('') = false, 'empty did not answer false');
  perform tests.ok('C4311 blank', tests.ceu_has('   ') = false, 'blank did not answer false');
  perform tests.ok('C4311 malformed', tests.ceu_has('not-an-email') = false, 'malformed did not answer false');
  perform tests.ok('C4311 too long', tests.ceu_has(repeat('a', 300) || '@example.test') = false, '300 characters did not answer false');
end $$;

-- C4313: two checkouts for the same new email under different subscriptions. The first provisions; the second finds the
-- owner invitation the first left and is refused, with no org of its own.
create function tests.ceu_event(p_n text) returns void
language sql as $$
  insert into private.stripe_events (id, type, body)
  values ('evt_ceu_' || p_n, 'checkout.session.completed',
    jsonb_build_object('id', 'evt_ceu_' || p_n, 'type', 'checkout.session.completed', 'data', jsonb_build_object('object', jsonb_build_object(
      'id', 'cs_ceu_' || p_n, 'mode', 'subscription', 'customer', 'cus_ceu_' || p_n, 'subscription', 'sub_ceu_' || p_n,
      'customer_details', jsonb_build_object('email', 'Racer@Shop.Test'),
      'metadata', jsonb_build_object('plan', 'team', 'trades', 'hvac', 'seats', '5', 'company', 'Racer Co ' || p_n, 'phone', '')))))
$$;

do $$
declare
  v_first text;
  v_second text;
begin
  perform tests.ceu_event('1');
  perform tests.ceu_event('2');
  v_first := private.process_checkout_event('evt_ceu_1');
  v_second := private.process_checkout_event('evt_ceu_2');
  perform tests.ok('C4313 first provisioned', v_first = 'racer@shop.test' and exists (
    select 1 from private.stripe_events e where e.id = 'evt_ceu_1' and e.processed_at is not null and e.process_error is null), 'the first did not provision');
  perform tests.ok('C4313 owner invitation', (select count(*) from public.invitations where email = 'racer@shop.test' and role = 'owner') = 1, 'not exactly one owner invitation');
  perform tests.ok('C4313 second refused', v_second is null and exists (
    select 1 from private.stripe_events e where e.id = 'evt_ceu_2' and e.processed_at is null and e.process_error = 'email_in_use'), 'the second was not refused email_in_use');
  perform tests.ok('C4313 second made no org', not exists (select 1 from public.orgs where name = 'Racer Co 2'), 'the second left an org');
  perform tests.ok('C4313 only one org', (select count(*) from public.orgs where name like 'Racer Co %') = 1, 'not exactly one racer org');
end $$;

reset role;
rollback;
select 'checkout_email_in_use: pass' as result;
