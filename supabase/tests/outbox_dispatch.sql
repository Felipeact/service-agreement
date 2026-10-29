-- outbox-dispatch, database side: C1001-C1009, C1011-C1015, C1017, C1019-C1023, C1025-C1031, C1036, C1037, C1040,
-- C1042, C1043 (SQL halves where a check also has a vitest proof). Run after fixture.sql in the same execute_sql call
-- (npm run test:db outbox_dispatch). Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB. Added here:
-- uD admin of A, uE2 estimator of A. The Vault secrets are set inside this transaction; the rollback undoes them.
-- pg_net starts a request only after commit, so every queued request stays in net.http_request_queue; responses are
-- faked by inserting into net._http_response.

reset role;
select set_config('request.jwt.claims', '', true);

-- Setup and readers run as the table owner, whoever is signed in.
create function tests.od_hash(p_token text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_token, 'UTF8')), 'hex') $$;

-- A value of door 5's sealed format, readable per name.
create function tests.od_sealed(p_name text) returns text
language sql immutable as $$ select 'v1.' || substr(md5(p_name), 1, 16) || '.' || md5(p_name || ':ct') $$;

create function tests.od_ts(p_offset integer default 0) returns text
language sql stable as $$ select (floor(extract(epoch from now()))::bigint + p_offset)::text $$;

create function tests.od_sig(p_body text, p_ts text, p_secret text default 'test-secret') returns text
language sql stable as $$ select 'sha256=' || encode(extensions.hmac(p_ts || '.' || p_body, p_secret, 'sha256'), 'hex') $$;

-- A signed body, as n8n sends it, now or p_offset seconds away.
create function tests.od_claim(p_body jsonb, p_offset integer default 0) returns jsonb
language sql as $$
  select public.automation_claim(p_body::text, tests.od_ts(p_offset), tests.od_sig(p_body::text, tests.od_ts(p_offset)))
$$;

create function tests.od_claim_sql(p_body text, p_ts text, p_sig text) returns text
language sql as $$ select format('select public.automation_claim(%L, %L, %L)', p_body, p_ts, p_sig) $$;

create function tests.od_complete(p_body jsonb, p_results jsonb) returns void
language sql as $$
  select public.automation_complete(p_body::text, tests.od_ts(), tests.od_sig(p_body::text, tests.od_ts()), p_results)
$$;

-- The SQLSTATE a statement raises, or 'ok'.
create function tests.od_state(p_sql text) returns text
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return sqlstate;
  end;
  return 'ok';
end $$;

create function tests.od_secret(p_name text, p_value text) returns void
language plpgsql as $$
declare v uuid;
begin
  select id into v from vault.secrets where name = p_name;
  if p_value is null then
    delete from vault.secrets where id = v;
  elsif v is null then
    perform vault.create_secret(p_value, p_name);
  else
    perform vault.update_secret(v, p_value);
  end if;
end $$;

-- Requests queued for the test receiver.
create function tests.od_queue() returns bigint
language sql as $$ select count(*) from net.http_request_queue where url = 'https://n8n.test/webhook/events' $$;

-- Every due or in-flight row out of the way, so a run sees only the rows a check makes.
create function tests.od_quiet() returns void
language sql as $$ update public.outbox set status = 'failed' where status in ('pending', 'sending') $$;

-- An org A event and its outbox row <name>, pending and due p_minutes from now.
create function tests.od_row(p_name text, p_minutes integer default 0) returns uuid
language plpgsql as $$
begin
  insert into public.events (id, org_id, entity_type, entity_id, type, payload)
  values (tests.id(p_name || ':e'), tests.id('orgA'), 'agreement', tests.id('agrA'), 'agreement.sent', '{"from": "draft", "to": "sent"}');
  insert into public.outbox (id, org_id, event_id, available_at)
  values (tests.id(p_name), tests.id('orgA'), tests.id(p_name || ':e'), now() + make_interval(mins => p_minutes));
  return tests.id(p_name);
end $$;

create sequence tests.od_req;

-- An in-flight row <name> at p_attempts, dispatched p_minutes_ago, with a faked response unless p_respond is false.
create function tests.od_sending(p_name text, p_attempts integer, p_minutes_ago integer, p_status integer,
                                 p_timed_out boolean default false, p_error text default null, p_respond boolean default true)
returns uuid
language plpgsql as $$
declare v_req bigint := -nextval('tests.od_req');
begin
  perform tests.od_row(p_name);
  update public.outbox set status = 'sending', attempts = p_attempts, request_id = v_req,
         dispatched_at = now() - make_interval(mins => p_minutes_ago)
  where id = tests.id(p_name);
  if p_respond then
    insert into net._http_response (id, status_code, timed_out, error_msg) values (v_req, p_status, p_timed_out, p_error);
  end if;
  return tests.id(p_name);
end $$;

create function tests.od_out(p_name text) returns public.outbox
language sql as $$ select * from public.outbox where id = tests.id(p_name) $$;

-- A sent agreement <name> of org p_org on its own site, whose site contact has p_email (no contact when p_contact is
-- false), one line of 6 x $645.00 = $3,870.00 a year, sent by p_sender with a sealed token unless p_sealed is false.
create function tests.od_sent(p_name text, p_email text default 'pat@customer.ca', p_org text default 'A',
                              p_sender text default 'uE', p_contact boolean default true, p_sealed boolean default true)
returns uuid
language plpgsql as $$
begin
  if p_contact then
    insert into public.contacts (id, org_id, customer_id, name, email)
    values (tests.id(p_name || ':ct'), tests.id('org' || p_org), tests.id('cust' || p_org), 'Pat ' || p_name, p_email);
  end if;
  insert into public.sites (id, org_id, customer_id, site_contact_id, name)
  values (tests.id(p_name || ':site'), tests.id('org' || p_org), tests.id('cust' || p_org),
          case when p_contact then tests.id(p_name || ':ct') end, 'Harbour Plant ' || p_name);
  insert into public.agreements (id, org_id, site_id, number)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), 'AG-' || p_name);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1);
  insert into public.service_lines (org_id, agreement_version_id, description, visits_per_year, cost_per_visit_cents)
  values (tests.id('org' || p_org), tests.id(p_name || ':v1'), 'Preventive maintenance', 6, 64500);
  perform tests.act_as(p_sender);
  if p_sealed then
    perform public.send_agreement(tests.id(p_name), tests.od_hash(p_name), 'agreement.sent', '{"from": "draft", "to": "sent"}',
                                  tests.od_sealed(p_name));
  else
    perform public.send_agreement(tests.id(p_name), tests.od_hash(p_name), 'agreement.sent', '{"from": "draft", "to": "sent"}');
  end if;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return tests.od_event(p_name, 'agreement.sent');
