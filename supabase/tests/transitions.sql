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

-- Contract generation (.specs/features/contract-generation/checks.md): C1597-C1618.
update public.org_settings set address = '1 Main St', phone = '604-555-0100' where org_id = tests.id('orgA');

-- An accepted org A agreement <p_name> from tests.rn_agreement on its own site (address '2 Dock Rd'). Its site contact is
-- 'Pat <p_name>' with p_email (none when null). p_approver adds an approver 'Avery': '-' none, null a null email, else the email.
create function tests.cg_accepted(p_name text, p_email text default 'pat@customer.ca', p_approver text default '-')
returns uuid
language plpgsql as $$
declare
  a uuid := tests.rn_agreement(p_name, 'A', '2027-01-01',
    '{"cpiCapPct": 5, "cpiRenegotiationThresholdPct": 5, "renewalNoticeDays": 30}'::jsonb, p_email);
begin
  update public.sites set address = '2 Dock Rd' where id = tests.id(p_name || ':site');
  if p_approver is distinct from '-' then
    insert into public.contacts (id, org_id, customer_id, name, email)
    values (tests.id(p_name || ':ap'), tests.id('orgA'), tests.id('custA'), 'Avery', p_approver);
    update public.sites set approver_contact_id = tests.id(p_name || ':ap') where id = tests.id(p_name || ':site');
  end if;
  return a;
end $$;

-- contracts | events | outbox of org A, read past RLS.
create function tests.cg_state() returns text
language sql security definer as $$
  select concat_ws('|',
    (select count(*) from public.contracts where org_id = tests.id('orgA')),
    (select count(*) from public.events where org_id = tests.id('orgA')),
    (select count(*) from public.outbox where org_id = tests.id('orgA')))
$$;

-- The contract of the highest version of agreement <p_name>, read past RLS.
create function tests.cg_contract(p_name text) returns public.contracts
language sql security definer as $$
  select c.* from public.contracts c
  where c.agreement_version_id = tests.latest_version(tests.id(p_name))
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- C1597: the contract is for the highest version, in pending_signature, in the caller's org.
do $$
declare a uuid; c uuid;
begin
  a := tests.cg_accepted('cg1');
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start, term_months)
  values (tests.id('cg1:v2'), tests.id('orgA'), a, 2, '2027-02-01', 12);
  perform tests.act_as('uE');
  c := public.create_contract(a);
  reset role;
  perform tests.ok('C1597 id', c is not null, 'no contract id returned');
  perform tests.ok('C1597 one row', (select count(*) from public.contracts k join public.agreement_versions v on v.id = k.agreement_version_id
                                      where v.agreement_id = a) = 1, 'not exactly one contract for the agreement');
  perform tests.ok('C1597 version', (select agreement_version_id from public.contracts where id = c) = tests.id('cg1:v2'),
    'the contract is not on the highest version');
  perform tests.ok('C1597 status', (select status from public.contracts where id = c) = 'pending_signature', 'status is not pending_signature');
  perform tests.ok('C1597 org', (select org_id from public.contracts where id = c) = tests.id('orgA'), 'wrong org');
end $$;

-- C1598: the parties literal, with an approver; then with nothing set the three keys stay present and null.
do $$
declare a uuid; b uuid;
begin
  a := tests.cg_accepted('cg2a', 'pat@customer.ca', 'avery@customer.ca');
  perform tests.act_as('uE');
  perform public.create_contract(a);
  reset role;
  perform tests.ok('C1598 literal', (tests.cg_contract('cg2a')).parties = jsonb_build_object(
    'schema', 1,
    'contractor', jsonb_build_object('legalName', 'Legal A', 'address', '1 Main St', 'phone', '604-555-0100'),
    'customer', jsonb_build_object('name', 'Customer A'),
    'site', jsonb_build_object('name', 'Harbour Plant cg2a', 'address', '2 Dock Rd'),
    'signer', jsonb_build_object('name', 'Avery', 'email', 'avery@customer.ca')), 'parties differ from the literal');

  b := tests.cg_accepted('cg2f');
  update public.org_settings set address = null, phone = null where org_id = tests.id('orgA');
  update public.sites set address = null where id = tests.id('cg2f:site');
  perform tests.act_as('uE');
  perform public.create_contract(b);
  reset role;
  perform tests.ok('C1598 nulls', (tests.cg_contract('cg2f')).parties = jsonb_build_object(
    'schema', 1,
    'contractor', jsonb_build_object('legalName', 'Legal A', 'address', null::text, 'phone', null::text),
    'customer', jsonb_build_object('name', 'Customer A'),
    'site', jsonb_build_object('name', 'Harbour Plant cg2f', 'address', null::text),
    'signer', jsonb_build_object('name', 'Pat cg2f', 'email', 'pat@customer.ca')), 'unset keys are not present and null');
  update public.org_settings set address = '1 Main St', phone = '604-555-0100' where org_id = tests.id('orgA');
end $$;

-- C1599: who signs.
do $$
declare
  c record;
  a uuid;
begin
  for c in select * from (values
    ('cg3a', 'pat@customer.ca', 'avery@customer.ca', 'Avery', 'avery@customer.ca'),
    ('cg3b', 'pat@customer.ca', null,                'Pat cg3b', 'pat@customer.ca'),
    ('cg3c', 'pat@customer.ca', '   ',               'Pat cg3c', 'pat@customer.ca'),
    ('cg3d', 'pat@customer.ca', '-',                 'Pat cg3d', 'pat@customer.ca'),
    ('cg3e', null,              'avery@customer.ca', 'Avery', 'avery@customer.ca')
  ) as t (name, site_email, approver, want_name, want_email)
  loop
    a := tests.cg_accepted(c.name, c.site_email, c.approver);
    perform tests.act_as('uE');
    perform public.create_contract(a);
    reset role;
    perform tests.ok('C1599 ' || c.name, (tests.cg_contract(c.name)).parties -> 'signer'
      = jsonb_build_object('name', c.want_name, 'email', c.want_email), 'wrong signer for ' || c.name);
  end loop;
end $$;

-- C1600: the recipient is still the trimmed email of the same contact.
do $$
declare a uuid;
begin
  perform tests.cg_accepted('cg4a', 'pat@customer.ca', '  avery@customer.ca ');
  perform tests.ok('C1600 trimmed', private.customer_recipient(tests.id('cg4a:site')) = 'avery@customer.ca', 'approver email not trimmed');
  perform tests.cg_accepted('cg4b', null);
  perform tests.ok('C1600 neither', private.customer_recipient(tests.id('cg4b:site')) is null, 'a site with no contact has a recipient');
  perform tests.cg_accepted('cg4c', 'pat@customer.ca', '  ');
  perform tests.ok('C1600 fallback', private.customer_recipient(tests.id('cg4c:site')) = 'pat@customer.ca', 'a blank approver email did not fall back');
end $$;

