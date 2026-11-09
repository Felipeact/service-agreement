-- workspace-provisioning, database side: C2700-C2717, C2722-C2728 and the SQL halves of C2710 and C2711
-- (.specs/features/workspace-provisioning/checks.md).
-- Run after fixture.sql and the migration in the same execute_sql call (npm run test:db workspace_provisioning): the recipe puts
-- 20261110100000_workspace_provisioning.sql between them, inside the rolled-back transaction, so the hosted project needs no change.
-- Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB; uX in no org. Setup runs as the table owner.
-- The Vault secret is made inside the rolled-back transaction; no real Stripe secret is used.

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.wp_secret() returns void
language plpgsql as $$
begin
  delete from vault.secrets where name = 'stripe_webhook_secret';
  perform vault.create_secret('whsec_wp', 'stripe_webhook_secret');
end $$;

create function tests.wp_header(p_body text) returns text
language sql as $$
  select 't=' || floor(extract(epoch from now()))::bigint || ',v1='
    || encode(extensions.hmac(floor(extract(epoch from now()))::bigint || '.' || p_body, 'whsec_wp', 'sha256'), 'hex')
$$;

-- The checkout session of a valid Team purchase, with p_meta merged over the metadata and p_top over the session; a null
-- value removes the key.
create function tests.wp_session(p_sub text, p_email text, p_meta jsonb default '{}', p_top jsonb default '{}')
returns jsonb
language sql as $$
  select jsonb_strip_nulls(
    jsonb_build_object('mode', 'subscription', 'customer', 'cus_' || p_sub, 'subscription', p_sub,
                       'customer_details', jsonb_build_object('email', p_email),
                       'metadata', jsonb_build_object('plan', 'team', 'trades', 'hvac', 'seats', '5',
                                                      'company', 'Shop ' || p_sub, 'phone', '604-555-0199') || p_meta)
    || p_top)
$$;

create function tests.wp_body(p_event text, p_session jsonb, p_type text default 'checkout.session.completed') returns text
language sql as $$
  select jsonb_build_object('id', p_event, 'type', p_type, 'data', jsonb_build_object('object', p_session))::text
$$;

create function tests.wp_post(p_body text) returns jsonb
language sql as $$ select public.stripe_receive_event(p_body, tests.wp_header(p_body)) $$;

-- Delivers a valid purchase n (event evt_wp_<n>, subscription sub_wp_<n>, email wp_<n>@shop.test) and returns the answer.
create function tests.wp_buy(p_n text, p_meta jsonb default '{}', p_email text default null) returns jsonb
language sql as $$
  select tests.wp_post(tests.wp_body('evt_wp_' || p_n,
    tests.wp_session('sub_wp_' || p_n, coalesce(p_email, 'wp_' || p_n || '@shop.test'), p_meta)))
$$;

create function tests.wp_org(p_n text) returns uuid
language sql security definer set search_path = '' as $$ select org_id from public.org_billing where stripe_subscription_id = 'sub_wp_' || p_n $$;

-- Delivers body p_body and requires the answer {"outcome": p_outcome} exactly, the stored code p_code, no processed_at, and no
-- org, settings, billing, invitation or type left by the attempt (company p_company, email p_email).
create function tests.wp_refused(p_label text, p_event text, p_body text, p_code text, p_company text, p_email text,
                                 p_outcome text default 'recorded') returns void
language plpgsql as $$
declare
  v_types bigint := (select count(*) from public.asset_types);
  v_answer jsonb := tests.wp_post(p_body);
begin
  perform tests.ok(p_label || ' answer', v_answer = jsonb_build_object('outcome', p_outcome), 'answer was ' || v_answer::text);
  perform tests.ok(p_label || ' code', (select process_error from private.stripe_events where id = p_event) = p_code,
    'process_error was ' || coalesce((select process_error from private.stripe_events where id = p_event), 'null'));
  perform tests.ok(p_label || ' unprocessed', (select processed_at from private.stripe_events where id = p_event) is null, 'processed_at is set');
  perform tests.ok(p_label || ' no org', not exists (select 1 from public.orgs where name = p_company)
    and not exists (select 1 from public.org_settings where legal_name = p_company), 'an org or settings row was left');
  perform tests.ok(p_label || ' no invitation', not exists (select 1 from public.invitations where email = p_email and org_id in
    (select id from public.orgs where name = p_company)), 'an invitation was left');
  perform tests.ok(p_label || ' no types', (select count(*) from public.asset_types) = v_types, 'asset types were left');