end $$;

create function tests.od_event(p_name text, p_type text) returns uuid
language sql as $$
  select id from public.events where entity_id = tests.id(p_name) and type = p_type order by created_at desc, id limit 1
$$;

-- W1 and W3 bodies with the key formats of door 4.
create function tests.od_w1(p_name text, p_suffix text, p_exec text default 'exec-x') returns jsonb
language sql as $$
  select jsonb_build_object(
    'kind', case p_suffix when 'link' then 'customer_link' else 'customer_reminder' end,
    'idempotencyKey', 'w1:' || tests.od_event(p_name, 'agreement.sent') || ':' || p_suffix,
    'eventId', tests.od_event(p_name, 'agreement.sent'), 'agreementId', tests.id(p_name), 'executionId', p_exec)
$$;

create function tests.od_w3(p_name text, p_type text) returns jsonb
language sql as $$
  select jsonb_build_object('kind', 'staff_decision', 'idempotencyKey', 'w3:' || tests.od_event(p_name, p_type),
    'eventId', tests.od_event(p_name, p_type), 'agreementId', tests.id(p_name), 'executionId', 'exec-w3')
$$;

create function tests.od_w5(p_date text) returns jsonb
language sql as $$ select jsonb_build_object('kind', 'staff_stale', 'idempotencyKey', 'w5:' || p_date, 'executionId', 'exec-w5') $$;

create function tests.od_notif(p_key text) returns public.notifications
language sql as $$ select * from public.notifications where idempotency_key = p_key $$;

-- The one message of a claim result.
create function tests.od_msg(p_result jsonb) returns jsonb
language sql immutable as $$ select p_result -> 'messages' -> 0 $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Org A as a company would fill it, an admin uD, a second estimator uE2.
update public.org_settings set legal_name = 'Northwind Mechanical Ltd', phone = '604-555-0100', accent_color = '#1d4ed8'
where org_id = tests.id('orgA');
insert into auth.users (id, email, aud, role)
select tests.id(u), u || '@example.test', 'authenticated', 'authenticated' from unnest(array['uD', 'uE2']) as u;
insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgA'), tests.id('uD'), 'admin'),
  (tests.id('orgA'), tests.id('uE2'), 'estimator');

select tests.od_secret('n8n_events_url', 'https://n8n.test/webhook/events');
select tests.od_secret('automation_hmac_secret', 'test-secret');

-- C1001: one due row becomes one signed POST; a row due in 1 minute waits.
do $$
declare
  q0 bigint;
  q net.http_request_queue;
  body jsonb;
begin
  perform tests.od_quiet();
  q0 := tests.od_queue();
  perform tests.od_row('o1001');
  perform tests.od_row('o1001later', 1);
  perform private.dispatch_outbox();

  perform tests.ok('C1001 one request', tests.od_queue() = q0 + 1, 'queued ' || (tests.od_queue() - q0) || ' requests');
  select * into q from net.http_request_queue where id = (tests.od_out('o1001')).request_id;
  perform tests.ok('C1001 request', q.method = 'POST' and q.url = 'https://n8n.test/webhook/events'
    and q.headers ->> 'Content-Type' = 'application/json' and q.headers ? 'X-SA-Timestamp' and q.headers ? 'X-SA-Signature',
    'the queued request is not a signed JSON POST to the receiver: ' || coalesce(q.headers::text, 'none'));
  body := convert_from(q.body, 'UTF8')::jsonb;
  perform tests.ok('C1001 body keys',
    (select array_agg(k order by k) from jsonb_object_keys(body) k)
      = array['deliveryId', 'entityId', 'entityType', 'eventId', 'occurredAt', 'orgId', 'payload', 'type'],
    'body keys differ: ' || body::text);
  perform tests.ok('C1001 body values', body ->> 'eventId' = tests.id('o1001:e')::text and body ->> 'type' = 'agreement.sent',
    'eventId or type is not the event''s');
  perform tests.ok('C1001 sending', (tests.od_out('o1001')).status = 'sending' and (tests.od_out('o1001')).request_id = q.id,
    'the row is not sending with the queue row''s id');
  perform tests.ok('C1001 not due', (tests.od_out('o1001later')).status = 'pending' and (tests.od_out('o1001later')).request_id is null,
    'a row due in 1 minute was sent');

  -- C1002: the signature is over <timestamp>.<the queued bytes>.
  perform tests.ok('C1002 queued signature',
    q.headers ->> 'X-SA-Signature' = 'sha256=' || encode(extensions.hmac((q.headers ->> 'X-SA-Timestamp') || '.' || convert_from(q.body, 'UTF8'),
                                                                        'test-secret', 'sha256'), 'hex')
    and q.headers ->> 'X-SA-Timestamp' ~ '^[0-9]{10}$',
    'the signature does not match the queued body');
end $$;

-- C1002 (fixed vector): the same hex the Node test pins.
do $$ begin
  perform tests.ok('C1002 vector',
    encode(extensions.hmac('1700000000' || '.' || '{"a":1}', 'test-secret', 'sha256'), 'hex')
      = '8cb2c3355fca388e9ac2caec004f4d5d7045d74937ab5faad61dc11682247a9f', 'the vector differs');
end $$;

-- C1003: a 2xx answer makes the row sent; attempts are unchanged.
do $$
declare s integer;
begin
  perform tests.od_quiet();
  foreach s in array array[200, 204, 299] loop
    perform tests.od_row('o1003-' || s);
  end loop;
  perform private.dispatch_outbox();
  foreach s in array array[200, 204, 299] loop
    insert into net._http_response (id, status_code) values ((tests.od_out('o1003-' || s)).request_id, s);
  end loop;
  perform private.dispatch_outbox();
  foreach s in array array[200, 204, 299] loop
    perform tests.ok('C1003 ' || s, (tests.od_out('o1003-' || s)).status = 'sent' and (tests.od_out('o1003-' || s)).sent_at is not null
      and (tests.od_out('o1003-' || s)).attempts = 0, 'status ' || s || ' did not make the row sent');
  end loop;
end $$;

-- C1004: a non-2xx answer, a timeout, an error, or 10 minutes of silence put the row back with backoff.
do $$
declare
  r record;
  k integer;
  backoff integer[] := array[1, 5, 15, 60, 240, 720, 1440];