-- C1601: one contract.pending_signature event by the caller, and no outbox row.
do $$
declare a uuid; c uuid; before_outbox bigint; e record;
begin
  a := tests.cg_accepted('cg5');
  -- Two versions, so a payload that names the highest one cannot be a hard-coded 1.
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start, term_months)
  values (tests.id('cg5:v2'), tests.id('orgA'), a, 2, '2027-02-01', 12);
  before_outbox := (select count(*) from public.outbox where org_id = tests.id('orgA'));
  perform tests.act_as('uE');
  c := public.create_contract(a);
  reset role;
  perform tests.ok('C1601 one event', (select count(*) from public.events where entity_id = c) = 1, 'not exactly one event');
  select * into e from public.events where entity_id = c;
  perform tests.ok('C1601 entity', e.entity_type = 'contract' and e.type = 'contract.pending_signature', 'wrong entity or type');
  perform tests.ok('C1601 payload', e.payload = jsonb_build_object('from', null::text, 'to', 'pending_signature', 'versionNo', 2), 'wrong payload: ' || e.payload::text);
  perform tests.ok('C1601 actor', e.actor_id = tests.id('uE'), 'wrong actor');
  perform tests.ok('C1601 no outbox', (select count(*) from public.outbox where org_id = tests.id('orgA')) = before_outbox, 'an outbox row was written');
end $$;

-- C1602: later edits to the settings, customer, site and contact do not move the parties.
do $$
declare a uuid; before_parties jsonb;
begin
  a := tests.cg_accepted('cg6');
  perform tests.act_as('uE');
  perform public.create_contract(a);
  reset role;
  before_parties := (tests.cg_contract('cg6')).parties;
  update public.org_settings set legal_name = 'Changed Ltd.', address = 'Elsewhere', phone = '1' where org_id = tests.id('orgA');
  update public.customers set name = 'Renamed customer' where id = tests.id('custA');
  update public.sites set name = 'Renamed site', address = 'Elsewhere 9' where id = tests.id('cg6:site');
  update public.contacts set name = 'Someone else', email = 'else@customer.ca' where id = tests.id('cg6:ct');
  perform tests.ok('C1602 frozen', (tests.cg_contract('cg6')).parties = before_parties, 'the parties followed a later edit');
  update public.org_settings set legal_name = 'Legal A', address = '1 Main St', phone = '604-555-0100' where org_id = tests.id('orgA');
  update public.customers set name = 'Customer A' where id = tests.id('custA');
end $$;

-- C1603: a repeat returns the same contract and writes nothing; a signed contract is not reset.
do $$
declare a uuid; c uuid; again uuid; state_after_first text;
begin
  a := tests.cg_accepted('cg7');
  perform tests.act_as('uE');
  c := public.create_contract(a);
  reset role;
  state_after_first := tests.cg_state();
  perform tests.act_as('uE');
  again := public.create_contract(a);
  reset role;
  perform tests.ok('C1603 same id', again = c, 'a repeat returned another id');
  perform tests.ok('C1603 nothing written', tests.cg_state() = state_after_first, 'a repeat wrote something');
  update public.contracts set status = 'client_signed' where id = c;
  perform tests.act_as('uE');
  again := public.create_contract(a);
  reset role;
  perform tests.ok('C1603 signed', again = c and (select status from public.contracts where id = c) = 'client_signed',
    'a repeat changed a signed contract');
  perform tests.ok('C1603 one event', (select count(*) from public.events where entity_id = c and type = 'contract.pending_signature') = 1,
    'a second pending_signature event');
end $$;

-- C1604: the agreement is locked before the contract is read, and a second contract for a version cannot exist.
do $$
declare def text;
begin
  -- Comments are taken out first, so a "for update" in a comment cannot stand in for the lock.
  def := regexp_replace(pg_get_functiondef('public.create_contract(uuid)'::regprocedure), '--[^\n]*', '', 'g');
  perform tests.ok('C1604 lock order', position('for update' in def) > 0 and position('for update' in def) < position('from public.contracts' in def),
    'the agreement is not locked before the contract is read');
  perform tests.ok('C1604 unique', exists (
    select 1 from pg_constraint k where k.conrelid = 'public.contracts'::regclass and k.contype = 'u'
      and k.conkey = array[(select attnum from pg_attribute where attrelid = 'public.contracts'::regclass and attname = 'agreement_version_id')]),
    'no unique constraint on contracts (agreement_version_id)');
  perform tests.expect_error('C1604 second contract',
    format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', tests.id('orgA'), tests.id('cg7:v1')), '23505');
end $$;

-- C1605: only an accepted agreement.
do $$
declare s text; a uuid; before_state text;
begin
  foreach s in array array['draft', 'sent', 'refused', 'changes_requested', 'expired', 'withdrawn'] loop
    a := tests.cg_accepted('cg8' || s);
    update public.agreements set status = s where id = a;
    before_state := tests.cg_state();
    perform tests.act_as('uE');
    perform tests.expect_hint('C1605 ' || s, format('select public.create_contract(%L)', a), '55000', 'not_accepted');
    reset role;
    perform tests.ok('C1605 wrote nothing ' || s, tests.cg_state() = before_state, 'a refusal wrote something');
  end loop;
end $$;

-- C1606: an automatic renewal is refused; a renegotiated renewal the customer accepted is not.
do $$
declare a uuid; b uuid; before_state text;
begin
  a := tests.cg_accepted('cg9a');
  insert into public.events (org_id, entity_type, entity_id, type, payload)
  values (tests.id('orgA'), 'agreement', a, 'agreement.renewed', '{}');
  before_state := tests.cg_state();
  perform tests.act_as('uE');
  perform tests.expect_hint('C1606 renewed', format('select public.create_contract(%L)', a), '55000', 'auto_renewal');
  reset role;
  perform tests.ok('C1606 wrote nothing', tests.cg_state() = before_state, 'a refusal wrote something');

  b := tests.cg_accepted('cg9b');
  insert into public.events (org_id, entity_type, entity_id, type, payload) values
    (tests.id('orgA'), 'agreement', b, 'agreement.renewal_drafted', '{}'),
    (tests.id('orgA'), 'agreement', b, 'agreement.sent', '{}'),
    (tests.id('orgA'), 'agreement', b, 'agreement.accepted', '{}');
  perform tests.act_as('uE');
  perform tests.ok('C1606 renegotiated', public.create_contract(b) is not null, 'a renegotiated renewal was refused');
  reset role;
end $$;

-- C1607: an inactive site.
do $$
declare a uuid; before_state text;
begin
  a := tests.cg_accepted('cg10');
  update public.sites set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('cg10:site');
  before_state := tests.cg_state();
  perform tests.act_as('uE');
  perform tests.expect_hint('C1607', format('select public.create_contract(%L)', a), '55000', 'site_inactive');
  reset role;
  perform tests.ok('C1607 wrote nothing', tests.cg_state() = before_state, 'a refusal wrote something');
end $$;

-- C1608: no term start on the highest version.
do $$
declare a uuid; b uuid; before_state text;
begin
  a := tests.cg_accepted('cg11a');
  update public.agreement_versions set term_start = null where id = tests.id('cg11a:v1');
  before_state := tests.cg_state();
  perform tests.act_as('uE');
  perform tests.expect_hint('C1608 none', format('select public.create_contract(%L)', a), '55000', 'no_term_start');
  reset role;
  perform tests.ok('C1608 none wrote nothing', tests.cg_state() = before_state, 'a refusal wrote something');

  b := tests.cg_accepted('cg11b');
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start) values (tests.id('cg11b:v2'), tests.id('orgA'), b, 2, null);
  before_state := tests.cg_state();
  perform tests.act_as('uE');
  perform tests.expect_hint('C1608 highest', format('select public.create_contract(%L)', b), '55000', 'no_term_start');
  reset role;
  perform tests.ok('C1608 wrote nothing', tests.cg_state() = before_state, 'a refusal wrote something');