end $$;

select tests.wp_secret();
grant execute on all functions in schema tests to anon, authenticated;

-- C2700, C2703, C2704, C2711: a valid Team purchase of hvac.
do $$
declare
  v_answer jsonb;
  v_org uuid;
  v_body text := tests.wp_body('evt_wp_1', tests.wp_session('sub_wp_1', '  Owner.One@Shop.TEST ', '{"company": "  Acme Plumbing Ltd  "}'));
begin
  perform tests.act_as_anon();
  v_answer := tests.wp_post(v_body);
  reset role;
  perform tests.ok('C2711 first delivery answer', v_answer = '{"outcome": "recorded", "provisioned": {"email": "owner.one@shop.test"}}'::jsonb,
    'answer was ' || v_answer::text);
  v_org := tests.wp_org('1');
  perform tests.ok('C2700 one org', (select count(*) from public.orgs where name = 'Acme Plumbing Ltd') = 1 and v_org is not null, 'not exactly one org named by the company');
  perform tests.ok('C2700 settings', (select count(*) from public.org_settings s where s.org_id = v_org and s.legal_name = 'Acme Plumbing Ltd' and s.phone = '604-555-0199') = 1,
    'settings differ');
  perform tests.ok('C2700 billing', exists (select 1 from public.org_billing b where b.org_id = v_org and b.stripe_customer_id = 'cus_sub_wp_1'
    and b.stripe_subscription_id = 'sub_wp_1' and b.plan = 'team' and b.seats = 5 and b.trades = array['hvac'] and not b.other_trade), 'billing row differs');
  perform tests.ok('C2700 one billing row', (select count(*) from public.org_billing where org_id = v_org) = 1, 'more than one billing row');
  perform tests.ok('C2703 invitation', exists (select 1 from public.invitations i where i.org_id = v_org and i.email = 'owner.one@shop.test'
    and i.role = 'owner' and i.invited_by is null and i.accepted_at is null
    and i.expires_at between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour'), 'invitation differs');
  perform tests.ok('C2703 one invitation', (select count(*) from public.invitations where org_id = v_org) = 1, 'not exactly one invitation');
  perform tests.ok('C2704 processed', exists (select 1 from private.stripe_events e where e.id = 'evt_wp_1' and e.processed_at is not null and e.process_error is null),
    'the event is not stamped processed');
end $$;

-- C2701: each pack seeds its types and the org's trade_context holds exactly the seeded phrases; nothing of another pack.
do $$
declare
  p text;
  n integer := 0;
  v_org uuid;
begin
  foreach p in array array['hvac', 'plumbing', 'electrical'] loop
    n := n + 1;
    perform tests.wp_buy('p' || n, jsonb_build_object('trades', p));
    v_org := tests.wp_org('p' || n);
    perform tests.ok('C2701 ' || p || ' types', (select count(*) from public.asset_types t where t.org_id = v_org and t.pack = p) > 0
      and (select count(*) from public.asset_types t where t.org_id = v_org and t.pack = p) = (select count(*) from private.catalog_asset_types c where c.pack = p),
      p || ' types not all seeded');
    perform tests.ok('C2701 ' || p || ' only', not exists (select 1 from public.asset_types t where t.org_id = v_org and t.pack is distinct from p), 'a type of another pack');
    perform tests.ok('C2701 ' || p || ' context', (select trade_context from public.org_settings where org_id = v_org) = (select trade_context from private.catalog_packs where pack = p),
      'trade_context differs');
  end loop;
  perform tests.ok('C2701 size', n = 3, 'the set is not 3');
  perform tests.wp_buy('p4', '{"trades": "plumbing,hvac"}');
  v_org := tests.wp_org('p4');
  perform tests.ok('C2701 two packs', (select count(*) from public.asset_types where org_id = v_org and pack = 'hvac') > 0
    and (select count(*) from public.asset_types where org_id = v_org and pack = 'plumbing') > 0, 'a pack is missing');
  perform tests.ok('C2701 two phrases', (select trade_context from public.org_settings where org_id = v_org) =
    (select trade_context from private.catalog_packs where pack = 'plumbing') || ', ' || (select trade_context from private.catalog_packs where pack = 'hvac'),
    'trade_context is not the two phrases in order');
  perform tests.ok('C2726 trades as sent', (select trades from public.org_billing where org_id = v_org) = array['plumbing', 'hvac'], 'trades were reordered');
end $$;

-- C2702: other.
do $$
declare
  v_org uuid;
begin
  perform tests.wp_buy('o1', '{"trades": "other"}');
  v_org := tests.wp_org('o1');
  perform tests.ok('C2702 other alone seeds nothing', (select count(*) from public.asset_types where org_id = v_org) = 0, 'types were seeded');
  perform tests.ok('C2702 other alone flag', (select other_trade from public.org_billing where org_id = v_org), 'other_trade is false');
  perform tests.ok('C2702 other alone context', (select trade_context from public.org_settings where org_id = v_org) is null, 'a trade phrase was set');
  perform tests.wp_buy('o2', '{"trades": "other,plumbing"}');
  v_org := tests.wp_org('o2');
  perform tests.ok('C2702 mixed seeds the pack', (select count(*) from public.asset_types where org_id = v_org and pack = 'plumbing') > 0
    and (select count(*) from public.asset_types where org_id = v_org and pack is distinct from 'plumbing') = 0, 'the pack was not seeded alone');
  perform tests.ok('C2702 mixed flag', (select other_trade from public.org_billing where org_id = v_org), 'other_trade is false');
  perform tests.ok('C2702 pack alone flag', not (select other_trade from public.org_billing where org_id = tests.wp_org('p1')), 'other_trade is true for a pack alone');
end $$;

-- C2705: the owner signs in with the checkout address and becomes the owner member.
do $$
declare
  v_org uuid := tests.wp_org('1');
  v_n integer;
begin
  insert into auth.users (id, email, aud, role) values (tests.id('wpOwner1'), 'Owner.One@Shop.test', 'authenticated', 'authenticated');
  perform tests.act_as('wpOwner1');
  v_n := public.accept_invitations();
  reset role;
  perform tests.ok('C2705 accepted one', v_n = 1, 'accepted ' || v_n);
  perform tests.ok('C2705 owner member', exists (select 1 from public.memberships m where m.org_id = v_org and m.user_id = tests.id('wpOwner1') and m.role = 'owner'),
    'no owner membership');
end $$;

-- C2706: the other five stored types create nothing and stay untried.
do $$
declare
  t text;
  i integer := 0;
  v_orgs bigint := (select count(*) from public.orgs);
begin
  foreach t in array array['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'] loop
    i := i + 1;
    perform tests.ok('C2706 ' || t, tests.wp_post(tests.wp_body('evt_wp_t' || i, tests.wp_session('sub_wp_t' || i, 't' || i || '@shop.test'), t)) = '{"outcome": "recorded"}'::jsonb, 'not recorded alone');
    perform tests.ok('C2706 untried ' || t, exists (select 1 from private.stripe_events where id = 'evt_wp_t' || i and processed_at is null and process_error is null), 'the event was marked');
  end loop;
  perform tests.ok('C2706 size', i = 5, 'the set is not 5');
  perform tests.ok('C2706 no org', (select count(*) from public.orgs) = v_orgs, 'an org was created');
end $$;

-- C2707: a processed event again is a plain duplicate.
do $$
declare
  v_body text := tests.wp_body('evt_wp_1', tests.wp_session('sub_wp_1', 'owner.one@shop.test', '{"company": "Acme Plumbing Ltd"}'));
  v_orgs bigint := (select count(*) from public.orgs);
begin
  perform tests.ok('C2707 answer', tests.wp_post(v_body) = '{"outcome": "duplicate"}'::jsonb, 'not a plain duplicate');
  perform tests.ok('C2707 again', tests.wp_post(v_body) = '{"outcome": "duplicate"}'::jsonb, 'not a plain duplicate the third time');
  perform tests.ok('C2707 counts', (select count(*) from public.orgs) = v_orgs and (select count(*) from public.org_billing where stripe_subscription_id = 'sub_wp_1') = 1
    and (select count(*) from public.invitations where email = 'owner.one@shop.test') = 1, 'something was created twice');
end $$;

-- C2709: the same subscription under a new event id.
do $$
declare
  v_orgs bigint := (select count(*) from public.orgs);
begin
  perform tests.wp_refused('C2709', 'evt_wp_dup', tests.wp_body('evt_wp_dup', tests.wp_session('sub_wp_1', 'someone.else@shop.test', '{"company": "Second Co"}')),
    'already_provisioned', 'Second Co', 'someone.else@shop.test');
  perform tests.ok('C2709 one billing row', (select count(*) from public.org_billing where stripe_subscription_id = 'sub_wp_1') = 1 and (select count(*) from public.orgs) = v_orgs,
    'a second org exists for the subscription');
end $$;

-- C2712: every invalid metadata case, table-driven over 10.
do $$
declare
  c record;
  i integer := 0;
  v_session jsonb;
begin
  for c in
    select * from (values
      ('plan gold', '{"plan": "gold"}'::jsonb, true),
      ('plan missing', '{"plan": null}'::jsonb, true),
      ('trades empty', '{"trades": ""}'::jsonb, true),
      ('trades fire', '{"trades": "fire"}'::jsonb, true),
      ('seats below included', '{"seats": "4"}'::jsonb, true),
      ('seats above 50', '{"seats": "51"}'::jsonb, true),
      ('seats abc', '{"seats": "abc"}'::jsonb, true),
      ('company empty', '{"company": ""}'::jsonb, true),
      ('company 121', jsonb_build_object('company', repeat('c', 121)), true),
      ('email missing', '{}'::jsonb, false)
    ) as t(name, meta, has_email)
  loop
    i := i + 1;
    v_session := tests.wp_session('sub_wp_m' || i, 'm' || i || '@shop.test', c.meta);
    if not c.has_email then
      v_session := v_session - 'customer_details';
    end if;
    perform tests.wp_refused('C2712 ' || c.name, 'evt_wp_m' || i, tests.wp_body('evt_wp_m' || i, v_session), 'invalid_metadata',
      coalesce(c.meta ->> 'company', 'Shop sub_wp_m' || i), 'm' || i || '@shop.test');
    perform tests.ok('C2716 kept ' || c.name, exists (select 1 from private.stripe_events where id = 'evt_wp_m' || i), 'the event row is gone');
  end loop;
  perform tests.ok('C2712 size', i = 10, 'the set is not 10');
  -- The edges of a good value are accepted: seats exactly at the plan's included seats and at 50, a 120-character company.
  perform tests.ok('C2712 edge seats 5', tests.wp_buy('e1', '{"seats": "5"}') ? 'provisioned', 'included seats refused');
  perform tests.ok('C2712 edge seats 50', tests.wp_buy('e2', '{"seats": "50"}') ? 'provisioned', '50 seats refused');
  perform tests.ok('C2712 edge company 120', tests.wp_buy('e3', jsonb_build_object('company', repeat('c', 120))) ? 'provisioned', '120-character company refused');
end $$;

-- C2713: the email already belongs to an org.
do $$
begin
  insert into public.invitations (org_id, email, role, expires_at) values
    (tests.id('orgA'), 'live@elsewhere.test', 'viewer', now() + interval '3 days'),
    (tests.id('orgA'), 'expired@elsewhere.test', 'viewer', now() - interval '1 day');
  insert into public.invitations (org_id, email, role, expires_at, accepted_at, accepted_by) values
    (tests.id('orgA'), 'accepted@elsewhere.test', 'viewer', now() + interval '3 days', now(), tests.id('uX'));
  perform tests.wp_refused('C2713 membership elsewhere', 'evt_wp_c1', tests.wp_body('evt_wp_c1', tests.wp_session('sub_wp_c1', ' UA@Example.Test ')),
    'email_in_use', 'Shop sub_wp_c1', 'ua@example.test');
  perform tests.wp_refused('C2713 live invitation elsewhere', 'evt_wp_c2', tests.wp_body('evt_wp_c2', tests.wp_session('sub_wp_c2', 'live@elsewhere.test')),
    'email_in_use', 'Shop sub_wp_c2', 'live@elsewhere.test');
  perform tests.ok('C2713 expired invitation allowed', tests.wp_buy('c3', '{}', 'expired@elsewhere.test') ? 'provisioned', 'an expired invitation blocked');
  perform tests.ok('C2713 accepted invitation allowed', tests.wp_buy('c4', '{}', 'accepted@elsewhere.test') ? 'provisioned', 'an accepted invitation blocked');
end $$;

-- C2708: a refused attempt that is valid now is provisioned by the next delivery; so is a stored row never tried.
do $$
declare
  v_answer jsonb;
  v_body text;
begin
  -- The refusal above (evt_wp_c2) clears when the other org's invitation goes.
  delete from public.invitations where email = 'live@elsewhere.test';
  v_body := tests.wp_body('evt_wp_c2', tests.wp_session('sub_wp_c2', 'live@elsewhere.test'));
  v_answer := tests.wp_post(v_body);
  perform tests.ok('C2708 refused then valid', v_answer = '{"outcome": "duplicate", "provisioned": {"email": "live@elsewhere.test"}}'::jsonb, 'answer was ' || v_answer::text);
  perform tests.ok('C2708 stamped', exists (select 1 from private.stripe_events where id = 'evt_wp_c2' and processed_at is not null and process_error is null), 'the event was not stamped');
  perform tests.ok('C2708 one org', (select count(*) from public.orgs where name = 'Shop sub_wp_c2') = 1, 'not exactly one org');
  perform tests.ok('C2708 then plain duplicate', tests.wp_post(v_body) = '{"outcome": "duplicate"}'::jsonb, 'a third delivery provisioned again');

  -- A row stored before provisioning existed (both columns null).
  v_body := tests.wp_body('evt_wp_old', tests.wp_session('sub_wp_old', 'old@shop.test'));
  insert into private.stripe_events (id, type, body) values ('evt_wp_old', 'checkout.session.completed', v_body::jsonb);
  v_answer := tests.wp_post(v_body);
  perform tests.ok('C2708 old row', v_answer = '{"outcome": "duplicate", "provisioned": {"email": "old@shop.test"}}'::jsonb, 'answer was ' || v_answer::text);
  perform tests.ok('C2708 old row org', tests.wp_org('old') is not null, 'no org for the old row');
end $$;

-- C2714: all or nothing.
do $$
begin
  create function tests.wp_boom() returns trigger language plpgsql as $f$ begin raise exception 'boom'; end $f$;
  create trigger wp_boom before insert on public.invitations for each row execute function tests.wp_boom();
  perform tests.wp_refused('C2714 failed', 'evt_wp_f1', tests.wp_body('evt_wp_f1', tests.wp_session('sub_wp_f1', 'f1@shop.test', '{"trades": "hvac,plumbing"}')),
    'failed', 'Shop sub_wp_f1', 'f1@shop.test');
  perform tests.ok('C2714 no billing', not exists (select 1 from public.org_billing where stripe_subscription_id = 'sub_wp_f1'), 'a billing row was left');
  drop trigger wp_boom on public.invitations;

  update private.catalog_packs set released_at = null where pack = 'plumbing';
  perform tests.wp_refused('C2714 no_pack', 'evt_wp_f2', tests.wp_body('evt_wp_f2', tests.wp_session('sub_wp_f2', 'f2@shop.test', '{"trades": "hvac,plumbing"}')),
    'no_pack', 'Shop sub_wp_f2', 'f2@shop.test');
  perform tests.ok('C2714 no billing 2', not exists (select 1 from public.org_billing where stripe_subscription_id = 'sub_wp_f2'), 'a billing row was left');
  update private.catalog_packs set released_at = now() where pack = 'plumbing';
end $$;

-- C2715: not a subscription session.
do $$
begin
  perform tests.wp_refused('C2715 mode payment', 'evt_wp_s1', tests.wp_body('evt_wp_s1', tests.wp_session('sub_wp_s1', 's1@shop.test', '{}', '{"mode": "payment"}')),
    'not_a_subscription', 'Shop sub_wp_s1', 's1@shop.test');
  perform tests.wp_refused('C2715 no customer', 'evt_wp_s2', tests.wp_body('evt_wp_s2', tests.wp_session('sub_wp_s2', 's2@shop.test', '{}', '{"customer": null}')),
    'not_a_subscription', 'Shop sub_wp_s2', 's2@shop.test');
  perform tests.wp_refused('C2715 no subscription', 'evt_wp_s3', tests.wp_body('evt_wp_s3', tests.wp_session('sub_wp_s3', 's3@shop.test', '{}', '{"subscription": null}')),
    'not_a_subscription', 'Shop sub_wp_s3', 's3@shop.test');
end $$;

-- C2717: the stored reason is a closed code and holds none of the delivery.
do $$
declare
  c text;
  i integer := 0;
begin
  perform tests.expect_error('C2717 free text', $q$update private.stripe_events set process_error = 'owner@shop.test' where id = 'evt_wp_dup'$q$, '23514');
  foreach c in array array['invalid_metadata', 'email_in_use', 'already_provisioned', 'no_pack', 'not_a_subscription', 'failed'] loop
    i := i + 1;
    perform tests.ok('C2717 ' || c, exists (select 1 from private.stripe_events where process_error = c), 'no event ever stored ' || c);
  end loop;
  perform tests.ok('C2717 size', i = 6, 'the set is not 6');
  perform tests.ok('C2717 no delivery text', not exists (select 1 from private.stripe_events where process_error ~ '[@ ]'), 'a reason holds free text');
end $$;

-- C2710: the mechanism that serialises two deliveries (the interleaving itself is not driven: one rolled-back connection).
do $$
declare
  v_src text := lower((select prosrc from pg_proc where oid = 'private.process_checkout_event(text)'::regprocedure));
begin
  perform tests.ok('C2710 row lock', v_src ~ 'from private\.stripe_events e where e\.id = p_event_id for update', 'the retry path does not lock the event row');
  perform tests.ok('C2710 event key', exists (select 1 from pg_index i where i.indrelid = 'private.stripe_events'::regclass and i.indisprimary
    and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['id']), 'stripe_events is not keyed by id');
  perform tests.ok('C2710 unique subscription', exists (select 1 from pg_index i where i.indrelid = 'public.org_billing'::regclass and i.indisunique
    and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['stripe_subscription_id']), 'subscription id is not unique');
  perform tests.ok('C2710 unique customer', exists (select 1 from pg_index i where i.indrelid = 'public.org_billing'::regclass and i.indisunique
    and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey)) = array['stripe_customer_id']), 'customer id is not unique');
  perform tests.expect_error('C2710 second customer', $q$insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
    select tests.id('orgA'), 'cus_sub_wp_1', 'sub_other', 'team', 5, array['hvac'], false$q$, '23505');