begin
  perform tests.od_quiet();
  perform tests.od_sending('o1004-300', 0, 1, 300);
  perform tests.od_sending('o1004-404', 0, 1, 404);
  perform tests.od_sending('o1004-500', 0, 1, 500);
  perform tests.od_sending('o1004-timeout', 0, 1, null, true);
  perform tests.od_sending('o1004-error', 0, 1, null, false, 'Couldn''t resolve host name');
  perform tests.od_sending('o1004-silent11', 0, 11, null, false, null, false);
  perform tests.od_sending('o1004-silent9', 0, 9, null, false, null, false);
  perform private.dispatch_outbox();
  for r in select unnest(array['300', '404', '500', 'timeout', 'error', 'silent11']) as n loop
    perform tests.ok('C1004 ' || r.n, (tests.od_out('o1004-' || r.n)).status = 'pending' and (tests.od_out('o1004-' || r.n)).attempts = 1
      and length((tests.od_out('o1004-' || r.n)).last_error) > 0, r.n || ' was not retried with an error');
  end loop;
  perform tests.ok('C1004 silent 9 minutes', (tests.od_out('o1004-silent9')).status = 'sending', 'a row 9 minutes in flight was given up');

  perform tests.od_quiet();
  for k in 1 .. 7 loop
    perform tests.od_sending('o1004-attempt' || k, k - 1, 1, 500);
  end loop;
  perform private.dispatch_outbox();
  for k in 1 .. 7 loop
    perform tests.ok('C1004 backoff ' || k, (tests.od_out('o1004-attempt' || k)).status = 'pending'
      and (tests.od_out('o1004-attempt' || k)).attempts = k
      and abs(extract(epoch from (tests.od_out('o1004-attempt' || k)).available_at - (now() + make_interval(mins => backoff[k])))) < 1,
      'attempt ' || k || ' is not due in ' || backoff[k] || ' minutes');
  end loop;
end $$;

-- C1005: the 8th failure is final.
do $$
declare q0 bigint;
begin
  perform tests.od_quiet();
  perform tests.od_sending('o1005', 7, 1, 500);
  perform private.dispatch_outbox();
  perform tests.ok('C1005 failed', (tests.od_out('o1005')).status = 'failed' and (tests.od_out('o1005')).attempts = 8, 'not failed at attempt 8');
  update public.outbox set available_at = now() - interval '1 day' where id = tests.id('o1005');
  q0 := tests.od_queue();
  perform private.dispatch_outbox();
  perform tests.ok('C1005 never again', tests.od_queue() = q0 and (tests.od_out('o1005')).status = 'failed', 'a failed row was sent again');
end $$;

-- C1006: a second run does not resend; a run takes at most 50.
do $$
declare
  q0 bigint;
  i integer;
  def text := pg_get_functiondef('private.dispatch_outbox()'::regprocedure);
begin
  perform tests.od_quiet();
  q0 := tests.od_queue();
  perform tests.od_row('o1006');
  perform private.dispatch_outbox();
  perform private.dispatch_outbox();
  perform tests.ok('C1006 twice', tests.od_queue() = q0 + 1, 'two runs queued ' || (tests.od_queue() - q0));

  perform tests.od_quiet();
  for i in 1 .. 51 loop
    perform tests.od_row('o1006-' || i);
  end loop;
  q0 := tests.od_queue();
  perform private.dispatch_outbox();
  perform tests.ok('C1006 batch 50', tests.od_queue() = q0 + 50, 'the first run queued ' || (tests.od_queue() - q0));
  perform private.dispatch_outbox();
  perform tests.ok('C1006 the 51st', tests.od_queue() = q0 + 51, 'the second run did not queue exactly the rest');
  perform tests.ok('C1006 locks', position('for update skip locked' in def) > 0
    and position('pg_try_advisory_xact_lock(hashtext(''outbox-dispatch''))' in def) > 0, 'the dispatcher does not lock as door 1 says');
end $$;

-- C1007: without either secret a run changes nothing and sends nothing.
do $$
declare
  s text;
  q0 bigint;
  before text;
begin
  foreach s in array array['n8n_events_url', 'automation_hmac_secret'] loop
    perform tests.od_quiet();
    perform tests.od_row('o1007-' || s);
    perform tests.od_sending('o1007-inflight-' || s, 0, 1, 500);
    perform tests.od_secret(s, null);
    q0 := tests.od_queue();
    before := (select string_agg(id || status || attempts || available_at, ',' order by id) from public.outbox);
    perform private.dispatch_outbox();
    perform tests.ok('C1007 ' || s, tests.od_queue() = q0
      and before = (select string_agg(id || status || attempts || available_at, ',' order by id) from public.outbox),
      'a run without ' || s || ' sent or changed something');
  end loop;
  perform tests.od_secret('n8n_events_url', 'https://n8n.test/webhook/events');
  perform tests.od_secret('automation_hmac_secret', 'test-secret');
end $$;

-- C1009: no user role reaches the dispatcher or the outbox.
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C1009 anon dispatch', 'select private.dispatch_outbox()', '42501');
  perform tests.expect_error('C1009 anon outbox', 'select * from public.outbox', '42501');
end $$;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1009 uE dispatch', 'select private.dispatch_outbox()', '42501');
  perform tests.expect_error('C1009 uE outbox', 'select * from public.outbox', '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1009 grants', not has_function_privilege('anon', 'private.dispatch_outbox()', 'execute')
    and not has_function_privilege('authenticated', 'private.dispatch_outbox()', 'execute'), 'a user role may run the dispatcher');
end $$;

-- C1042: the cron job, both extensions, the new status.
do $$ begin
  perform tests.ok('C1042 job', (select count(*) from cron.job where jobname = 'outbox-dispatch') = 1
    and exists (select 1 from cron.job where jobname = 'outbox-dispatch' and schedule = '* * * * *'
                and command = 'select private.dispatch_outbox()'), 'the cron job is not as door 1 says');
  perform tests.ok('C1042 extensions', (select count(*) from pg_extension where extname in ('pg_cron', 'pg_net')) = 2, 'an extension is missing');
  insert into public.events (id, org_id, entity_type, entity_id, type) values (tests.id('o1042:e'), tests.id('orgA'), 'agreement', tests.id('agrA'), 'agreement.sent');
  insert into public.events (id, org_id, entity_type, entity_id, type) values (tests.id('o1042q:e'), tests.id('orgA'), 'agreement', tests.id('agrA'), 'agreement.sent');
  insert into public.outbox (org_id, event_id, status) values (tests.id('orgA'), tests.id('o1042:e'), 'sending');
  perform tests.expect_error('C1042 queued',
    format('insert into public.outbox (org_id, event_id, status) values (%L, %L, ''queued'')', tests.id('orgA'), tests.id('o1042q:e')), '23514');