end $$;

-- C1609: nobody with an email to sign.
do $$
declare a uuid; before_state text;
begin
  perform tests.cg_accepted('cg12a', null);
  perform tests.cg_accepted('cg12b');
  update public.contacts set email = null where id = tests.id('cg12b:ct');
  perform tests.cg_accepted('cg12c', '  ', '  ');
  before_state := tests.cg_state();
  perform tests.act_as('uE');
  perform tests.expect_hint('C1609 no contact', format('select public.create_contract(%L)', tests.id('cg12a')), '55000', 'no_signer');
  perform tests.expect_hint('C1609 null email', format('select public.create_contract(%L)', tests.id('cg12b')), '55000', 'no_signer');
  perform tests.expect_hint('C1609 blank emails', format('select public.create_contract(%L)', tests.id('cg12c')), '55000', 'no_signer');
  reset role;
  perform tests.ok('C1609 wrote nothing', tests.cg_state() = before_state, 'a refusal wrote something');
end $$;

-- C1610: who may call.
do $$
declare a uuid; before_state text;
begin
  perform tests.cg_accepted('cg13a');
  perform tests.cg_accepted('cg13b');
  a := tests.cg_accepted('cg13c');
  perform tests.act_as('uA');
  perform tests.ok('C1610 owner', public.create_contract(tests.id('cg13a')) is not null, 'an owner was refused');
  reset role;
  perform tests.act_as('uD');
  perform tests.ok('C1610 admin', public.create_contract(tests.id('cg13b')) is not null, 'an admin was refused');
  reset role;
  before_state := tests.cg_state();
  perform tests.act_as('uV');
  perform tests.expect_error('C1610 viewer', format('select public.create_contract(%L)', a), '42501');
  reset role;
  perform tests.act_as('uB');
  perform tests.expect_error('C1610 other org', format('select public.create_contract(%L)', a), 'P0002');
  perform tests.expect_error('C1610 unknown', format('select public.create_contract(%L)', tests.id('no-such-agreement')), 'P0002');
  reset role;
  perform tests.act_as_anon();
  perform tests.expect_error('C1610 anon', format('select public.create_contract(%L)', a), '42501');
  reset role;
  perform tests.ok('C1610 wrote nothing', tests.cg_state() = before_state, 'a refused caller wrote something');
end $$;

-- C1611: when two refusals apply, the earlier hint wins.
do $$
declare a uuid;
begin
  a := tests.cg_accepted('cg14a');
  update public.agreements set status = 'draft' where id = a;
  update public.sites set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('cg14a:site');

  perform tests.cg_accepted('cg14b');
  insert into public.events (org_id, entity_type, entity_id, type, payload) values (tests.id('orgA'), 'agreement', tests.id('cg14b'), 'agreement.renewed', '{}');
  update public.sites set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('cg14b:site');

  perform tests.cg_accepted('cg14c');
  update public.sites set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('cg14c:site');
  update public.agreement_versions set term_start = null where id = tests.id('cg14c:v1');

  perform tests.cg_accepted('cg14d', null);
  update public.agreement_versions set term_start = null where id = tests.id('cg14d:v1');

  perform tests.act_as('uE');
  perform tests.expect_hint('C1611 draft+inactive', format('select public.create_contract(%L)', tests.id('cg14a')), '55000', 'not_accepted');
  perform tests.expect_hint('C1611 renewed+inactive', format('select public.create_contract(%L)', tests.id('cg14b')), '55000', 'auto_renewal');
  perform tests.expect_hint('C1611 inactive+no start', format('select public.create_contract(%L)', tests.id('cg14c')), '55000', 'site_inactive');
  perform tests.expect_hint('C1611 no start+no signer', format('select public.create_contract(%L)', tests.id('cg14d')), '55000', 'no_term_start');
  reset role;
end $$;

-- C1612: the table takes no direct insert, delete or update of anything but the status.
do $$
declare c uuid := (tests.cg_contract('cg1')).id;
begin
  perform tests.act_as('uA');
  perform tests.expect_error('C1612 insert', format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', tests.id('orgA'), tests.id('cg1:v1')), '42501');
  perform tests.expect_error('C1612 delete', format('delete from public.contracts where id = %L', c), '42501');
  perform tests.expect_error('C1612 parties', format('update public.contracts set parties = ''{}'' where id = %L', c), '42501');
  perform tests.expect_error('C1612 org_id', format('update public.contracts set org_id = org_id where id = %L', c), '42501');
  perform tests.expect_error('C1612 agreement_version_id', format('update public.contracts set agreement_version_id = agreement_version_id where id = %L', c), '42501');
  perform tests.expect_rows('C1612 status', format('update public.contracts set status = ''client_signed'' where id = %L and status = ''pending_signature''', c), 1);
  reset role;
  perform tests.act_as('uE');
  perform tests.expect_error('C1612 estimator insert', format('insert into public.contracts (org_id, agreement_version_id) values (%L, %L)', tests.id('orgA'), tests.id('cg1:v1')), '42501');
  reset role;
end $$;

-- C1615: definer, empty search_path, who may execute.
do $$
declare f regprocedure;
begin
  foreach f in array array['public.create_contract(uuid)'::regprocedure, 'public.contract_signer(uuid)'::regprocedure] loop
    perform tests.ok('C1615 definer ' || f::text, (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f), 'not security definer with an empty search_path');
    perform tests.ok('C1615 authenticated ' || f::text, has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot execute');
    perform tests.ok('C1615 anon ' || f::text, not has_function_privilege('anon', f, 'execute'), 'anon can execute');
  end loop;
  foreach f in array array['private.customer_signer(uuid)'::regprocedure, 'private.customer_recipient(uuid)'::regprocedure, 'private.contract_parties(uuid)'::regprocedure] loop
    perform tests.ok('C1615 private ' || f::text, not has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'),
      'a caller can execute a private function');
  end loop;
end $$;

-- C1616: the signer before a contract exists.
do $$
declare noone uuid;
begin
  perform tests.cg_accepted('cg15', null);
  noone := tests.id('cg15:site');
  perform tests.act_as('uE');
  perform tests.ok('C1616 signer', public.contract_signer(tests.id('cg1:site')) = jsonb_build_object('name', 'Pat cg1', 'email', 'pat@customer.ca'), 'wrong signer');
  perform tests.ok('C1616 other org', public.contract_signer(tests.id('siteB')) is null, 'another org signer leaked');
  perform tests.ok('C1616 nobody', public.contract_signer(noone) is null, 'a site with no emailed contact has a signer');
  reset role;
  perform tests.act_as_anon();
  perform tests.expect_error('C1616 anon', format('select public.contract_signer(%L)', tests.id('cg1:site')), '42501');
  reset role;
end $$;

-- C1618: a generated contract keeps its site from being deactivated, even when the term is over.
do $$
declare a uuid; b uuid;
begin
  a := tests.cg_accepted('cg16a');
  update public.agreement_versions set term_start = '2020-01-01' where id = tests.id('cg16a:v1');
  b := tests.cg_accepted('cg16b');
  update public.agreement_versions set term_start = '2020-01-01' where id = tests.id('cg16b:v1');
  perform tests.act_as('uE');
  perform public.create_contract(b);
  perform tests.ok('C1618 no contract', public.set_site_active(tests.id('cg16a:site'), false) is not null, 'a site without a contract could not be deactivated');
  perform tests.expect_hint('C1618 contract', format('select public.set_site_active(%L, false)', tests.id('cg16b:site')), '55000', 'in_term');
  reset role;
end $$;

-- Signature provider (.specs/features/signature-provider/checks.md): C1662-C1679. C1680 is a get_advisors call, C1681 the full run.
-- uD, the admin of org A, is created at the top of this file.

create function tests.sg_hash(p_name text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_name, 'UTF8')), 'hex') $$;