end $$;

-- Readers: a provisioned org P and a second, Q, with one member of each role.
insert into auth.users (id, email, aud, role)
select tests.id(u), u || '@example.test', 'authenticated', 'authenticated' from unnest(array['wpAdmin', 'wpEst', 'wpView', 'wpOwnerP']) as u;
insert into public.memberships (org_id, user_id, role) values
  (tests.wp_org('p1'), tests.id('wpAdmin'), 'admin'),
  (tests.wp_org('p1'), tests.id('wpEst'), 'estimator'),
  (tests.wp_org('p1'), tests.id('wpView'), 'viewer'),
  (tests.wp_org('p1'), tests.id('wpOwnerP'), 'owner');

-- C2722: owner and admin read their own org's row only.
do $$
declare
  u text;
  i integer := 0;
begin
  foreach u in array array['wpOwnerP', 'wpAdmin'] loop
    i := i + 1;
    perform tests.act_as(u);
    perform tests.ok('C2722 ' || u || ' sees own', (select count(*) from public.org_billing where org_id = tests.wp_org('p1')) = 1, u || ' cannot read the org''s row');
    perform tests.ok('C2722 ' || u || ' only own', (select count(*) from public.org_billing) = 1, u || ' reads another org''s row');
    reset role;
  end loop;
  perform tests.ok('C2722 size', i = 2, 'the set is not 2');