end $$;

-- The fixture agreement and the others the callback checks need.
select tests.od_sent('fa');

-- C1011: only a fresh signature with the secret passes; nothing is written before.
select tests.od_sent('f11');
do $$
declare
  b text := tests.od_w1('f11', 'link', 'exec-11')::text;
  n0 bigint := (select count(*) from public.notifications);
begin
  perform tests.expect_error('C1011 wrong secret', tests.od_claim_sql(b, tests.od_ts(), tests.od_sig(b, tests.od_ts(), 'wrong-secret')), '42501');
  perform tests.expect_error('C1011 body changed', tests.od_claim_sql(replace(b, 'exec-11', 'exec-12'), tests.od_ts(), tests.od_sig(b, tests.od_ts())), '42501');
  perform tests.expect_error('C1011 301 s past', tests.od_claim_sql(b, tests.od_ts(-301), tests.od_sig(b, tests.od_ts(-301))), '42501');
  perform tests.expect_error('C1011 301 s future', tests.od_claim_sql(b, tests.od_ts(301), tests.od_sig(b, tests.od_ts(301))), '42501');
  perform tests.ok('C1011 nothing written', (select count(*) from public.notifications) = n0
    and (select n8n_execution_id from public.events where id = tests.od_event('f11', 'agreement.sent')) is null, 'a refused callback wrote something');
  perform tests.ok('C1011 299 s past', tests.od_state(tests.od_claim_sql(b, tests.od_ts(-299), tests.od_sig(b, tests.od_ts(-299)))) = 'ok',
    'a 299 s old signature was refused');
end $$;

-- C1012: a malformed body is 22023 and writes nothing; the five key formats pass the format check.
select tests.od_sent('f12');
do $$
declare
  e text := tests.od_event('f12', 'agreement.sent');
  a text := tests.id('f12');
  b text;
  n0 bigint := (select count(*) from public.notifications);
  i integer := 0;
begin
  foreach b in array array[
    'not json',
    jsonb_build_object('kind', 'fax', 'idempotencyKey', 'w1:' || e || ':link', 'eventId', e, 'agreementId', a, 'executionId', 'exec-12')::text,
    jsonb_build_object('kind', 'customer_link', 'idempotencyKey', 'w1:' || e || ':link', 'agreementId', a, 'executionId', 'exec-12')::text,
    jsonb_build_object('kind', 'staff_decision', 'idempotencyKey', 'w3:' || e, 'agreementId', a, 'executionId', 'exec-12')::text,
    jsonb_build_object('kind', 'customer_link', 'eventId', e, 'agreementId', a, 'executionId', 'exec-12')::text,
    jsonb_build_object('kind', 'customer_link', 'idempotencyKey', 'w1:' || e || ':day3', 'eventId', e, 'agreementId', a, 'executionId', 'exec-12')::text]
  loop
    i := i + 1;
    perform tests.expect_error('C1012 body ' || i, tests.od_claim_sql(b, tests.od_ts(), tests.od_sig(b, tests.od_ts())), '22023');
  end loop;
  perform tests.ok('C1012 nothing written', (select count(*) from public.notifications) = n0
    and (select n8n_execution_id from public.events where id = e::uuid) is null, 'a malformed callback wrote something');

  b := 'not json';
  perform tests.expect_error('C1012 complete body',
    format('select public.automation_complete(%L, %L, %L, %L)', b, tests.od_ts(), tests.od_sig(b, tests.od_ts()), '[]'), '22023');
  b := tests.od_w1('f12', 'link')::text;
  perform tests.expect_error('C1012 complete results',
    format('select public.automation_complete(%L, %L, %L, %L)', b, tests.od_ts(), tests.od_sig(b, tests.od_ts()), '[{"id": "x", "outcome": "sent"}]'), '22023');

  foreach b in array array[
    tests.od_w1('f12', 'link')::text, tests.od_w1('f12', 'day3')::text, tests.od_w1('f12', 'day7')::text,
    jsonb_build_object('kind', 'staff_decision', 'idempotencyKey', 'w3:' || e, 'eventId', e, 'agreementId', a)::text,
    tests.od_w5('2026-01-01')::text]
  loop
    perform tests.ok('C1012 format ' || (b::jsonb ->> 'idempotencyKey'),
      tests.od_state(tests.od_claim_sql(b, tests.od_ts(), tests.od_sig(b, tests.od_ts()))) <> '22023', 'a valid key format was refused');
  end loop;
end $$;

-- C1013: the first verified callback names the execution; a later one does not overwrite it.
select tests.od_sent('f13');
do $$ begin
  perform tests.od_claim(tests.od_w1('f13', 'link', 'exec-1'));
  perform tests.ok('C1013 set', (select n8n_execution_id from public.events where id = tests.od_event('f13', 'agreement.sent')) = 'exec-1', 'exec-1 not stored');
  perform tests.od_claim(tests.od_w1('f13', 'day3', 'exec-2'));
  perform tests.ok('C1013 kept', (select n8n_execution_id from public.events where id = tests.od_event('f13', 'agreement.sent')) = 'exec-1', 'exec-1 was overwritten');
end $$;

-- C1014: a key that reached sent or skipped is a duplicate and changes nothing.
select tests.od_sent('f14');
select tests.od_sent('f14s', null);
do $$
declare
  r jsonb;
  before text;
begin
  r := tests.od_claim(tests.od_w1('f14', 'link'));
  perform tests.od_complete(tests.od_w1('f14', 'link'), jsonb_build_array(jsonb_build_object('id', tests.od_msg(r) ->> 'notificationId', 'outcome', 'sent', 'providerMessageId', 're_14')));
  before := to_jsonb(tests.od_notif(tests.od_w1('f14', 'link') ->> 'idempotencyKey'))::text;
  r := tests.od_claim(tests.od_w1('f14', 'link'));
  perform tests.ok('C1014 sent', r ->> 'decision' = 'duplicate' and jsonb_array_length(r -> 'messages') = 0
    and to_jsonb(tests.od_notif(tests.od_w1('f14', 'link') ->> 'idempotencyKey'))::text = before, 'a sent key was not a duplicate: ' || r::text);

  r := tests.od_claim(tests.od_w1('f14s', 'link'));
  perform tests.ok('C1014 setup skipped', r ->> 'decision' = 'skip', 'no skip to repeat');
  before := to_jsonb(tests.od_notif(tests.od_w1('f14s', 'link') ->> 'idempotencyKey'))::text;
  r := tests.od_claim(tests.od_w1('f14s', 'link'));
  perform tests.ok('C1014 skipped', r ->> 'decision' = 'duplicate' and jsonb_array_length(r -> 'messages') = 0
    and to_jsonb(tests.od_notif(tests.od_w1('f14s', 'link') ->> 'idempotencyKey'))::text = before, 'a skipped key was not a duplicate: ' || r::text);
