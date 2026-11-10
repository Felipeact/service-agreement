-- first-login-setup, database side: C2803, C2804, C2811, C2813, C2814 (.specs/features/first-login-setup/checks.md).
-- Run after fixture.sql and the migration in the same execute_sql call (npm run test:db first_login_setup): the recipe puts
-- 20261110110000_first_login_setup.sql between them, inside the rolled-back transaction, so the hosted project needs no change.
-- Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB. The fixture's org_settings rows exist before the migration.
-- The Vault secret is made inside the rolled-back transaction; no real Stripe secret is used.

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.fl_secret() returns void
language plpgsql as $$
begin
  delete from vault.secrets where name = 'stripe_webhook_secret';
  perform vault.create_secret('whsec_fl', 'stripe_webhook_secret');
end $$;

create function tests.fl_post(p_body text) returns jsonb
language sql as $$
  select public.stripe_receive_event(p_body,
    't=' || floor(extract(epoch from now()))::bigint || ',v1='
    || encode(extensions.hmac(floor(extract(epoch from now()))::bigint || '.' || p_body, 'whsec_fl', 'sha256'), 'hex'))
$$;

select tests.fl_secret();
grant execute on all functions in schema tests to anon, authenticated;

-- C2803: a paid sign-up starts with setup pending.
do $$
declare
  v_body text := jsonb_build_object('id', 'evt_fl_1', 'type', 'checkout.session.completed', 'data', jsonb_build_object('object',
    jsonb_build_object('mode', 'subscription', 'customer', 'cus_fl_1', 'subscription', 'sub_fl_1',
      'customer_details', jsonb_build_object('email', 'owner@fl.test'),
      'metadata', jsonb_build_object('plan', 'team', 'trades', 'plumbing', 'seats', '5', 'company', 'Flow Plumbing', 'phone', '604-555-0123'))))::text;
  v_org uuid;
begin
  perform tests.act_as_anon();
  perform tests.fl_post(v_body);
  reset role;
  v_org := (select org_id from public.org_billing where stripe_subscription_id = 'sub_fl_1');
  perform tests.ok('C2803 provisioned', v_org is not null, 'no org was provisioned');
  perform tests.ok('C2803 pending', (select setup_completed_at from public.org_settings where org_id = v_org) is null
    and exists (select 1 from public.org_settings where org_id = v_org and legal_name = 'Flow Plumbing'), 'setup_completed_at is not null');
end $$;

-- C2804: rows that existed before the migration, and a row inserted with no value, are done.
do $$
begin
  perform tests.ok('C2804 fixture rows', (select count(*) from public.org_settings where org_id in (tests.id('orgA'), tests.id('orgB'))
    and setup_completed_at is not null) = 2, 'a fixture org is pending');
  insert into public.orgs (id, name) values (tests.id('orgFL'), 'Hand seeded');
  insert into public.org_settings (org_id, legal_name) values (tests.id('orgFL'), 'Hand seeded');
  perform tests.ok('C2804 default', (select setup_completed_at from public.org_settings where org_id = tests.id('orgFL'))
    between now() - interval '1 minute' and now() + interval '1 minute', 'a row inserted with no value is not stamped near now()');
end $$;

-- C2814: the shape of the column.
do $$
begin
  perform tests.ok('C2814 type', (select data_type from information_schema.columns where table_schema = 'public'
    and table_name = 'org_settings' and column_name = 'setup_completed_at') = 'timestamp with time zone', 'not timestamptz');
  perform tests.ok('C2814 nullable', (select is_nullable from information_schema.columns where table_schema = 'public'
    and table_name = 'org_settings' and column_name = 'setup_completed_at') = 'YES', 'not nullable');
  perform tests.ok('C2814 default', (select column_default from information_schema.columns where table_schema = 'public'
    and table_name = 'org_settings' and column_name = 'setup_completed_at') = 'now()', 'default is not now()');
  update public.org_settings set setup_completed_at = null where org_id = tests.id('orgA');
end $$;

-- C2814: the owner stamps through the existing update policy; C2811: an estimator's and a viewer's update changes no row.
do $$
declare n integer;
begin
  perform tests.act_as('uE');
  update public.org_settings set legal_name = 'Hijack', setup_completed_at = now() where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2811 estimator changes no row', n = 0, 'rows changed: ' || n);
  perform tests.act_as('uV');
  update public.org_settings set setup_completed_at = now() where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2814 viewer cannot stamp', n = 0, 'rows changed: ' || n);
  reset role;
  perform tests.ok('C2811 still pending', (select setup_completed_at from public.org_settings where org_id = tests.id('orgA')) is null
    and (select legal_name from public.org_settings where org_id = tests.id('orgA')) = 'Legal A', 'the row changed');
  perform tests.act_as('uA');
  update public.org_settings set setup_completed_at = now() where org_id = tests.id('orgA') and setup_completed_at is null;
  get diagnostics n = row_count;
  perform tests.ok('C2814 owner stamps', n = 1, 'the owner could not stamp, rows ' || n);
end $$;

reset role;
update public.org_settings set setup_completed_at = null where org_id = tests.id('orgA');

-- C2813: the stamp statement the adapter sends keeps the first value.
do $$
declare
  v_first timestamptz;
  n integer;
begin
  perform tests.act_as('uA');
  update public.org_settings set setup_completed_at = timestamptz '2026-01-02 03:04:05+00' where org_id = tests.id('orgA') and setup_completed_at is null;
  get diagnostics n = row_count;
  perform tests.ok('C2813 first stamp', n = 1, 'rows ' || n);
  v_first := (select setup_completed_at from public.org_settings where org_id = tests.id('orgA'));
  update public.org_settings set setup_completed_at = timestamptz '2026-06-06 06:06:06+00' where org_id = tests.id('orgA') and setup_completed_at is null;
  get diagnostics n = row_count;
  perform tests.ok('C2813 second stamp changes nothing', n = 0 and (select setup_completed_at from public.org_settings where org_id = tests.id('orgA')) = v_first,
    'the first value was replaced');
end $$;

rollback;
select 'first_login_setup: pass' as result;