end $$;

-- C2723: no one else reads it.
do $$
declare
  u text;
  i integer := 0;
begin
  foreach u in array array['wpEst', 'wpView', 'uB'] loop
    i := i + 1;
    perform tests.act_as(u);
    perform tests.ok('C2723 ' || u, (select count(*) from public.org_billing) = 0, u || ' reads a billing row');
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.expect_error('C2723 anon', 'select count(*) from public.org_billing', '42501');
  reset role;
  perform tests.ok('C2723 size', i = 3, 'the set is not 3 plus anon');
end $$;

-- C2724: nobody writes through the API.
do $$
declare
  r text;
  p text;
  i integer := 0;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array array['insert', 'update', 'delete', 'truncate'] loop
      i := i + 1;
      perform tests.ok('C2724 ' || r || ' ' || p, not has_table_privilege(r, 'public.org_billing', p), r || ' holds ' || p);
    end loop;
  end loop;
  perform tests.ok('C2724 size', i = 8, 'the set is not 8');
  perform tests.act_as('wpOwnerP');
  perform tests.expect_error('C2724 direct insert', format($q$insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
    values (%L, 'cus_x', 'sub_x', 'team', 5, array['hvac'], false)$q$, tests.wp_org('p1')), '42501');
  reset role;
end $$;