end $$;

-- C1015: claimed holds a key for 10 minutes; an older claim or a failure may be claimed again.
select tests.od_sent('f15');
do $$
declare
  b jsonb := tests.od_w1('f15', 'link');
  k text := b ->> 'idempotencyKey';
begin
  perform tests.ok('C1015 first', tests.od_claim(b) ->> 'decision' = 'send', 'a new key was not sent');
  perform tests.ok('C1015 second', tests.od_claim(b) ->> 'decision' = 'in_flight', 'a second claim was not in flight');
  update public.notifications set claimed_at = now() - interval '9 minutes' where idempotency_key = k;
  perform tests.ok('C1015 9 minutes', tests.od_claim(b) ->> 'decision' = 'in_flight', 'a 9-minute claim was taken over');
  update public.notifications set claimed_at = now() - interval '11 minutes' where idempotency_key = k;
  perform tests.ok('C1015 11 minutes', tests.od_claim(b) ->> 'decision' = 'send'
    and (select count(*) from public.notifications where idempotency_key = k) = 1, 'an 11-minute claim was not taken over');
  update public.notifications set status = 'failed', error = 'provider down' where idempotency_key = k;
  perform tests.ok('C1015 failed', tests.od_claim(b) ->> 'decision' = 'send'
    and (select count(*) from public.notifications where idempotency_key = k) = 1 and (tests.od_notif(k)).status = 'claimed',
    'a failed key was not claimed again');
end $$;

-- C1017: an unknown event, or another org's event under this org's agreement, is P0002 and writes nothing.
select tests.od_sent('f17b', 'buyer@bluepeak.ca', 'B', 'uB');
do $$
declare
  x uuid := tests.id('no such event');
  e uuid := tests.od_event('f17b', 'agreement.sent');
  b text;
begin
  b := jsonb_build_object('kind', 'customer_link', 'idempotencyKey', 'w1:' || x || ':link', 'eventId', x, 'agreementId', tests.id('fa'), 'executionId', 'exec-17')::text;
  perform tests.expect_error('C1017 unknown', tests.od_claim_sql(b, tests.od_ts(), tests.od_sig(b, tests.od_ts())), 'P0002');
  b := jsonb_build_object('kind', 'customer_link', 'idempotencyKey', 'w1:' || e || ':link', 'eventId', e, 'agreementId', tests.id('fa'), 'executionId', 'exec-17')::text;
  perform tests.expect_error('C1017 other org', tests.od_claim_sql(b, tests.od_ts(), tests.od_sig(b, tests.od_ts())), 'P0002');
  perform tests.ok('C1017 nothing written', not exists (select 1 from public.notifications where idempotency_key in ('w1:' || x || ':link', 'w1:' || e || ':link'))
    and (select n8n_execution_id from public.events where id = e) is null, 'an unknown event wrote something');
end $$;

-- C1019, C1025, C1026: the link email's data for the fixture agreement.
do $$
declare
  r jsonb := tests.od_claim(tests.od_w1('fa', 'link'));
  m jsonb := tests.od_msg(r);
begin
  perform tests.ok('C1019 decision', r ->> 'decision' = 'send' and jsonb_array_length(r -> 'messages') = 1, 'not 1 message to send: ' || r::text);
  perform tests.ok('C1019 to', m -> 'to' = '["pat@customer.ca"]'::jsonb, 'to is ' || coalesce(m ->> 'to', 'missing'));
  perform tests.ok('C1019 tenant', m -> 'tenant' ->> 'legalName' = 'Northwind Mechanical Ltd' and m -> 'tenant' ->> 'phone' = '604-555-0100',
    'tenant differs: ' || coalesce(m ->> 'tenant', 'missing'));
  perform tests.ok('C1019 agreement', m -> 'agreement' ->> 'number' = 'AG-fa' and m -> 'agreement' ->> 'id' = tests.id('fa')::text
    and m -> 'site' ->> 'name' = 'Harbour Plant fa' and (m ->> 'annualCents')::bigint = 387000, 'agreement facts differ: ' || m::text);
  perform tests.ok('C1019 token', m ->> 'tokenSealed' = tests.od_sealed('fa'), 'not the live link''s sealed token');
  perform tests.ok('C1019 stored', (tests.od_notif(tests.od_w1('fa', 'link') ->> 'idempotencyKey')).status = 'claimed'
    and (tests.od_notif(tests.od_w1('fa', 'link') ->> 'idempotencyKey')).recipients = array['pat@customer.ca']
    and (m ->> 'notificationId')::uuid = (tests.od_notif(tests.od_w1('fa', 'link') ->> 'idempotencyKey')).id, 'the claim is not stored');
  perform tests.ok('C1025 replyTo', m ->> 'replyTo' = (select email from auth.users where id = tests.id('uE')), 'replyTo is not the sender''s email');
  perform tests.ok('C1026 stored sealed', (select token_sealed from public.portal_links l join public.agreement_versions v on v.id = l.agreement_version_id
    where v.agreement_id = tests.id('fa') and l.revoked_at is null) = tests.od_sealed('fa'), 'send_agreement did not store the sealed token');
end $$;

-- C1025 (no actor): no replyTo.
select tests.od_sent('f25');
update public.events set actor_id = null where id = tests.od_event('f25', 'agreement.sent');
do $$
declare m jsonb := tests.od_msg(tests.od_claim(tests.od_w1('f25', 'link')));
begin
  perform tests.ok('C1025 no actor', m is not null and not m ? 'replyTo', 'replyTo present without an actor: ' || coalesce(m::text, 'no message'));
end $$;

-- C1020: day3 and day7 carry the same facts; after a reissue the reminder carries the new link.
select tests.od_sent('f20');
do $$
declare
  m jsonb;