-- A value shaped like AD-077's sealed text (v1.<16 characters>.<body>); the database never opens it.
create function tests.sg_sealed(p_body text) returns text
language sql immutable as $$ select 'v1.AAAAAAAAAAAAAAAA.' || p_body $$;

create function tests.sg_signers(p_tag text default 'x') returns jsonb
language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('role', 'customer', 'submitterId', '101', 'embedSealed', tests.sg_sealed('cust' || p_tag)),
    jsonb_build_object('role', 'contractor', 'submitterId', '102', 'embedSealed', tests.sg_sealed('con' || p_tag)))
$$;

-- The contract fixture: an accepted org A agreement <p_name> whose site contact is 'Pat Lee' <pat@customer.ca>, made into a
-- contract by uE, then moved to p_status and given p_parties when those are not the defaults.
create function tests.sg_contract(p_name text, p_status text default 'pending_signature', p_parties jsonb default null)
returns uuid
language plpgsql as $$
declare
  a uuid := tests.rn_agreement(p_name, 'A', '2027-01-01',
    '{"cpiCapPct": 5, "cpiRenegotiationThresholdPct": 5, "renewalNoticeDays": 30}'::jsonb, 'pat@customer.ca');
  c uuid;
begin
  update public.contacts set name = 'Pat Lee' where id = tests.id(p_name || ':ct');
  update public.sites set address = '2 Dock Rd' where id = tests.id(p_name || ':site');
  perform tests.act_as('uE');
  c := public.create_contract(a);
  reset role;
  if p_status <> 'pending_signature' then update public.contracts set status = p_status where id = c; end if;
  if p_parties is not null then update public.contracts set parties = p_parties where id = c; end if;
  return c;
end $$;

-- The request fixture: begun by uD with name 'Dana Admin' and the hash of the contract's id.
create function tests.sg_begin(p_contract uuid, p_name text default 'Dana Admin') returns uuid
language plpgsql as $$
declare r uuid;
begin
  perform tests.act_as('uD');
  r := public.begin_signature_request(p_contract, p_name, tests.sg_hash(p_contract::text));
  reset role;
  return r;
end $$;

-- A request that has been begun and completed.
create function tests.sg_open(p_contract uuid, p_tag text default 'x') returns uuid
language plpgsql as $$
declare r uuid := tests.sg_begin(p_contract);
begin
  perform tests.act_as('uD');
  perform public.complete_signature_request(r, '13226499', tests.sg_signers(p_tag), tests.sg_sealed('link' || p_tag), repeat('a', 64));
  reset role;
  return r;
end $$;

-- requests | signers | events | outbox of org A, read past RLS.
create function tests.sg_state() returns text
language sql security definer as $$
  select concat_ws('|',
    (select count(*) from public.contract_signature_requests),
    (select count(*) from public.contract_signers),
    (select count(*) from public.events where org_id = tests.id('orgA')),
    (select count(*) from public.outbox where org_id = tests.id('orgA')))
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- C1662: begin creates one `creating` request and its two signers.
do $$
declare c uuid; r uuid; s public.contract_signature_requests;
begin
  c := tests.sg_contract('sg1');
  perform tests.act_as('uD');
  r := public.begin_signature_request(c, 'Dana Admin', tests.sg_hash('sg1'));
  reset role;
  perform tests.ok('C1662 id', r is not null, 'no request id returned');
  perform tests.ok('C1662 one request', (select count(*) from public.contract_signature_requests where contract_id = c) = 1, 'not exactly one request');
  select * into s from public.contract_signature_requests where id = r;
  perform tests.ok('C1662 request', s.status = 'creating' and s.contract_id = c and s.org_id = tests.id('orgA'), 'wrong request row');
  perform tests.ok('C1662 customer', exists (select 1 from public.contract_signers
      where request_id = r and role = 'customer' and name = 'Pat Lee' and email = 'pat@customer.ca' and token_hash = tests.sg_hash('sg1')),
    'wrong customer signer');
  perform tests.ok('C1662 contractor', exists (select 1 from public.contract_signers
      where request_id = r and role = 'contractor' and name = 'Dana Admin' and email = 'uD@example.test' and token_hash is null and link_sealed is null),
    'wrong contractor signer');
  perform tests.ok('C1662 two signers', (select count(*) from public.contract_signers where request_id = r) = 2, 'not exactly two signers');
end $$;

-- C1663: only an owner or admin of the contract's org begins; another org and a missing contract are not found.
do $$
declare c uuid := tests.sg_contract('sg2'); h text := tests.sg_hash('sg2'); u text; k uuid;
begin
  foreach u in array array['uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C1663 ' || u, format('select public.begin_signature_request(%L, ''Dana'', %L)', c, h), '42501');
    reset role;
  end loop;
  perform tests.act_as('uB');
  perform tests.expect_error('C1663 uB', format('select public.begin_signature_request(%L, ''Dana'', %L)', c, h), 'P0002');
  reset role;
  perform tests.act_as('uD');
  perform tests.expect_error('C1663 random', format('select public.begin_signature_request(%L, ''Dana'', %L)', gen_random_uuid(), h), 'P0002');
  reset role;
  perform tests.act_as('uA');
  k := public.begin_signature_request(c, 'Olive Owner', h);
  reset role;
  perform tests.ok('C1663 owner', k is not null, 'the owner could not begin');
