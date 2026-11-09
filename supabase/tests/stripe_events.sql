-- billing-checkout S2, database side: C2517-C2528 (.specs/features/billing-checkout/checks.md).
-- Run after fixture.sql in the same execute_sql call (npm run test:db stripe_events). Needs migration 20261109190000_stripe_events.
-- Setup runs as the table owner. The Vault secret is made inside the rolled-back transaction; no real Stripe secret is used.

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.sx_secret(p_value text) returns void
language plpgsql as $$
begin
  delete from vault.secrets where name = 'stripe_webhook_secret';
  if p_value is not null then
    perform vault.create_secret(p_value, 'stripe_webhook_secret');
  end if;
end $$;

-- The unix second the database calls now(), shifted by p_shift seconds.
create function tests.sx_now(p_shift integer default 0) returns bigint
language sql as $$ select floor(extract(epoch from now()))::bigint + p_shift $$;

-- One v1 value: HMAC-SHA256(secret, '<t>.<body>') in hex.
create function tests.sx_v1(p_t bigint, p_body text, p_secret text) returns text
language sql as $$ select encode(extensions.hmac(p_t || '.' || p_body, p_secret, 'sha256'), 'hex') $$;

-- A header signed the way Stripe signs it.
create function tests.sx_header(p_body text, p_secret text default 'whsec_test', p_shift integer default 0) returns text
language sql as $$
  select 't=' || tests.sx_now(p_shift) || ',v1=' || tests.sx_v1(tests.sx_now(p_shift), p_body, p_secret)
$$;

create function tests.sx_event(p_id text, p_type text, p_extra text default 'a') returns text
language sql as $$ select json_build_object('id', p_id, 'type', p_type, 'data', json_build_object('x', p_extra))::text $$;

create function tests.sx_call(p_body text, p_header text) returns jsonb
language sql as $$ select public.stripe_receive_event(p_body, p_header) $$;

create function tests.sx_rows(p_id text) returns bigint
language sql as $$ select count(*) from private.stripe_events where id = p_id $$;

select tests.sx_secret('whsec_test');

-- C2517: a signed event of a stored type is recorded once, with its id, type, body and time; callable as anon.
do $$
declare
  v_body text := tests.sx_event('evt_c2517', 'checkout.session.completed', 'é');
  v_header text := tests.sx_header(v_body);
  v_answer jsonb;
begin
  perform tests.act_as_anon();
  v_answer := public.stripe_receive_event(v_body, v_header);
  reset role;
  perform tests.ok('C2517 outcome', v_answer = '{"outcome": "recorded"}'::jsonb, 'answer was ' || v_answer::text);
  perform tests.ok('C2517 one row', tests.sx_rows('evt_c2517') = 1, 'the event was not stored once');
  perform tests.ok('C2517 columns', exists (
    select 1 from private.stripe_events
    where id = 'evt_c2517' and type = 'checkout.session.completed' and body = v_body::jsonb
      and received_at between now() - interval '5 seconds' and now() + interval '5 seconds'), 'a stored column differs from the event');
end $$;

-- C2518: each of the six stored types is recorded.
do $$
declare
  t text;
  i integer := 0;
begin
  foreach t in array array['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
                           'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'] loop
    i := i + 1;
    perform tests.ok('C2518 ' || t, tests.sx_call(tests.sx_event('evt_c2518_' || i, t), tests.sx_header(tests.sx_event('evt_c2518_' || i, t))) = '{"outcome": "recorded"}'::jsonb, 'not recorded');
    perform tests.ok('C2518 stored ' || t, exists (select 1 from private.stripe_events where id = 'evt_c2518_' || i and type = t), 'no row');
  end loop;
  perform tests.ok('C2518 size', i = 6, 'the set is not 6');
end $$;

-- C2519: the same id again is a duplicate, the first body is kept, one row remains.
do $$
declare
  v_first text := tests.sx_event('evt_c2519', 'invoice.paid', 'first');
  v_second text := tests.sx_event('evt_c2519', 'invoice.paid', 'second');
begin
  perform tests.ok('C2519 first', tests.sx_call(v_first, tests.sx_header(v_first)) = '{"outcome": "recorded"}'::jsonb, 'first not recorded');
  perform tests.ok('C2519 same body', tests.sx_call(v_first, tests.sx_header(v_first)) = '{"outcome": "duplicate"}'::jsonb, 'repeat not a duplicate');
  perform tests.ok('C2519 other body', tests.sx_call(v_second, tests.sx_header(v_second)) = '{"outcome": "duplicate"}'::jsonb, 'same id with another body not a duplicate');
  perform tests.ok('C2519 one row', tests.sx_rows('evt_c2519') = 1, 'more than one row for the id');
  perform tests.ok('C2519 first kept', (select body -> 'data' ->> 'x' from private.stripe_events where id = 'evt_c2519') = 'first', 'the first body was replaced');
