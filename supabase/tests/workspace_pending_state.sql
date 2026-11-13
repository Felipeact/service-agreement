-- workspace-pending-state, database side: C4210-C4218 (.specs/features/workspace-pending-state/checks.md).
-- Run after fixture.sql and the migration in the same execute_sql call (npm run test:db workspace_pending_state): the recipe puts
-- 20261112200000_workspace_pending_state.sql between them, inside the rolled-back transaction, so the hosted project needs no change.
-- Stored events are inserted as the table owner; the callers then act as anon or as a signed-in user with an email claim.

reset role;
select set_config('request.jwt.claims', '', true);

-- A stored event of type p_type for Checkout session p_session and email p_email, with the given process state.
create function tests.wps_event(p_id text, p_session text, p_email text, p_done boolean, p_error text, p_type text default 'checkout.session.completed')
returns void
language sql as $$
  insert into private.stripe_events (id, type, body, processed_at, process_error)
  values (p_id, p_type,
          jsonb_build_object('id', p_id, 'type', p_type,
            'data', jsonb_build_object('object', jsonb_build_object('id', p_session, 'customer_details', jsonb_build_object('email', p_email)))),
          case when p_done then now() end, p_error)
$$;

create function tests.wps_status(p_session text) returns text
language sql as $$ select public.checkout_workspace_status(p_session) $$;

-- A signed-in caller whose token carries p_email.
create function tests.wps_as(p_email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tests.id('wps_' || p_email), 'role', 'authenticated', 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.wps_mine() returns text
language sql as $$ select public.my_workspace_state() $$;

select tests.wps_event('evt_wps_ready', 'cs_wps_ready', 'ready@shop.test', true, null);
select tests.wps_event('evt_wps_refused', 'cs_wps_refused', 'refused@shop.test', false, 'invalid_metadata');
select tests.wps_event('evt_wps_pending', 'cs_wps_pending', 'pending@shop.test', false, null);
select tests.wps_event('evt_wps_other_type', 'cs_wps_other', 'other@shop.test', false, null, 'invoice.paid');
-- One session delivered twice: one refused, one processed.
select tests.wps_event('evt_wps_both_a', 'cs_wps_both', 'both@shop.test', false, 'already_provisioned');
select tests.wps_event('evt_wps_both_b', 'cs_wps_both', 'both@shop.test', true, null);
-- One email with a refused attempt and later a processed one; one stored with a mixed-case, padded email.
select tests.wps_event('evt_wps_redo_a', 'cs_wps_redo_a', 'redo@shop.test', false, 'no_pack');
select tests.wps_event('evt_wps_redo_b', 'cs_wps_redo_b', 'redo@shop.test', true, null);
select tests.wps_event('evt_wps_case', 'cs_wps_case', ' Case@Shop.Test ', false, 'failed');

-- C4210: a matching processed event is ready.
do $$
begin
  perform tests.act_as_anon();
  perform tests.ok('C4210', tests.wps_status('cs_wps_ready') = 'ready', 'a processed event is not ready');
end $$;

-- C4211: a refused event answers exactly refused, no code in the text.
do $$
declare v text;
begin
  perform tests.act_as_anon();
  v := tests.wps_status('cs_wps_refused');
  perform tests.ok('C4211 refused', v = 'refused', 'got ' || coalesce(v, 'null'));
  perform tests.ok('C4211 no code', v not like '%invalid_metadata%' and length(v) = 7, 'the answer carries more than the word');
end $$;

-- C4212: everything that must answer pending, and raise nothing.
do $$
declare
  v text;
  n integer := 0;
  s text;
begin
  perform tests.act_as_anon();
  foreach s in array array['cs_wps_pending', 'cs_wps_unknown', '', '%', repeat('x', 5000), 'cs_wps_other'] loop
    n := n + 1;
    v := tests.wps_status(s);
    perform tests.ok('C4212 ' || n, v = 'pending', 'got ' || coalesce(v, 'null') || ' for input ' || n);
  end loop;
  v := tests.wps_status(null);
  perform tests.ok('C4212 null', v = 'pending', 'got ' || coalesce(v, 'null') || ' for null');
  perform tests.ok('C4212 size', n = 6, 'the set is not 6 plus null');
end $$;

-- C4213: one session, two events, one processed: ready wins.
do $$
begin
  perform tests.act_as_anon();
  perform tests.ok('C4213', tests.wps_status('cs_wps_both') = 'ready', 'the processed event did not win');
end $$;

reset role;

-- C4214: definer, empty search_path, grants, and no write.
do $$
declare
  f oid := 'public.checkout_workspace_status(text)'::regprocedure;
  before_rows bigint;
  after_rows bigint;
begin
  perform tests.ok('C4214 definer', (select prosecdef from pg_proc where oid = f), 'not security definer');
  perform tests.ok('C4214 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
  perform tests.ok('C4214 anon', has_function_privilege('anon', f, 'execute'), 'anon cannot execute');
  perform tests.ok('C4214 authenticated', has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot execute');
  perform tests.ok('C4214 public', not exists (
    select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = f and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 'public can execute');
  perform tests.ok('C4214 stable', (select provolatile from pg_proc where oid = f) = 's', 'the function is not stable');
  select count(*) into before_rows from private.stripe_events;
  perform tests.act_as_anon();
  perform tests.wps_status('cs_wps_ready');
  perform tests.wps_status('cs_wps_refused');
  reset role;
  select count(*) into after_rows from private.stripe_events;
  perform tests.ok('C4214 no write', before_rows = after_rows
    and (select count(*) from private.stripe_events where processed_at is not null) = 3, 'a call changed the ledger');
end $$;

reset role;

-- C4215: refused for a caller with only refused events; the email match ignores case and spaces.
do $$
begin
  perform tests.wps_as('refused@shop.test');
  perform tests.ok('C4215', tests.wps_mine() = 'refused', 'not refused');
  perform tests.wps_as('case@shop.test');
  perform tests.ok('C4215 case', tests.wps_mine() = 'refused', 'a mixed-case stored email did not match');
end $$;

-- C4216: pending for a caller with an event carrying neither stamp.
do $$
begin
  perform tests.wps_as('pending@shop.test');
  perform tests.ok('C4216', tests.wps_mine() = 'pending', 'not pending');
end $$;

-- C4217: none for no event, for a processed event, for a refused-then-processed email, and another email's events do not leak.
do $$
begin
  perform tests.wps_as('nobody@shop.test');
  perform tests.ok('C4217 no event', tests.wps_mine() = 'none', 'not none');
  perform tests.wps_as('ready@shop.test');
  perform tests.ok('C4217 processed', tests.wps_mine() = 'none', 'a processed event is not none');
  perform tests.wps_as('redo@shop.test');
  perform tests.ok('C4217 refused then processed', tests.wps_mine() = 'none', 'a later processed event did not win');
  perform tests.wps_as('other@shop.test');
  perform tests.ok('C4217 other type', tests.wps_mine() = 'none', 'an event of another type counted');
  perform set_config('request.jwt.claims', json_build_object('sub', tests.id('wps_x'), 'role', 'authenticated')::text, true);
  perform tests.ok('C4217 no email claim', tests.wps_mine() = 'none', 'a token with no email was not none');
end $$;

-- C4218: anon is refused.
reset role;
do $$
begin
  perform tests.act_as_anon();
  perform tests.expect_error('C4218', 'select public.my_workspace_state()', '42501');
end $$;

reset role;
rollback;
select 'workspace_pending_state: pass' as result;