end $$;

-- C1664: a contract past pending_signature is refused with not_pending.
do $$
declare s text; c uuid;
begin
  foreach s in array array['client_signed', 'completed', 'declined', 'voided'] loop
    c := tests.sg_contract('sg3' || s, s);
    perform tests.act_as('uD');
    perform tests.expect_hint('C1664 ' || s, format('select public.begin_signature_request(%L, ''Dana'', %L)', c, tests.sg_hash(c::text)), '55000', 'not_pending');
    reset role;
  end loop;
end $$;

-- C1665: no recorded parties, or parties with no signer, is refused with parties_missing.
do $$
declare c uuid; d uuid;
begin
  c := tests.sg_contract('sg4a', 'pending_signature', '{}'::jsonb);
  d := tests.sg_contract('sg4b', 'pending_signature', '{"schema": 1, "signer": null}'::jsonb);
  perform tests.act_as('uD');
  perform tests.expect_hint('C1665 empty', format('select public.begin_signature_request(%L, ''Dana'', %L)', c, tests.sg_hash('x')), '55000', 'parties_missing');
  perform tests.expect_hint('C1665 no signer', format('select public.begin_signature_request(%L, ''Dana'', %L)', d, tests.sg_hash('y')), '55000', 'parties_missing');
  reset role;
end $$;

-- C1666: the name is 1 to 120 characters after trimming.
do $$
declare c uuid := tests.sg_contract('sg5'); n text; r uuid;
begin
  perform tests.act_as('uD');
  foreach n in array array['', '   ', repeat('x', 121)] loop
    perform tests.expect_hint('C1666 [' || length(n) || ']', format('select public.begin_signature_request(%L, %L, %L)', c, n, tests.sg_hash('z')), '23514', 'invalid_name');
  end loop;
  r := public.begin_signature_request(c, '  ' || repeat('x', 120) || '  ', tests.sg_hash('z'));
  reset role;
  perform tests.ok('C1666 120 trimmed', (select name from public.contract_signers where request_id = r and role = 'contractor') = repeat('x', 120),
    'a 120-character name was not stored trimmed');
end $$;

-- C1667: a contract with a creating, and one with an open, request refuse a second begin with already_open.
do $$
declare c uuid := tests.sg_contract('sg6a'); d uuid := tests.sg_contract('sg6b'); r uuid; q uuid;
begin
  r := tests.sg_begin(c);
  q := tests.sg_open(d);
  perform tests.act_as('uD');
  perform tests.expect_hint('C1667 creating', format('select public.begin_signature_request(%L, ''Dana'', %L)', c, tests.sg_hash('p')), '55000', 'already_open');
  perform tests.expect_hint('C1667 open', format('select public.begin_signature_request(%L, ''Dana'', %L)', d, tests.sg_hash('q')), '55000', 'already_open');
  reset role;
  perform tests.ok('C1667 one row each', (select count(*) from public.contract_signature_requests where contract_id in (c, d)) = 2, 'a refused begin left a row');
end $$;

-- C1668: after every refusal the counts of requests, signers, events and outbox rows are what they were.
do $$
declare ok_c uuid := tests.sg_contract('sg7a'); late uuid := tests.sg_contract('sg7b', 'completed'); bare uuid := tests.sg_contract('sg7c', 'pending_signature', '{}'::jsonb);
        live uuid := tests.sg_contract('sg7d'); before_state text; r uuid;
begin
  r := tests.sg_begin(live);
  before_state := tests.sg_state();
  perform tests.act_as('uE');
  perform tests.expect_error('C1668 role', format('select public.begin_signature_request(%L, ''Dana'', %L)', ok_c, tests.sg_hash('a')), '42501');
  reset role;
  perform tests.act_as('uD');
  perform tests.expect_error('C1668 not_pending', format('select public.begin_signature_request(%L, ''Dana'', %L)', late, tests.sg_hash('b')), '55000');
  perform tests.expect_error('C1668 parties', format('select public.begin_signature_request(%L, ''Dana'', %L)', bare, tests.sg_hash('c')), '55000');
  perform tests.expect_error('C1668 already_open', format('select public.begin_signature_request(%L, ''Dana'', %L)', live, tests.sg_hash('d')), '55000');
  perform tests.expect_error('C1668 name', format('select public.begin_signature_request(%L, '' '', %L)', ok_c, tests.sg_hash('e')), '23514');
  perform tests.expect_error('C1668 hash', format('select public.begin_signature_request(%L, ''Dana'', ''nothex'')', ok_c), '22023');
  reset role;
  perform tests.ok('C1668 unchanged', tests.sg_state() = before_state, 'a refusal wrote something: ' || before_state || ' -> ' || tests.sg_state());
end $$;

-- C1669: the unique index allows one creating or open request per contract; failed and voided ones do not count.
do $$
declare c uuid := tests.sg_contract('sg8a'); d uuid := tests.sg_contract('sg8b'); r uuid; q uuid; v_constraint text;
begin
  r := tests.sg_begin(c);
  q := tests.sg_open(d);
  begin
    insert into public.contract_signature_requests (org_id, contract_id) values (tests.id('orgA'), c);
    raise exception 'C1669 a second creating request was inserted';
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform tests.ok('C1669 creating', v_constraint = 'contract_signature_requests_one_live', 'wrong constraint ' || coalesce(v_constraint, '-'));
  end;
  begin
    insert into public.contract_signature_requests (org_id, contract_id) values (tests.id('orgA'), d);
    raise exception 'C1669 a second request was inserted beside an open one';
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform tests.ok('C1669 open', v_constraint = 'contract_signature_requests_one_live', 'wrong constraint ' || coalesce(v_constraint, '-'));
  end;
  update public.contract_signature_requests set status = 'failed' where id = r;
  insert into public.contract_signature_requests (org_id, contract_id) values (tests.id('orgA'), c);
  update public.contract_signature_requests set status = 'voided' where id = q;
  insert into public.contract_signature_requests (org_id, contract_id) values (tests.id('orgA'), d);
  perform tests.ok('C1669 failed and voided do not count', (select count(*) from public.contract_signature_requests where contract_id in (c, d)) = 4, 'wrong row count');
end $$;