begin
  m := tests.od_msg(tests.od_claim(tests.od_w1('f20', 'day3')));
  perform tests.ok('C1020 day3', m ->> 'kind' = 'customer_reminder' and m ->> 'reminder' = 'day3' and m -> 'to' = '["pat@customer.ca"]'::jsonb
    and m -> 'tenant' ->> 'legalName' = 'Northwind Mechanical Ltd' and (m ->> 'annualCents')::bigint = 387000
    and m -> 'site' ->> 'name' = 'Harbour Plant f20' and m ->> 'tokenSealed' = tests.od_sealed('f20'), 'day3 differs: ' || coalesce(m::text, 'none'));
  perform tests.act_as('uE');
  perform public.reissue_portal_link(tests.id('f20'), tests.od_hash('f20-new'), tests.od_sealed('f20-new'));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  m := tests.od_msg(tests.od_claim(tests.od_w1('f20', 'day7')));
  perform tests.ok('C1020 day7', m ->> 'reminder' = 'day7' and m -> 'to' = '["pat@customer.ca"]'::jsonb and (m ->> 'annualCents')::bigint = 387000
    and m ->> 'tokenSealed' = tests.od_sealed('f20-new'), 'day7 does not carry the new link: ' || coalesce(m::text, 'none'));
end $$;

-- C1021: a reminder is skipped once decided, superseded or viewed.
select tests.od_sent(n) from unnest(array['f21accepted', 'f21refused', 'f21changes_requested', 'f21withdrawn', 'f21sup', 'f21view']) n;
update public.agreements set status = substr(number, length('AG-f21') + 1)
where id in (tests.id('f21accepted'), tests.id('f21refused'), tests.id('f21changes_requested'), tests.id('f21withdrawn'));
insert into public.agreement_versions (org_id, agreement_id, version_no, created_at)
values (tests.id('orgA'), tests.id('f21sup'), 2, now() + interval '1 minute');
update public.portal_links set first_viewed_at = now()
where agreement_version_id = tests.id('f21view:v1') and revoked_at is null;
do $$
declare
  r jsonb;
  c record;
begin
  for c in select * from (values ('f21accepted', 'decided'), ('f21refused', 'decided'), ('f21changes_requested', 'decided'),
                                 ('f21withdrawn', 'decided'), ('f21sup', 'superseded'), ('f21view', 'viewed')) v(n, reason) loop
    r := tests.od_claim(tests.od_w1(c.n, 'day3'));
    perform tests.ok('C1021 ' || c.n, r ->> 'decision' = 'skip' and r ->> 'reason' = c.reason and jsonb_array_length(r -> 'messages') = 0
      and (tests.od_notif(tests.od_w1(c.n, 'day3') ->> 'idempotencyKey')).status = 'skipped'
      and (tests.od_notif(tests.od_w1(c.n, 'day3') ->> 'idempotencyKey')).skip_reason = c.reason,
      c.n || ' was not skipped as ' || c.reason || ': ' || r::text);
  end loop;
end $$;

-- C1022: no site contact, or a contact without email.
select tests.od_sent('f22none', null, 'A', 'uE', false);
select tests.od_sent('f22null', null);
do $$
declare
  n text;
  r jsonb;
begin
  foreach n in array array['f22none', 'f22null'] loop
    r := tests.od_claim(tests.od_w1(n, 'link'));
    perform tests.ok('C1022 ' || n, r ->> 'decision' = 'skip' and r ->> 'reason' = 'no_recipient'
      and (tests.od_notif(tests.od_w1(n, 'link') ->> 'idempotencyKey')).skip_reason = 'no_recipient', n || ': ' || r::text);
  end loop;
end $$;

-- C1023: no live link, or a live link without a sealed token.
select tests.od_sent('f23revoked');
update public.portal_links set revoked_at = now() where agreement_version_id = tests.id('f23revoked:v1');
select tests.od_sent('f23unsealed', 'pat@customer.ca', 'A', 'uE', true, false);
do $$
declare
  n text;
  r jsonb;
begin
  foreach n in array array['f23revoked', 'f23unsealed'] loop
    r := tests.od_claim(tests.od_w1(n, 'link'));
    perform tests.ok('C1023 ' || n, r ->> 'decision' = 'skip' and r ->> 'reason' = 'no_link_secret'
      and (tests.od_notif(tests.od_w1(n, 'link') ->> 'idempotencyKey')).skip_reason = 'no_link_secret', n || ': ' || r::text);
  end loop;
end $$;