-- C2725: orgs made any other way have no billing row and work as before.
do $$
begin
  perform tests.ok('C2725 fixture orgs', (select count(*) from public.org_billing where org_id in (tests.id('orgA'), tests.id('orgB'))) = 0, 'a fixture org has a billing row');
  execute tests.insert_sql('orgs', 'A');
  execute tests.insert_sql('memberships', 'B');
  perform tests.ok('C2725 plain org', exists (select 1 from public.orgs o where o.name ~ '^Org ' and not exists (select 1 from public.org_billing b where b.org_id = o.id)), 'a plain org needed billing');
end $$;

-- C2726: the table's shape, and the cascade.
do $$
declare
  v_org uuid := tests.wp_org('e1');
begin
  perform tests.ok('C2726 rls', (select relrowsecurity from pg_class where oid = 'public.org_billing'::regclass), 'RLS is off');
  perform tests.ok('C2726 key', exists (select 1 from pg_constraint c where c.conrelid = 'public.org_billing'::regclass and c.contype = 'f'
    and c.confrelid = 'public.orgs'::regclass and c.confdeltype = 'c'), 'org_id does not cascade from orgs');
  delete from public.orgs where id = v_org;
  perform tests.ok('C2726 cascade', not exists (select 1 from public.org_billing where org_id = v_org), 'the billing row outlived its org');