-- C1670: complete opens the request, stores the provider's answer and writes one event, with no outbox row.
do $$
declare c uuid := tests.sg_contract('sg9'); r uuid; s public.contract_signature_requests; e record; outbox_before bigint;
begin
  r := tests.sg_begin(c);
  outbox_before := (select count(*) from public.outbox where org_id = tests.id('orgA'));
  perform tests.act_as('uD');
  perform public.complete_signature_request(r, '13226499', tests.sg_signers(), tests.sg_sealed('linkx'), repeat('a', 64));
  reset role;
  select * into s from public.contract_signature_requests where id = r;
  perform tests.ok('C1670 request', s.status = 'open' and s.provider_submission_id = '13226499' and s.provider = 'docuseal' and s.document_sha256 = repeat('a', 64), 'request not opened as expected');
  perform tests.ok('C1670 customer', exists (select 1 from public.contract_signers where request_id = r and role = 'customer'
      and provider_submitter_id = '101' and embed_sealed = tests.sg_sealed('custx') and link_sealed = tests.sg_sealed('linkx')), 'customer signer not stored');
  perform tests.ok('C1670 contractor', exists (select 1 from public.contract_signers where request_id = r and role = 'contractor'
      and provider_submitter_id = '102' and embed_sealed = tests.sg_sealed('conx') and link_sealed is null), 'contractor signer not stored');
  perform tests.ok('C1670 one event', (select count(*) from public.events where entity_type = 'contract' and entity_id = c and type = 'contract.sent_for_signature') = 1, 'not exactly one event');
  select * into e from public.events where entity_type = 'contract' and entity_id = c and type = 'contract.sent_for_signature';
  perform tests.ok('C1670 payload', e.payload = jsonb_build_object('requestId', r, 'provider', 'docuseal', 'versionNo', 1), 'wrong payload ' || e.payload::text);
  perform tests.ok('C1670 actor', e.actor_id = tests.id('uD') and e.org_id = tests.id('orgA'), 'wrong actor or org');
  perform tests.ok('C1670 no outbox', (select count(*) from public.outbox where org_id = tests.id('orgA')) = outbox_before, 'an outbox row was written');
end $$;

-- C1671: complete refuses a request that is not creating, a malformed answer and a caller who may not; nothing changes.
do $$
declare c uuid; r uuid; o uuid; f uuid; bad jsonb; n int := 0; before_state text;
  call_sql text := 'select public.complete_signature_request(%L, %L, %L::jsonb, %L, %L)';