end $$;

-- C2520: verified types that are not kept are ignored and add nothing.
do $$
declare
  t text;
  i integer := 0;
begin
  foreach t in array array['charge.succeeded', 'invoice.created', 'customer.created'] loop
    i := i + 1;
    perform tests.ok('C2520 ' || t, tests.sx_call(tests.sx_event('evt_c2520_' || i, t), tests.sx_header(tests.sx_event('evt_c2520_' || i, t))) = '{"outcome": "ignored"}'::jsonb, 'not ignored');
    perform tests.ok('C2520 no row ' || t, tests.sx_rows('evt_c2520_' || i) = 0, 'a row was stored');
  end loop;
end $$;

-- C2521: a signature that does not match is refused with 42501 and stores nothing.
do $$
declare
  v_body text := tests.sx_event('evt_c2521', 'invoice.paid');
  v_t bigint := tests.sx_now();
begin
  perform tests.expect_error('C2521 other secret', format('select tests.sx_call(%L, %L)', v_body, tests.sx_header(v_body, 'whsec_other')), '42501');
  perform tests.expect_error('C2521 changed body', format('select tests.sx_call(%L, %L)', v_body || ' ', tests.sx_header(v_body)), '42501');
  perform tests.expect_error('C2521 body alone', format('select tests.sx_call(%L, %L)', v_body,
    't=' || v_t || ',v1=' || encode(extensions.hmac(v_body, 'whsec_test', 'sha256'), 'hex')), '42501');
  perform tests.ok('C2521 nothing stored', tests.sx_rows('evt_c2521') = 0, 'a row was stored');
end $$;

-- C2522: 300 s either side is accepted, 301 s either side is refused.
do $$
declare
  v_body text;
begin
  v_body := tests.sx_event('evt_c2522_old300', 'invoice.paid');
  perform tests.ok('C2522 -300', tests.sx_call(v_body, tests.sx_header(v_body, 'whsec_test', -300)) = '{"outcome": "recorded"}'::jsonb, '300 s old refused');
  v_body := tests.sx_event('evt_c2522_new300', 'invoice.paid');
  perform tests.ok('C2522 +300', tests.sx_call(v_body, tests.sx_header(v_body, 'whsec_test', 300)) = '{"outcome": "recorded"}'::jsonb, '300 s ahead refused');
  v_body := tests.sx_event('evt_c2522_old301', 'invoice.paid');
  perform tests.expect_error('C2522 -301', format('select tests.sx_call(%L, %L)', v_body, tests.sx_header(v_body, 'whsec_test', -301)), '42501');
  v_body := tests.sx_event('evt_c2522_new301', 'invoice.paid');
  perform tests.expect_error('C2522 +301', format('select tests.sx_call(%L, %L)', v_body, tests.sx_header(v_body, 'whsec_test', 301)), '42501');
  perform tests.ok('C2522 refused stored nothing', tests.sx_rows('evt_c2522_old301') = 0 and tests.sx_rows('evt_c2522_new301') = 0, 'a refused event was stored');
end $$;

-- C2523: two v1 values, either may match.
do $$
declare
  v_body text := tests.sx_event('evt_c2523', 'invoice.paid');
  v_t bigint := tests.sx_now();
  v_good text := tests.sx_v1(v_t, v_body, 'whsec_test');
  v_bad text := tests.sx_v1(v_t, v_body, 'whsec_rolled');
begin
  perform tests.ok('C2523 first matches', tests.sx_call(v_body, 't=' || v_t || ',v1=' || v_good || ',v1=' || v_bad) = '{"outcome": "recorded"}'::jsonb, 'first v1 refused');
  v_body := tests.sx_event('evt_c2523b', 'invoice.paid');
  v_good := tests.sx_v1(v_t, v_body, 'whsec_test');
  v_bad := tests.sx_v1(v_t, v_body, 'whsec_rolled');
  perform tests.ok('C2523 second matches', tests.sx_call(v_body, 't=' || v_t || ',v1=' || v_bad || ',v1=' || v_good) = '{"outcome": "recorded"}'::jsonb, 'second v1 refused');
  v_body := tests.sx_event('evt_c2523c', 'invoice.paid');
  perform tests.expect_error('C2523 neither', format('select tests.sx_call(%L, %L)', v_body,
    't=' || v_t || ',v1=' || tests.sx_v1(v_t, v_body, 'whsec_a') || ',v1=' || tests.sx_v1(v_t, v_body, 'whsec_b')), '42501');
  perform tests.ok('C2523 neither stored nothing', tests.sx_rows('evt_c2523c') = 0, 'a row was stored');