end $$;

-- C2727: the ledger columns, privileges and the function's settings.
do $$
declare
  r text;
begin
  perform tests.ok('C2727 columns', (select count(*) from information_schema.columns where table_schema = 'private' and table_name = 'stripe_events'
    and column_name in ('processed_at', 'process_error') and is_nullable = 'YES') = 2, 'the two columns are missing or not nullable');
  foreach r in array array['anon', 'authenticated'] loop
    perform tests.ok('C2727 ' || r || ' table', not has_table_privilege(r, 'private.stripe_events', 'select')
      and not has_table_privilege(r, 'private.stripe_events', 'update'), r || ' holds a privilege on the ledger');
    perform tests.ok('C2727 ' || r || ' execute', has_function_privilege(r, 'public.stripe_receive_event(text, text)', 'execute'), r || ' cannot call the function');
    perform tests.ok('C2727 ' || r || ' provisioner', not has_function_privilege(r, 'private.provision_workspace(text)', 'execute'), r || ' can call the provisioner');
  end loop;
  perform tests.ok('C2727 public execute', not exists (select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.stripe_receive_event(text, text)'::regprocedure and a.grantee = 0), 'public can execute');
  perform tests.ok('C2727 definer', (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.stripe_receive_event(text, text)'::regprocedure),
    'not security definer with an empty search_path');
  perform tests.ok('C2727 provisioner definer', (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'private.provision_workspace(text)'::regprocedure),
    'the provisioner is not security definer with an empty search_path');
end $$;

-- C2730: the owner's email comes from customer_details, else from customer_email; the first wins when both are there.
do $$
declare
  v_org uuid;
begin
  perform tests.ok('C2730 fallback answer', tests.wp_post(tests.wp_body('evt_wp_fb1', tests.wp_session('sub_wp_fb1', 'x@shop.test', '{}',
    '{"customer_details": null, "customer_email": " FB@Shop.test "}'))) = '{"outcome": "recorded", "provisioned": {"email": "fb@shop.test"}}'::jsonb,
    'customer_email was not used');
  perform tests.ok('C2730 fallback invitation', exists (select 1 from public.invitations i where i.org_id = tests.wp_org('fb1') and i.email = 'fb@shop.test'), 'no invitation for customer_email');
  perform tests.ok('C2730 details win', tests.wp_post(tests.wp_body('evt_wp_fb2', tests.wp_session('sub_wp_fb2', 'details@shop.test', '{}',
    '{"customer_email": "other@shop.test"}'))) = '{"outcome": "recorded", "provisioned": {"email": "details@shop.test"}}'::jsonb, 'customer_details did not win');
  perform tests.ok('C2730 no stray invitation', not exists (select 1 from public.invitations where email = 'other@shop.test'), 'the lesser email was invited');
end $$;

-- C2731: four more invalid metadata cases the migration decides.
do $$
declare
  c record;
  i integer := 0;
begin
  for c in
    select * from (values
      ('email malformed', '{}'::jsonb, 'not-an-email'),
      ('email over 254', '{}'::jsonb, repeat('a', 250) || '@x.test'),
      ('five trades', '{"trades": "hvac,hvac,hvac,hvac,hvac"}'::jsonb, 'q@shop.test'),
      ('seats of four digits', '{"seats": "1000"}'::jsonb, 'q@shop.test'),
      ('company only spaces', '{"company": "   "}'::jsonb, 'q@shop.test')
    ) as t(name, meta, email)
  loop
    i := i + 1;
    perform tests.wp_refused('C2731 ' || c.name, 'evt_wp_q' || i, tests.wp_body('evt_wp_q' || i, tests.wp_session('sub_wp_q' || i, c.email, c.meta)),
      'invalid_metadata', coalesce(c.meta ->> 'company', 'Shop sub_wp_q' || i), c.email);
  end loop;
  perform tests.ok('C2731 size', i = 5, 'the set is not 5');
end $$;

-- C2732: the same subscription is refused as already_provisioned even when its email is also in use.
do $$
begin
  perform tests.ok('C2732 email is in use', exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id where lower(u.email) = 'owner.one@shop.test'), 'the fixture lost its member');
  perform tests.wp_refused('C2732 order', 'evt_wp_ord', tests.wp_body('evt_wp_ord', tests.wp_session('sub_wp_1', 'owner.one@shop.test', '{"company": "Order Co"}')),
    'already_provisioned', 'Order Co', 'owner.one@shop.test');
end $$;

rollback;
select 'workspace_provisioning: pass' as result;
