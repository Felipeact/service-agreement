-- plan-change, database side: C3215, C3216 (.specs/features/plan-change/checks.md).
-- Run after fixture.sql (npm run test:db set_org_plan). Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB; uX has
-- no membership. The migration 20261110190000_set_org_plan.sql is applied to the hosted project only with the owner's
-- go-ahead; it was applied on 2026-11-10 by the owner, so this file no longer replays it and tests the hosted function (as
-- first_login_setup does). Expected values come from the plan, never read back from the migration.

reset role;

grant execute on all functions in schema tests to anon, authenticated;

-- Both orgs have a subscription on the starter plan with 2 seats; the owner of org B has a different one.
insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade) values
  (tests.id('orgA'), 'cus_sp_a', 'sub_sp_a', 'starter', 2, array['hvac'], false),
  (tests.id('orgB'), 'cus_sp_b', 'sub_sp_b', 'business', 10, array['hvac'], false);

-- C3215: an owner changes the plan and seats of their own org and nothing else.
do $$
declare
  a_before public.org_billing;
  a_after public.org_billing;
begin
  select * into a_before from public.org_billing where org_id = tests.id('orgA');
  perform tests.act_as('uA');
  perform public.set_org_plan('team', 5);
  reset role;
  select * into a_after from public.org_billing where org_id = tests.id('orgA');
  perform tests.ok('C3215 owner plan', a_after.plan = 'team', 'plan is ' || a_after.plan);
  perform tests.ok('C3215 owner seats', a_after.seats = 5, 'seats are ' || a_after.seats);
  perform tests.ok('C3215 other columns', a_after.stripe_customer_id = a_before.stripe_customer_id
    and a_after.stripe_subscription_id = a_before.stripe_subscription_id and a_after.trades = a_before.trades
    and a_after.other_trade = a_before.other_trade and a_after.created_at = a_before.created_at and a_after.org_id = a_before.org_id,
    'a column other than plan and seats changed');
  perform tests.ok('C3215 other org untouched', (select plan from public.org_billing where org_id = tests.id('orgB')) = 'business'
    and (select seats from public.org_billing where org_id = tests.id('orgB')) = 10, 'org B changed');
end $$;

-- C3215: an admin may too (the estimator is promoted inside the transaction).
do $$
begin
  reset role;
  update public.memberships set role = 'admin' where user_id = tests.id('uE') and org_id = tests.id('orgA');
  perform tests.act_as('uE');
  perform public.set_org_plan('business', 12);
  reset role;
  perform tests.ok('C3215 admin plan', (select plan from public.org_billing where org_id = tests.id('orgA')) = 'business', 'admin did not change the plan');
  perform tests.ok('C3215 admin seats', (select seats from public.org_billing where org_id = tests.id('orgA')) = 12, 'admin did not change the seats');
  update public.memberships set role = 'estimator' where user_id = tests.id('uE') and org_id = tests.id('orgA');
end $$;

-- C3216: an estimator, a viewer and a non-member are refused, and nothing changes.
do $$
begin
  reset role;
  update public.org_billing set plan = 'starter', seats = 2 where org_id = tests.id('orgA');
  perform tests.act_as('uE');
  perform tests.expect_error('C3216 estimator', $q$select public.set_org_plan('team', 5)$q$, '42501');
  perform tests.act_as('uV');
  perform tests.expect_error('C3216 viewer', $q$select public.set_org_plan('team', 5)$q$, '42501');
  perform tests.act_as('uX');
  perform tests.expect_error('C3216 non-member', $q$select public.set_org_plan('team', 5)$q$, '42501');
  reset role;
  perform tests.ok('C3216 nothing changed', (select plan from public.org_billing where org_id = tests.id('orgA')) = 'starter'
    and (select seats from public.org_billing where org_id = tests.id('orgA')) = 2, 'a refused call changed the row');
end $$;

-- C3216: an org with no billing record, and values outside the bounds.
do $$
begin
  reset role;
  delete from public.org_billing where org_id = tests.id('orgB');
  perform tests.act_as('uB');
  perform tests.expect_error('C3216 no billing record', $q$select public.set_org_plan('team', 5)$q$, 'P0002');
  perform tests.act_as('uA');
  perform tests.expect_error('C3216 plan outside the three', $q$select public.set_org_plan('platinum', 5)$q$, '22023');
  perform tests.expect_error('C3216 null plan', $q$select public.set_org_plan(null, 5)$q$, '22023');
  perform tests.expect_error('C3216 seats 0', $q$select public.set_org_plan('team', 0)$q$, '22023');
  perform tests.expect_error('C3216 seats 51', $q$select public.set_org_plan('team', 51)$q$, '22023');
  perform tests.expect_error('C3216 null seats', $q$select public.set_org_plan('team', null)$q$, '22023');
  reset role;
  perform tests.ok('C3216 still unchanged', (select plan from public.org_billing where org_id = tests.id('orgA')) = 'starter'
    and (select seats from public.org_billing where org_id = tests.id('orgA')) = 2, 'a refused call changed the row');
end $$;

-- C3216: the privileges. The function is the only writer: members have no update grant on the table.
do $$
begin
  reset role;
  perform tests.ok('C3216 anon cannot execute', not has_function_privilege('anon', 'public.set_org_plan(text, integer)', 'execute'), 'anon can execute');
  perform tests.ok('C3216 authenticated can execute', has_function_privilege('authenticated', 'public.set_org_plan(text, integer)', 'execute'), 'authenticated cannot execute');
  perform tests.ok('C3216 no update grant', not has_table_privilege('authenticated', 'public.org_billing', 'update')
    and not has_table_privilege('anon', 'public.org_billing', 'update'), 'a member role can update org_billing directly');
  perform tests.act_as_anon();
  perform tests.expect_error('C3216 anon call', $q$select public.set_org_plan('team', 5)$q$, '42501');
  perform tests.act_as('uA');
  perform tests.expect_error('C3216 direct update', $q$update public.org_billing set plan = 'team'$q$, '42501');
end $$;

reset role;
rollback;
select 'set_org_plan: pass' as result;