end $$;

-- C2524: no secret in Vault (absent, then empty) answers 55000, not 42501, and stores nothing.
do $$
declare
  v_body text := tests.sx_event('evt_c2524', 'invoice.paid');
  v_header text := tests.sx_header(v_body);
begin
  perform tests.sx_secret(null);
  perform tests.expect_error('C2524 absent', format('select tests.sx_call(%L, %L)', v_body, v_header), '55000');
  perform tests.sx_secret('');
  perform tests.expect_error('C2524 empty', format('select tests.sx_call(%L, %L)', v_body, v_header), '55000');
  perform tests.sx_secret('whsec_test');
  perform tests.ok('C2524 nothing stored', tests.sx_rows('evt_c2524') = 0, 'a row was stored');
end $$;

-- C2525: after a valid signature a body that is not an event is 22023.
do $$
declare
  v_body text;
begin
  foreach v_body in array array['not json', '[1, 2]', '{"type": "invoice.paid"}', '{"id": "cus_1", "type": "invoice.paid"}', '{"id": "evt_c2525", "type": 5}'] loop
    perform tests.expect_error('C2525 ' || v_body, format('select tests.sx_call(%L, %L)', v_body, tests.sx_header(v_body)), '22023');
  end loop;
  perform tests.ok('C2525 nothing stored', tests.sx_rows('evt_c2525') = 0, 'a row was stored');
end $$;

-- C2526: a header of the wrong shape is 42501 before any secret is read (so also with the secret absent).
do $$
declare
  v_body text := tests.sx_event('evt_c2526', 'invoice.paid');
  v_t bigint := tests.sx_now();
  v_v1 text := tests.sx_v1(v_t, v_body, 'whsec_test');
  v_header text;
begin
  perform tests.sx_secret(null);
  foreach v_header in array array[
    'v1=' || v_v1,
    't=abc,v1=' || v_v1,
    't=' || v_t,
    't=' || v_t || ',v1=' || left(v_v1, 63),
    't=' || v_t || ',v0=' || v_v1] loop
    perform tests.expect_error('C2526 ' || left(v_header, 30), format('select tests.sx_call(%L, %L)', v_body, v_header), '42501');
  end loop;
  perform tests.sx_secret('whsec_test');
end $$;

-- C2527: no direct table access for anon or authenticated; the function is definer, search_path empty, executable by both.
do $$
declare
  r text;
  p text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      perform tests.ok('C2527 ' || r || ' ' || p, not has_table_privilege(r, 'private.stripe_events', p), r || ' holds ' || p);
    end loop;
    perform tests.ok('C2527 execute ' || r, has_function_privilege(r, 'public.stripe_receive_event(text, text)', 'execute'), r || ' cannot execute');
  end loop;
  perform tests.ok('C2527 public', not exists (
    select 1 from pg_proc f, aclexplode(f.proacl) a
    where f.oid = 'public.stripe_receive_event(text, text)'::regprocedure and a.grantee = 0), 'public can execute');
  perform tests.ok('C2527 definer', (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.stripe_receive_event(text, text)'::regprocedure), 'not definer with an empty search_path');
end $$;

-- C2528: the id is the primary key and the function's only write is insert ... on conflict (id) do nothing.
do $$
begin
  perform tests.ok('C2528 primary key', exists (
    select 1 from pg_index i
    where i.indrelid = 'private.stripe_events'::regclass and i.indisprimary
      and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['id']), 'id is not the primary key');
  perform tests.ok('C2528 on conflict', (select regexp_replace(prosrc, '\s+', ' ', 'g') from pg_proc where oid = 'public.stripe_receive_event(text, text)'::regprocedure)
    ~ 'insert into private\.stripe_events \(id, type, body\) values \(v_id, v_type, v\) on conflict \(id\) do nothing', 'the insert is not on conflict (id) do nothing');
  perform tests.ok('C2528 only write', (select (length(prosrc) - length(replace(lower(prosrc), 'insert into', ''))) / length('insert into') from pg_proc where oid = 'public.stripe_receive_event(text, text)'::regprocedure) = 1
    and not (select lower(prosrc) ~ '(update|delete from) private\.stripe_events' from pg_proc where oid = 'public.stripe_receive_event(text, text)'::regprocedure), 'the function writes the table another way');
end $$;

rollback;
select 'stripe_events: pass' as result;
