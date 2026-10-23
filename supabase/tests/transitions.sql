-- Transition write path (ports-adapters): C1-C15. Run after fixture.sql in the same execute_sql call.

-- uD: admin in org A.
insert into auth.users (id, email, aud, role)
values (tests.id('uD'), 'uD@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uD'), 'admin');

-- What a call may write, measured as table owner: status | events for it | outbox in its org | its versions.
create function tests.agr_state(p_agr uuid) returns text
language sql as $$
  select concat_ws('|',
    (select status from public.agreements where id = p_agr),
    (select count(*) from public.events where entity_id = p_agr),
    (select count(*) from public.outbox o join public.agreements a on a.org_id = o.org_id where a.id = p_agr),
    (select count(*) from public.agreement_versions where agreement_id = p_agr))
$$;

create function tests.con_state(p_con uuid) returns text
language sql as $$
  select concat_ws('|',
    (select status from public.contracts where id = p_con),
    (select count(*) from public.events where entity_id = p_con),
    (select count(*) from public.outbox o join public.contracts c on c.org_id = o.org_id where c.id = p_con))
$$;

create function tests.send_sql(p_agr uuid, p_expected text) returns text
language sql as $$
  select format(
    'select public.apply_agreement_transition(%L, %L, ''sent'', ''agreement.sent'', ''{"from":"draft","to":"sent"}'')',
    p_agr, p_expected)
$$;

create function tests.sign_sql(p_con uuid, p_expected text) returns text
language sql as $$
  select format(
    'select public.apply_contract_transition(%L, %L, ''client_signed'', ''contract.client_signed'', ''{"from":"pending_signature","to":"client_signed"}'')',
    p_con, p_expected)
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- C1
do $$
declare u text; e uuid;
begin
  foreach u in array array['uA', 'uD', 'uE'] loop
    update public.agreements set status = 'draft' where id = tests.id('agrA');
    perform tests.act_as(u);
    e := public.apply_agreement_transition(tests.id('agrA'), 'draft', 'sent', 'agreement.sent',
      '{"from":"draft","to":"sent"}');
    reset role;
    perform tests.ok('C1 ' || u, e is not null, 'no event id returned');
    perform tests.ok('C1 ' || u, (select status from public.agreements where id = tests.id('agrA')) = 'sent',
      'status is not sent');
    perform set_config('tests.evt', e::text, true);
  end loop;
end $$;