begin
  c := tests.sg_contract('sg10');
  r := tests.sg_begin(c);
  o := tests.sg_open(tests.sg_contract('sg10o'));
  f := tests.sg_begin(tests.sg_contract('sg10f'));
  update public.contract_signature_requests set status = 'failed' where id = f;
  before_state := tests.sg_state();
  perform tests.act_as('uD');
  perform tests.expect_error('C1671 open', format(call_sql, o, '1', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '55000');
  perform tests.expect_error('C1671 failed', format(call_sql, f, '1', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '55000');
  foreach bad in array array[
    jsonb_build_array(tests.sg_signers() -> 0),
    tests.sg_signers() || (tests.sg_signers() -> 0),
    jsonb_build_array(tests.sg_signers() -> 0, jsonb_build_object('role', 'witness', 'submitterId', '2', 'embedSealed', tests.sg_sealed('w'))),
    jsonb_build_array(tests.sg_signers() -> 0, jsonb_build_object('role', 'contractor', 'submitterId', '2', 'embedSealed', 'https://docuseal.com/s/plain')),
    jsonb_build_array(tests.sg_signers() -> 0, jsonb_build_object('role', 'contractor', 'embedSealed', tests.sg_sealed('w')))
  ] loop
    n := n + 1;
    perform tests.expect_error('C1671 signers ' || n, format(call_sql, r, '1', bad::text, tests.sg_sealed('l'), repeat('a', 64)), '22023');
  end loop;
  perform tests.expect_error('C1671 link', format(call_sql, r, '1', tests.sg_signers()::text, 'plain-token', repeat('a', 64)), '22023');
  perform tests.expect_error('C1671 sha', format(call_sql, r, '1', tests.sg_signers()::text, tests.sg_sealed('l'), 'abc'), '22023');
  perform tests.expect_error('C1671 submission', format(call_sql, r, '  ', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '22023');
  reset role;
  perform tests.act_as('uE');
  perform tests.expect_error('C1671 uE', format(call_sql, r, '1', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '42501');
  reset role;
  perform tests.act_as('uV');
  perform tests.expect_error('C1671 uV', format(call_sql, r, '1', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '42501');
  reset role;
  perform tests.act_as('uB');
  perform tests.expect_error('C1671 uB', format(call_sql, r, '1', tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), 'P0002');
  reset role;
  perform tests.ok('C1671 unchanged', tests.sg_state() = before_state, 'a refusal wrote something');
  perform tests.ok('C1671 still creating', (select status from public.contract_signature_requests where id = r) = 'creating'
    and (select count(*) from public.contract_signers where request_id = r and embed_sealed is not null) = 0, 'the request changed');
end $$;

-- C1672: fail turns a creating request into failed, once; an open request stays open; a new begin then works.
do $$
declare c uuid := tests.sg_contract('sg11'); r uuid; o uuid; k uuid;
begin
  r := tests.sg_begin(c);
  o := tests.sg_open(tests.sg_contract('sg11o'));
  perform tests.act_as('uD');
  perform public.fail_signature_request(r);
  perform tests.ok('C1672 failed', (select status from public.contract_signature_requests where id = r) = 'failed', 'a creating request did not fail');
  perform public.fail_signature_request(r);
  perform tests.ok('C1672 repeat', (select status from public.contract_signature_requests where id = r) = 'failed', 'a repeat changed the request');
  perform public.fail_signature_request(o);
  perform tests.ok('C1672 open stays open', (select status from public.contract_signature_requests where id = o) = 'open', 'an open request was failed');
  k := public.begin_signature_request(c, 'Dana Admin', tests.sg_hash('again'));
  reset role;
  perform tests.ok('C1672 new begin', k is not null and k <> r, 'a failed request blocked a new one');
  perform tests.act_as('uE');
  perform tests.expect_error('C1672 uE', format('select public.fail_signature_request(%L)', k), '42501');
  reset role;
  perform tests.act_as('uV');
  perform tests.expect_error('C1672 uV', format('select public.fail_signature_request(%L)', k), '42501');
  reset role;
  perform tests.act_as('uB');
  perform tests.expect_error('C1672 uB', format('select public.fail_signature_request(%L)', k), 'P0002');
  reset role;
end $$;

-- C1673: a member writes neither table and cannot read the three sealed or hashed columns; org B sees nothing of org A.
do $$
declare c uuid := tests.sg_contract('sg12'); r uuid; q text; own bigint;
begin
  r := tests.sg_open(c);
  perform tests.act_as('uD');
  foreach q in array array[
    'insert into public.contract_signature_requests (org_id, contract_id) values (gen_random_uuid(), gen_random_uuid())',
    'update public.contract_signature_requests set status = ''voided''',
    'delete from public.contract_signature_requests',
    'insert into public.contract_signers (request_id, org_id, role, name, email) values (gen_random_uuid(), gen_random_uuid(), ''customer'', ''a'', ''b'')',
    'update public.contract_signers set name = ''x''',
    'delete from public.contract_signers',
    'select embed_sealed from public.contract_signers',
    'select token_hash from public.contract_signers',
    'select link_sealed from public.contract_signers'
  ] loop
    perform tests.expect_error('C1673 ' || q, q, '42501');
  end loop;
  own := tests.count('select count(*) from (select id, status, contract_id, provider_submission_id from public.contract_signature_requests) t');
  perform tests.ok('C1673 own rows', own >= 1, 'a member cannot read the requests of the org');
  perform tests.ok('C1673 own signers', tests.count('select count(*) from (select request_id, role, name, email, provider_submitter_id from public.contract_signers) t') >= 2, 'a member cannot read the signers');
  reset role;
  perform tests.act_as('uB');
  perform tests.ok('C1673 other org requests', tests.count('select count(*) from (select id from public.contract_signature_requests) t') = 0, 'org B reads org A requests');
  perform tests.ok('C1673 other org signers', tests.count('select count(*) from (select request_id from public.contract_signers) t') = 0, 'org B reads org A signers');
  reset role;
end $$;

-- C1674: anon reads the page for a customer hash; nothing for an unknown hash, a null, or a request still being made.
do $$
declare c uuid := tests.sg_contract('sg13'); r uuid; v jsonb; n uuid := tests.sg_contract('sg13n');
  want_name text := (select legal_name from public.org_settings where org_id = tests.id('orgA'));
begin
  r := tests.sg_open(c, 'v');
  perform tests.sg_begin(n);
  perform tests.act_as_anon();
  v := public.signature_view(tests.sg_hash(c::text));
  perform tests.ok('C1674 tenant', v #>> '{tenant,name}' = want_name and want_name is not null, 'wrong tenant name');
  perform tests.ok('C1674 number', v #>> '{agreement,number}' = 'AG-sg13', 'wrong agreement number');
  perform tests.ok('C1674 signer', v #>> '{signer,name}' = 'Pat Lee', 'wrong signer name');
  perform tests.ok('C1674 statuses', v ->> 'contractStatus' = 'pending_signature' and v ->> 'requestStatus' = 'open', 'wrong statuses');
  perform tests.ok('C1674 embed', v ->> 'embedSealed' = tests.sg_sealed('custv'), 'wrong sealed embed');
  perform tests.ok('C1674 unknown', public.signature_view(tests.sg_hash('nobody')) is null, 'an unknown hash returned a page');
  perform tests.ok('C1674 null', public.signature_view(null) is null, 'a null hash returned a page');
  perform tests.ok('C1674 creating', public.signature_view(tests.sg_hash(n::text)) is null, 'a request still being made returned a page');
  reset role;
end $$;

-- C1675: the embed link is withheld, and the real statuses are returned, once the request or the contract is closed.
do $$
declare c uuid; r uuid; v jsonb; sc record;
begin
  for sc in select * from (values
    ('failed', null, 'failed', 'pending_signature'), ('voided', null, 'voided', 'pending_signature'),
    ('csig', 'client_signed', 'open', 'client_signed'), ('done', 'completed', 'open', 'completed'),
    ('decl', 'declined', 'open', 'declined'), ('void', 'voided', 'open', 'voided')) as t(name, contract_status, request_status, want_contract)
  loop
    c := tests.sg_contract('sg14' || sc.name);
    r := tests.sg_open(c);
    if sc.contract_status is not null then update public.contracts set status = sc.contract_status where id = c; end if;
    update public.contract_signature_requests set status = sc.request_status where id = r;
    perform tests.act_as_anon();
    v := public.signature_view(tests.sg_hash(c::text));
    reset role;
    perform tests.ok('C1675 ' || sc.name, v ->> 'embedSealed' is null and v ->> 'requestStatus' = sc.request_status and v ->> 'contractStatus' = sc.want_contract,
      'wrong closed view for ' || sc.name || ': ' || v::text);
  end loop;
end $$;

-- C1676: signature_view writes nothing.
do $$
declare c uuid := tests.sg_contract('sg15'); before_state text;
begin
  perform tests.sg_open(c);
  before_state := tests.sg_state();
  perform tests.act_as_anon();
  perform public.signature_view(tests.sg_hash(c::text));
  perform public.signature_view(tests.sg_hash(c::text));
  perform public.signature_view(tests.sg_hash('nobody'));
  reset role;
  perform tests.ok('C1676 unchanged', tests.sg_state() = before_state, 'a read wrote something');
end $$;

-- C1677: the contractor's embed link: owner and admin, once the customer has signed, and only with an open request.
do $$
declare c uuid := tests.sg_contract('sg16'); p uuid := tests.sg_contract('sg16p'); d uuid := tests.sg_contract('sg16d'); n uuid := tests.sg_contract('sg16n', 'client_signed');
        r uuid; u text;
begin
  r := tests.sg_open(c, 'k');
  update public.contracts set status = 'client_signed' where id = c;
  perform tests.sg_open(p, 'p');
  perform tests.sg_open(d, 'd');
  update public.contracts set status = 'completed' where id = d;
  perform tests.act_as('uD');
  perform tests.ok('C1677 admin', public.contractor_signing_source(c) = tests.sg_sealed('conk'), 'the admin did not get the contractor link');
  perform tests.expect_hint('C1677 pending', format('select public.contractor_signing_source(%L)', p), '55000', 'not_client_signed');
  perform tests.expect_hint('C1677 completed', format('select public.contractor_signing_source(%L)', d), '55000', 'not_client_signed');
  perform tests.expect_hint('C1677 no request', format('select public.contractor_signing_source(%L)', n), '55000', 'no_request');
  reset role;
  perform tests.act_as('uA');
  perform tests.ok('C1677 owner', public.contractor_signing_source(c) = tests.sg_sealed('conk'), 'the owner did not get the contractor link');
  reset role;
  foreach u in array array['uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C1677 ' || u, format('select public.contractor_signing_source(%L)', c), '42501');
    reset role;
  end loop;
  perform tests.act_as('uB');
  perform tests.expect_error('C1677 uB', format('select public.contractor_signing_source(%L)', c), 'P0002');
  reset role;
  perform tests.act_as('uD');
  perform tests.expect_error('C1677 random', format('select public.contractor_signing_source(%L)', gen_random_uuid()), 'P0002');
  reset role;
end $$;

-- C1678: the customer's sealed link: owner and admin, with an open request.
do $$
declare c uuid := tests.sg_contract('sg17'); n uuid := tests.sg_contract('sg17n'); x uuid := tests.sg_contract('sg17x'); u text;
begin
  perform tests.sg_open(c, 'm');
  perform tests.sg_begin(n);
  foreach u in array array['uD', 'uA'] loop
    perform tests.act_as(u);
    perform tests.ok('C1678 ' || u, public.customer_signing_link(c) = tests.sg_sealed('linkm'), 'the link was not returned to ' || u);
    reset role;
  end loop;
  foreach u in array array['uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C1678 ' || u, format('select public.customer_signing_link(%L)', c), '42501');
    reset role;
  end loop;
  perform tests.act_as('uB');
  perform tests.expect_error('C1678 uB', format('select public.customer_signing_link(%L)', c), 'P0002');
  reset role;
  perform tests.act_as('uD');
  perform tests.expect_hint('C1678 creating', format('select public.customer_signing_link(%L)', n), '55000', 'no_request');
  perform tests.expect_hint('C1678 none', format('select public.customer_signing_link(%L)', x), '55000', 'no_request');
  reset role;
end $$;

-- C1679: no function is executable by public; every one is by authenticated; only signature_view is by anon.
do $$
declare f text; v_oid regprocedure;
begin
  foreach f in array array[
    'public.begin_signature_request(uuid, text, text)', 'public.complete_signature_request(uuid, text, jsonb, text, text)',
    'public.fail_signature_request(uuid)', 'public.signature_view(text)',
    'public.contractor_signing_source(uuid)', 'public.customer_signing_link(uuid)'
  ] loop
    v_oid := f::regprocedure;
    perform tests.ok('C1679 public ' || f, not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = v_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'), 'executable by public');
    perform tests.ok('C1679 authenticated ' || f, has_function_privilege('authenticated', v_oid, 'EXECUTE'), 'not executable by authenticated');
    perform tests.ok('C1679 anon ' || f, has_function_privilege('anon', v_oid, 'EXECUTE') = (f = 'public.signature_view(text)'), 'wrong anon grant');
  end loop;
end $$;

-- Round 2 of the verification (signature-provider checks C1721-C1723): the constraints the plan's Relations and door 9 name.
-- Runs p_sql as the table owner and requires it to fail with p_state on the constraint named p_constraint.
create function tests.sg_expect_constraint(p_label text, p_sql text, p_state text, p_constraint text) returns void
language plpgsql as $$
declare v_constraint text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_constraint = constraint_name;
    if sqlstate = p_state and v_constraint is not distinct from p_constraint then
      return;
    end if;
    raise exception '%: expected % on %, got % on % (%)', p_label, p_state, p_constraint, sqlstate, v_constraint, sqlerrm;
  end;
  raise exception '%: expected % on %, statement succeeded', p_label, p_state, p_constraint;
end $$;

-- C1721: contracts carries unique (id, org_id), and a request cannot name a contract of another org, nor a signer a request of another org.
do $$
declare c uuid := tests.sg_contract('sg21'); x uuid := tests.sg_contract('sg21x'); r uuid; k text := 'contracts_id_org_id_key';
begin
  r := tests.sg_begin(c);
  perform tests.ok('C1721 key', exists (select 1 from pg_constraint where conname = k and contype = 'u' and conrelid = 'public.contracts'::regclass),
    'contracts has no unique (id, org_id)');
  perform tests.ok('C1721 key columns', (select array_agg(a.attname::text order by a.attname) from pg_constraint x
      join pg_attribute a on a.attrelid = x.conrelid and a.attnum = any (x.conkey) where x.conname = k) = array['id', 'org_id'], 'wrong key columns');
  perform tests.sg_expect_constraint('C1721 request across orgs',
    format('insert into public.contract_signature_requests (org_id, contract_id) values (%L, %L)', tests.id('orgB'), x),
    '23503', 'contract_signature_requests_contract_id_org_id_fkey');
  perform tests.sg_expect_constraint('C1721 signer across orgs',
    format('update public.contract_signers set org_id = %L where request_id = %L and role = ''contractor''', tests.id('orgB'), r),
    '23503', 'contract_signers_request_id_org_id_fkey');
end $$;

-- C1722: one signer per role per request, a customer token hash is unique, a customer has a hash, only the customer has a link, and an open request holds its submission.
do $$
declare c uuid := tests.sg_contract('sg22a'); d uuid := tests.sg_contract('sg22b'); r uuid; q uuid;
begin
  r := tests.sg_begin(c);
  q := tests.sg_begin(d);
  perform tests.sg_expect_constraint('C1722 one signer per role',
    format('insert into public.contract_signers (request_id, org_id, role, name, email, token_hash) values (%L, %L, ''customer'', ''x'', ''x@example.test'', %L)', r, tests.id('orgA'), tests.sg_hash('another')),
    '23505', 'contract_signers_pkey');
  perform tests.sg_expect_constraint('C1722 token hash unique',
    format('update public.contract_signers set token_hash = %L where request_id = %L and role = ''customer''', tests.sg_hash(c::text), q),
    '23505', 'contract_signers_token_hash_key');
  perform tests.sg_expect_constraint('C1722 customer has a hash',
    format('update public.contract_signers set token_hash = null where request_id = %L and role = ''customer''', r),
    '23514', 'contract_signers_customer_has_link');
  perform tests.sg_expect_constraint('C1722 contractor has no hash',
    format('update public.contract_signers set token_hash = %L where request_id = %L and role = ''contractor''', tests.sg_hash('x'), r),
    '23514', 'contract_signers_customer_has_link');
  perform tests.sg_expect_constraint('C1722 only the customer has a link',
    format('update public.contract_signers set link_sealed = %L where request_id = %L and role = ''contractor''', tests.sg_sealed('l'), r),
    '23514', 'contract_signers_link_is_customers');
  perform tests.sg_expect_constraint('C1722 open holds its submission',
    format('update public.contract_signature_requests set status = ''open'' where id = %L', r),
    '23514', 'contract_signature_requests_open_has_document');
  perform tests.sg_expect_constraint('C1722 unknown status',
    format('update public.contract_signature_requests set status = ''signed'' where id = %L', r),
    '23514', 'contract_signature_requests_status_check');
end $$;

-- C1723: completing a request that is not being made is refused with the hint not_creating.
do $$
declare o uuid; f uuid;
begin
  o := tests.sg_open(tests.sg_contract('sg23o'));
  f := tests.sg_begin(tests.sg_contract('sg23f'));
  update public.contract_signature_requests set status = 'failed' where id = f;
  perform tests.act_as('uD');
  perform tests.expect_hint('C1723 open', format('select public.complete_signature_request(%L, ''1'', %L::jsonb, %L, %L)', o, tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '55000', 'not_creating');
  perform tests.expect_hint('C1723 failed', format('select public.complete_signature_request(%L, ''1'', %L::jsonb, %L, %L)', f, tests.sg_signers()::text, tests.sg_sealed('l'), repeat('a', 64)), '55000', 'not_creating');
  reset role;
end $$;

reset role;
rollback;
select 'transitions: pass' as result;