-- C1027: the sender hears about a refusal or a change request, with the reason.
select tests.od_sent('f27r');
select tests.od_sent('f27c');
select tests.act_as_anon();
select public.portal_decide(tests.od_hash('f27r'), 'refused', 'agreement.refused', '{"reason": "Too expensive"}');
select public.portal_decide(tests.od_hash('f27c'), 'changes_requested', 'agreement.changes_requested', '{"reason": "Add the boiler"}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  c record;
  r jsonb;
  m jsonb;
begin
  for c in select * from (values ('f27r', 'agreement.refused', 'refused', 'Too expensive'),
                                 ('f27c', 'agreement.changes_requested', 'changes_requested', 'Add the boiler')) v(n, t, d, reason) loop
    r := tests.od_claim(tests.od_w3(c.n, c.t));
    m := tests.od_msg(r);
    perform tests.ok('C1027 ' || c.d, r ->> 'decision' = 'send' and jsonb_array_length(r -> 'messages') = 1
      and m -> 'to' = jsonb_build_array((select email from auth.users where id = tests.id('uE')))
      and m -> 'customer' ->> 'name' = 'Customer A' and m -> 'agreement' ->> 'number' = 'AG-' || c.n
      and m -> 'agreement' ->> 'id' = tests.id(c.n)::text and m ->> 'decision' = c.d and m ->> 'reason' = c.reason,
      c.d || ' message differs: ' || r::text);
  end loop;
end $$;

-- C1028: with no sender, or a sender who left, the org's owners and admins hear instead.
select tests.od_sent('f28null');
select tests.od_sent('f28gone', 'pat@customer.ca', 'A', 'uE2');
update public.events set actor_id = null where id = tests.od_event('f28null', 'agreement.sent');
select tests.act_as_anon();
select public.portal_decide(tests.od_hash('f28null'), 'refused', 'agreement.refused', '{"reason": "No budget"}');
select public.portal_decide(tests.od_hash('f28gone'), 'refused', 'agreement.refused', '{"reason": "No budget"}');
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.memberships where org_id = tests.id('orgA') and user_id = tests.id('uE2');
do $$
declare
  n text;
  r jsonb;
  recipients text[];
begin
  foreach n in array array['f28null', 'f28gone'] loop
    r := tests.od_claim(tests.od_w3(n, 'agreement.refused'));
    select array_agg(t order by t) into recipients from jsonb_array_elements(r -> 'messages') m, jsonb_array_elements_text(m -> 'to') t;
    perform tests.ok('C1028 ' || n, r ->> 'decision' = 'send'
      and recipients = (select array_agg(email::text order by email) from auth.users where id in (tests.id('uA'), tests.id('uD'))),
      n || ' did not go to exactly the owner and admin: ' || r::text);
  end loop;
end $$;

-- C1029-C1031: the daily digest of agreements unviewed 7 days after they were sent.
select tests.od_sent(n) from unnest(array['w5stale1', 'w5stale2', 'w5recent', 'w5viewed', 'w5accepted']) n;
update public.events set created_at = now() - interval '8 days'
where type = 'agreement.sent' and entity_id in (tests.id('w5stale1'), tests.id('w5stale2'), tests.id('w5viewed'), tests.id('w5accepted'));
update public.events set created_at = now() - interval '6 days' where type = 'agreement.sent' and entity_id = tests.id('w5recent');
update public.portal_links set first_viewed_at = now() - interval '7 days' where agreement_version_id = tests.id('w5viewed:v1');
update public.agreements set status = 'accepted' where id = tests.id('w5accepted');
do $$
declare
  r jsonb := tests.od_claim(tests.od_w5('2026-10-29'));
  a jsonb := (select jsonb_agg(m) from jsonb_array_elements(r -> 'messages') m where m ->> 'orgId' = tests.id('orgA')::text);
  m jsonb := a -> 0;
  k text := 'w5:2026-10-29:' || tests.id('orgA');
begin
  perform tests.ok('C1029 one message', r ->> 'decision' = 'send' and jsonb_array_length(a) = 1, 'not 1 message for org A: ' || r::text);
  perform tests.ok('C1029 to', m -> 'to' = (select jsonb_agg(email order by email) from auth.users where id in (tests.id('uA'), tests.id('uD'))),
    'not addressed to the owner and admin: ' || (m -> 'to')::text);
  perform tests.ok('C1029 agreements', (select array_agg(x ->> 'id' order by x ->> 'number') from jsonb_array_elements(m -> 'agreements') x)
      = array[tests.id('w5stale1')::text, tests.id('w5stale2')::text]
    and (select bool_and(x ->> 'number' like 'AG-w5stale_' and x ->> 'customerName' = 'Customer A' and (x ->> 'sentAt')::timestamptz = now() - interval '8 days')
         from jsonb_array_elements(m -> 'agreements') x), 'the listed agreements differ: ' || (m -> 'agreements')::text);
  perform tests.ok('C1029 stored', (select count(*) from public.notifications where idempotency_key = k) = 1
    and (m ->> 'notificationId')::uuid = (tests.od_notif(k)).id and (tests.od_notif(k)).kind = 'staff_stale', 'not 1 notification ' || k);
  -- C1030: org B has no stale agreement: no message, no row.
  perform tests.ok('C1030 org B', not exists (select 1 from jsonb_array_elements(r -> 'messages') x where x ->> 'orgId' = tests.id('orgB')::text)
    and not exists (select 1 from public.notifications where idempotency_key = 'w5:2026-10-29:' || tests.id('orgB')), 'org B got something');

  perform tests.od_complete(tests.od_w5('2026-10-29'), jsonb_build_array(jsonb_build_object('id', m ->> 'notificationId', 'outcome', 'sent', 'providerMessageId', 're_w5')));
end $$;

-- C1031: one digest per org and date.
do $$
declare
  n0 bigint := (select count(*) from public.notifications);
  r jsonb := tests.od_claim(tests.od_w5('2026-10-29'));
begin
  perform tests.ok('C1031 same day', not exists (select 1 from jsonb_array_elements(r -> 'messages') x where x ->> 'orgId' = tests.id('orgA')::text)
    and (select count(*) from public.notifications) = n0, 'a second digest the same day: ' || r::text);
  r := tests.od_claim(tests.od_w5('2026-10-30'));
  perform tests.ok('C1031 next day', exists (select 1 from jsonb_array_elements(r -> 'messages') x where x ->> 'orgId' = tests.id('orgA')::text),
    'no digest the next day: ' || r::text);
end $$;

-- C1036: notifications (door 4).
do $$
declare k text := 'w3:' || gen_random_uuid();
begin
  insert into public.notifications (org_id, idempotency_key, kind) values (tests.id('orgA'), k, 'staff_decision');
  perform tests.expect_error('C1036 unique key',
    format('insert into public.notifications (org_id, idempotency_key, kind) values (%L, %L, ''staff_decision'')', tests.id('orgA'), k), '23505');
  insert into public.notifications (org_id, idempotency_key, kind)
  select tests.id('orgA'), 'c1036-kind-' || x, x from unnest(array['customer_link', 'customer_reminder', 'staff_decision', 'staff_stale']) x;
  perform tests.expect_error('C1036 kind',
    format('insert into public.notifications (org_id, idempotency_key, kind) values (%L, ''c1036-sms'', ''sms'')', tests.id('orgA')), '23514');
  insert into public.notifications (org_id, idempotency_key, kind, status, skip_reason) values
    (tests.id('orgA'), 'c1036-claimed', 'staff_stale', 'claimed', null),
    (tests.id('orgA'), 'c1036-sent', 'staff_stale', 'sent', null),
    (tests.id('orgA'), 'c1036-skipped', 'staff_stale', 'skipped', 'viewed'),
    (tests.id('orgA'), 'c1036-failed', 'staff_stale', 'failed', null);
  perform tests.expect_error('C1036 status',
    format('insert into public.notifications (org_id, idempotency_key, kind, status) values (%L, ''c1036-q'', ''staff_stale'', ''queued'')', tests.id('orgA')), '23514');
  perform tests.expect_error('C1036 skipped without reason',
    format('insert into public.notifications (org_id, idempotency_key, kind, status) values (%L, ''c1036-s1'', ''staff_stale'', ''skipped'')', tests.id('orgA')), '23514');
  perform tests.expect_error('C1036 sent with reason',
    format('insert into public.notifications (org_id, idempotency_key, kind, status, skip_reason) values (%L, ''c1036-s2'', ''staff_stale'', ''sent'', ''viewed'')', tests.id('orgA')), '23514');
  perform tests.expect_error('C1036 cross-org agreement',
    format('insert into public.notifications (org_id, idempotency_key, kind, agreement_id) values (%L, ''c1036-x'', ''customer_link'', %L)', tests.id('orgA'), tests.id('agrB')), '23503');
  insert into public.notifications (org_id, idempotency_key, kind) values (tests.id('orgB'), 'c1036-b', 'staff_stale');
end $$;
select tests.act_as('uA');
do $$ begin
  perform tests.ok('C1036 uA reads A only', (select count(*) from public.notifications) > 0
    and not exists (select 1 from public.notifications where org_id <> tests.id('orgA')), 'uA reads another org''s notifications');
end $$;
select tests.act_as('uB');
do $$ begin
  perform tests.ok('C1036 uB reads B only', (select count(*) from public.notifications) > 0
    and not exists (select 1 from public.notifications where org_id <> tests.id('orgB')), 'uB reads another org''s notifications');
end $$;
select tests.act_as_anon();
do $$ begin
  perform tests.ok('C1036 anon reads none', (select count(*) from public.notifications) = 0, 'anon reads notifications');
end $$;
do $$
declare u text;
begin
  foreach u in array array['uE', 'uA'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C1036 ' || u || ' insert',
      format('insert into public.notifications (org_id, idempotency_key, kind) values (%L, ''c1036-%s'', ''staff_stale'')', tests.id('orgA'), u), '42501');
    perform tests.expect_error('C1036 ' || u || ' update', 'update public.notifications set status = ''sent''', '42501');
    perform tests.expect_error('C1036 ' || u || ' delete', 'delete from public.notifications', '42501');
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- C1037: token_sealed's format; the old signatures still store null.
select tests.od_sent('f37');
do $$ begin
  perform tests.expect_error('C1037 plain token',
    format('update public.portal_links set token_sealed = ''plain-token'' where agreement_version_id = %L', tests.id('f37:v1')), '23514');
  perform tests.ok('C1037 format accepted', tests.od_state(
    format('update public.portal_links set token_sealed = %L where agreement_version_id = %L', tests.od_sealed('f37x'), tests.id('f37:v1'))) = 'ok',
    'a sealed value was refused');
  perform tests.ok('C1037 send without sealed', (select token_sealed from public.portal_links where agreement_version_id = tests.id('f23unsealed:v1')) is null
    and (select count(*) from public.portal_links where agreement_version_id = tests.id('f23unsealed:v1')) = 1,
    'send_agreement without p_token_sealed did not store null');
  perform tests.act_as('uE');
  perform public.reissue_portal_link(tests.id('f37'), tests.od_hash('f37-new'));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform tests.ok('C1037 reissue without sealed', (select token_sealed from public.portal_links
    where agreement_version_id = tests.id('f37:v1') and revoked_at is null) is null, 'reissue_portal_link without p_token_sealed did not store null');
end $$;

-- C1040: both callbacks are definers with an empty search_path, open to anon and authenticated, closed to public.
do $$
declare
  f text;
  o oid;
begin
  foreach f in array array['public.automation_claim(text, text, text)', 'public.automation_complete(text, text, text, jsonb)'] loop
    o := f::regprocedure;
    perform tests.ok('C1040 ' || f, (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = o)
      and has_function_privilege('anon', o, 'execute') and has_function_privilege('authenticated', o, 'execute')
      and not has_function_privilege('public', o, 'execute'), f || ' is not as door 3 says');
  end loop;
end $$;
select tests.od_sent('f40');
do $$
declare
  b jsonb := tests.od_w1('f40', 'link');
  r jsonb;
begin
  perform tests.act_as_anon();
  r := tests.od_claim(b);
  perform tests.od_complete(b, jsonb_build_array(jsonb_build_object('id', tests.od_msg(r) ->> 'notificationId', 'outcome', 'sent', 'providerMessageId', 're_40')));
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform tests.ok('C1040 anon claim', r ->> 'decision' = 'send', 'anon could not claim: ' || r::text);
  perform tests.ok('C1040 anon complete', (tests.od_notif(b ->> 'idempotencyKey')).status = 'sent', 'anon could not complete');
end $$;

-- C1043: complete records sent or failed, refuses another key's id and a wrong signature.
select tests.od_sent('f43');
select tests.od_sent('f43f');
do $$
declare
  b jsonb := tests.od_w1('f43', 'link');
  nid text := tests.od_msg(tests.od_claim(b)) ->> 'notificationId';
  bf jsonb := tests.od_w1('f43f', 'link');
  idf text := tests.od_msg(tests.od_claim(bf)) ->> 'notificationId';
  other text := (tests.od_notif(tests.od_w1('fa', 'link') ->> 'idempotencyKey')).id;
  before text;
begin
  before := (select string_agg(to_jsonb(n)::text, ',' order by n.id) from public.notifications n);
  perform tests.expect_error('C1043 other key', format('select public.automation_complete(%L, %L, %L, %L)', b::text, tests.od_ts(),
    tests.od_sig(b::text, tests.od_ts()), jsonb_build_array(jsonb_build_object('id', other, 'outcome', 'sent', 'providerMessageId', 're_x'))), 'P0002');
  perform tests.expect_error('C1043 unknown id', format('select public.automation_complete(%L, %L, %L, %L)', b::text, tests.od_ts(),
    tests.od_sig(b::text, tests.od_ts()), jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'outcome', 'sent'))), 'P0002');
  perform tests.expect_error('C1043 wrong signature', format('select public.automation_complete(%L, %L, %L, %L)', b::text, tests.od_ts(),
    tests.od_sig(b::text, tests.od_ts(), 'wrong-secret'), jsonb_build_array(jsonb_build_object('id', nid, 'outcome', 'sent'))), '42501');
  perform tests.ok('C1043 nothing changed', before = (select string_agg(to_jsonb(n)::text, ',' order by n.id) from public.notifications n),
    'a refused complete changed a notification');

  perform tests.od_complete(b, jsonb_build_array(jsonb_build_object('id', nid, 'outcome', 'sent', 'providerMessageId', 're_1')));
  perform tests.ok('C1043 sent', (tests.od_notif(b ->> 'idempotencyKey')).status = 'sent'
    and (tests.od_notif(b ->> 'idempotencyKey')).provider_message_id = 're_1' and (tests.od_notif(b ->> 'idempotencyKey')).sent_at is not null,
    'not sent with re_1');
  perform tests.od_complete(bf, jsonb_build_array(jsonb_build_object('id', idf, 'outcome', 'failed', 'error', 'provider down')));
  perform tests.ok('C1043 failed', (tests.od_notif(bf ->> 'idempotencyKey')).status = 'failed'
    and (tests.od_notif(bf ->> 'idempotencyKey')).error = 'provider down', 'not failed with the error');
end $$;

rollback;
select 'outbox_dispatch: pass' as result;