-- C2 (the event from uE's call, the last one above)
do $$
declare e uuid := current_setting('tests.evt')::uuid;
begin
  perform tests.ok('C2 count', (select count(*) from public.events where id = e) = 1, 'not exactly one event row');
  perform tests.ok('C2 row', exists (
    select 1 from public.events
    where id = e and type = 'agreement.sent' and entity_type = 'agreement' and entity_id = tests.id('agrA')
      and org_id = tests.id('orgA') and actor_id = tests.id('uE')
      and payload = '{"from":"draft","to":"sent"}'::jsonb), 'event row differs');
end $$;

-- C3
do $$
declare e uuid := current_setting('tests.evt')::uuid;
begin
  perform tests.ok('C3 count', (select count(*) from public.outbox where event_id = e) = 1, 'not exactly one outbox row');
  perform tests.ok('C3 row', exists (
    select 1 from public.outbox where event_id = e and org_id = tests.id('orgA') and status = 'pending'),
    'outbox row differs');
end $$;

-- C4 (agrA is sent)
do $$
declare e uuid;
begin
  perform tests.act_as('uE');
  e := public.apply_agreement_transition(tests.id('agrA'), 'sent', 'refused', 'agreement.refused',
    '{"from":"sent","to":"refused","reason":"Over budget"}');
  reset role;
  perform tests.ok('C4', (select payload from public.events where id = e)
    = '{"from":"sent","to":"refused","reason":"Over budget"}'::jsonb, 'payload not stored unchanged');
end $$;

-- C5
do $$
declare e uuid; before bigint;
begin
  update public.agreements set status = 'changes_requested' where id = tests.id('agrA');
  update public.agreement_versions set snapshot = '{"k":1}' where id = tests.id('verA');
  update public.agreement_versions set snapshot = '{"k":2}' where id = tests.id('ver2A');
  before := (select count(*) from public.agreement_versions where agreement_id = tests.id('agrA'));
  perform tests.act_as('uE');
  e := public.apply_agreement_transition(tests.id('agrA'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":3}');
  reset role;
  perform tests.ok('C5 status', (select status from public.agreements where id = tests.id('agrA')) = 'draft',
    'status is not draft');
  perform tests.ok('C5 count', (select count(*) from public.agreement_versions where agreement_id = tests.id('agrA'))
    = before + 1, 'not exactly one new version');
  perform tests.ok('C5 version', exists (
    select 1 from public.agreement_versions
    where agreement_id = tests.id('agrA') and version_no = 3 and snapshot = '{"k":2}'::jsonb),
    'version 3 missing or snapshot not copied from version 2');
  perform tests.ok('C5 payload', (select payload ->> 'versionNo' from public.events where id = e) = '3',
    'payload.versionNo is not 3');
end $$;

-- C7 (agrA is draft)
do $$
declare s text; n bigint;
begin
  s := tests.agr_state(tests.id('agrA'));
  perform tests.act_as('uE');
  perform tests.expect_error('C7 stale', tests.send_sql(tests.id('agrA'), 'sent'), '40001');
  reset role;
  perform tests.ok('C7 stale', tests.agr_state(tests.id('agrA')) = s, 'a stale call wrote something');

  n := (select count(*) from public.events where entity_id = tests.id('agrA') and type = 'agreement.sent');
  perform tests.act_as('uE');
  execute tests.send_sql(tests.id('agrA'), 'draft');
  perform tests.expect_error('C7 repeat', tests.send_sql(tests.id('agrA'), 'draft'), '40001');
  reset role;
  perform tests.ok('C7 repeat',
    (select count(*) from public.events where entity_id = tests.id('agrA') and type = 'agreement.sent') = n + 1,
    'the repeated call did not leave exactly one new event');
end $$;

-- C8
do $$
declare sa text; sb text;
begin
  sa := tests.agr_state(tests.id('agrA'));
  sb := tests.agr_state(tests.id('agrB'));
  perform tests.act_as('uE');
  perform tests.expect_error('C8 other org', tests.send_sql(tests.id('agrB'), 'draft'), 'P0002');
  perform tests.expect_error('C8 unknown', tests.send_sql(tests.id('no-such-agreement'), 'draft'), 'P0002');
  reset role;
  perform tests.ok('C8', tests.agr_state(tests.id('agrA')) = sa and tests.agr_state(tests.id('agrB')) = sb,
    'a not-found call wrote something');
end $$;

-- C9 (agrA is sent after C7)
do $$
declare s text;
begin
  s := tests.agr_state(tests.id('agrA'));
  perform tests.act_as('uV');
  perform tests.expect_error('C9',
    format('select public.apply_agreement_transition(%L, ''sent'', ''accepted'', ''agreement.accepted'', ''{"from":"sent","to":"accepted"}'')',
      tests.id('agrA')), '42501');
  reset role;
  perform tests.ok('C9', tests.agr_state(tests.id('agrA')) = s, 'a viewer call wrote something');
end $$;

-- C10
do $$ begin
  perform tests.act_as_anon();
  perform tests.expect_error('C10 agreement', tests.send_sql(tests.id('agrA'), 'sent'), '42501');
  perform tests.expect_error('C10 contract', tests.sign_sql(tests.id('conA'), 'pending_signature'), '42501');
  reset role;
end $$;

-- C11
do $$ begin
  perform tests.ok('C11 agreement', (
    select array_agg(pg_get_function_identity_arguments(p.oid)) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'apply_agreement_transition')
    = array['p_agreement_id uuid, p_expected_status text, p_to_status text, p_event_type text, p_payload jsonb'],
    'signature differs or overloaded');
  perform tests.ok('C11 contract', (
    select array_agg(pg_get_function_identity_arguments(p.oid)) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'apply_contract_transition')
    = array['p_contract_id uuid, p_expected_status text, p_to_status text, p_event_type text, p_payload jsonb'],
    'signature differs or overloaded');
end $$;

-- C12
do $$ begin
  perform tests.ok('C12 privilege', not has_table_privilege('authenticated', 'public.outbox', 'insert'),
    'authenticated may insert into outbox');
  perform tests.act_as('uE');
  perform tests.expect_error('C12 insert',
    format('insert into public.outbox (org_id, event_id) values (%L, %L)', tests.id('orgA'), tests.id('evt2A')), '42501');
  reset role;
end $$;

-- C13
do $$
declare f text; definer boolean;
begin
  foreach f in array array[
    'public.apply_agreement_transition(uuid, text, text, text, jsonb)',
    'public.apply_contract_transition(uuid, text, text, text, jsonb)',
    'private.enqueue_outbox(uuid)'] loop
    definer := f like 'private.%';
    perform tests.ok('C13 security ' || f, (select prosecdef from pg_proc where oid = f::regprocedure) = definer,
      'wrong security mode');
    perform tests.ok('C13 search_path ' || f,
      (select proconfig from pg_proc where oid = f::regprocedure) @> array['search_path=""'], 'search_path not empty');
    perform tests.ok('C13 anon ' || f, not has_function_privilege('anon', f, 'execute'), 'anon may execute');
    perform tests.ok('C13 authenticated ' || f, has_function_privilege('authenticated', f, 'execute'),
      'authenticated may not execute');
  end loop;
end $$;

-- C14 (conA is pending_signature)
do $$
declare e uuid;
begin
  perform tests.act_as('uE');
  e := public.apply_contract_transition(tests.id('conA'), 'pending_signature', 'client_signed',
    'contract.client_signed', '{"from":"pending_signature","to":"client_signed"}');
  reset role;
  perform tests.ok('C14 status', (select status from public.contracts where id = tests.id('conA')) = 'client_signed',
    'status is not client_signed');
  perform tests.ok('C14 event', (select count(*) from public.events where id = e) = 1 and exists (
    select 1 from public.events
    where id = e and type = 'contract.client_signed' and entity_type = 'contract' and entity_id = tests.id('conA')
      and actor_id = tests.id('uE') and payload = '{"from":"pending_signature","to":"client_signed"}'::jsonb),
    'event row differs');
  perform tests.ok('C14 outbox', (select count(*) from public.outbox where event_id = e and status = 'pending') = 1,
    'not exactly one pending outbox row');
end $$;

-- C15 (conA is client_signed)
do $$
declare sa text; sb text;
begin
  sa := tests.con_state(tests.id('conA'));
  sb := tests.con_state(tests.id('conB'));
  perform tests.act_as('uE');
  perform tests.expect_error('C15 stale', tests.sign_sql(tests.id('conA'), 'pending_signature'), '40001');
  perform tests.expect_error('C15 other org', tests.sign_sql(tests.id('conB'), 'pending_signature'), 'P0002');
  perform tests.expect_error('C15 unknown', tests.sign_sql(tests.id('no-such-contract'), 'pending_signature'), 'P0002');
  perform tests.act_as('uV');
  perform tests.expect_error('C15 viewer',
    format('select public.apply_contract_transition(%L, ''client_signed'', ''completed'', ''contract.completed'', ''{"from":"client_signed","to":"completed"}'')',
      tests.id('conA')), '42501');
  reset role;
  perform tests.ok('C15', tests.con_state(tests.id('conA')) = sa and tests.con_state(tests.id('conB')) = sb,
    'a refused call wrote something');
end $$;

reset role;
rollback;
select 'transitions: pass' as result;
