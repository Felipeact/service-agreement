-- customer-portal, database side: C901-C907, C910, C911, C919-C928, C933, C939-C943, C945, C946; term-dates C1149, C1151, C1157, C1164;
-- proposal-expiry C1226-C1231, C1240, C1241. Run after fixture.sql in
-- the same execute_sql call (npm run test:db customer_portal). Fixture: org A owner uA, estimator uE, viewer uV;
-- org B owner uB; uX in no org (made an admin of org A below). Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

-- The SHA-256 hex a token would have; the tests use a readable name as the "token".
create function tests.cp_hash(p_token text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_token, 'UTF8')), 'hex') $$;

-- Counts or reads past RLS, whoever is signed in.
create function tests.dcount(p_sql text) returns bigint
language plpgsql security definer as $$
declare n bigint;
begin
  execute p_sql into n;
  return n;
end $$;

create function tests.dtext(p_sql text) returns text
language plpgsql security definer as $$
declare t text;
begin
  execute p_sql into t;
  return t;
end $$;

create table tests.cp_results (k text, v jsonb);
grant all on tests.cp_results to anon, authenticated;
grant execute on function tests.cp_hash(text), tests.dcount(text), tests.dtext(text) to anon, authenticated;

-- An agreement <name> in <status> on its own site, with version 1 and p_lines lines; its number is <name>.
create function tests.cp_agr(p_name text, p_status text default 'draft', p_org text default 'A', p_lines int default 2) returns uuid
language plpgsql as $$
begin
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name || ':site'), tests.id('org' || p_org), tests.id('cust' || p_org), 'Site ' || p_name);
  insert into public.agreements (id, org_id, site_id, status, number)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), p_status, p_name);
  -- term-dates door 4: a draft needs a start date to be sent.
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1, '2027-01-01');
  for i in 1 .. p_lines loop
    insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
    values (tests.id(p_name || ':l' || i), tests.id('org' || p_org), tests.id(p_name || ':v1'), i, p_name || ' line ' || i, '{3,6,9,12}', 4, 50000 * i);
  end loop;
  return tests.id(p_name);
end $$;

-- A sent agreement <name> with a live link whose token is <name>, sent by the org's estimator (org A) or owner (org B).
create function tests.cp_sent(p_name text, p_org text default 'A', p_lines int default 2) returns void
language plpgsql as $$
begin
  perform tests.cp_agr(p_name, 'draft', p_org, p_lines);
  perform tests.act_as(case p_org when 'A' then 'uE' else 'uB' end);
  perform public.send_agreement(tests.id(p_name), tests.cp_hash(p_name), 'agreement.sent', '{"from": "draft", "to": "sent"}');
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.cp_send_sql(p_name text, p_token text) returns text
language sql as $$
  select format('select public.send_agreement(%L, %L, ''agreement.sent'', ''{}'')', tests.id(p_name), tests.cp_hash(p_token))
$$;

create function tests.cp_decide_sql(p_token text, p_status text, p_event text, p_reason text default null) returns text
language sql as $$
  select format('select public.portal_decide(%L, %L, %L, %L::jsonb)', tests.cp_hash(p_token), p_status, p_event,
                case when p_reason is null then '{}' else jsonb_build_object('reason', p_reason)::text end)
$$;

create function tests.cp_status(p_name text) returns text
language sql security definer as $$ select status from public.agreements where id = tests.id(p_name) $$;

create function tests.cp_events(p_name text, p_type text) returns bigint
language sql security definer as $$
  select count(*) from public.events where entity_id = tests.id(p_name) and type = p_type
$$;

create function tests.cp_outbox(p_name text) returns bigint
language sql security definer as $$
  select count(*) from public.outbox o join public.events e on e.id = o.event_id and e.org_id = o.org_id where e.entity_id = tests.id(p_name)
$$;

create function tests.cp_links(p_name text) returns bigint
language sql security definer as $$
  select count(*) from public.portal_links l join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
  where v.agreement_id = tests.id(p_name)
$$;

create function tests.cp_live(p_name text) returns bigint
language sql security definer as $$
  select count(*) from public.portal_links l join public.agreement_versions v on v.id = l.agreement_version_id and v.org_id = l.org_id
  where v.agreement_id = tests.id(p_name) and l.revoked_at is null
$$;

create function tests.cp_snapshot(p_name text) returns jsonb
language sql security definer as $$ select snapshot from public.agreement_versions where id = tests.id(p_name || ':v1') $$;

grant execute on all functions in schema tests to anon, authenticated;

insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uX'), 'admin');

-- Settings of org A as a company would fill them. The first send below happens with the fixture's bare settings.
select tests.cp_agr('a933null');
select tests.act_as('uE');
do $$ begin
  perform public.send_agreement(tests.id('a933null'), tests.cp_hash('a933null'), 'agreement.sent', '{}');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- C933 (null terms): with the four nullable settings null each key is present with JSON null.
do $$ begin
  perform tests.ok('C933 nulls',
    tests.cp_snapshot('a933null') -> 'terms' = '{"repairDiscountPct": 0, "cpiCapPct": 0, "cancellationNoticeDays": null, "paymentDays": null, "governingProvince": null, "taxNote": null, "renewalNoticeDays": 30, "cpiRenegotiationThresholdPct": 5}'::jsonb,
    'bare settings do not freeze as eight keys with nulls: ' || tests.cp_snapshot('a933null')::text);
  perform tests.ok('C933 null keys present',
    (select count(*) from jsonb_object_keys(tests.cp_snapshot('a933null') -> 'terms')) = 8, 'not exactly 8 keys');
end $$;

update public.org_settings
set repair_discount_pct = 10, cpi_cap_pct = 5, cancellation_notice_days = 30, payment_days = 30,
    governing_province = 'BC', tax_note = 'GST extra'
where org_id = tests.id('orgA');

-- C901: the estimator, an owner and an admin each send a draft with 2 lines.
select tests.cp_agr('a901');
select tests.cp_agr('a901owner');
select tests.cp_agr('a901admin');
select tests.act_as('uE');
do $$ begin
  perform public.send_agreement(tests.id('a901'), tests.cp_hash('a901'), 'agreement.sent', '{"from": "draft", "to": "sent"}');
end $$;
reset role;
select tests.act_as('uA');
do $$ begin
  perform public.send_agreement(tests.id('a901owner'), tests.cp_hash('a901owner'), 'agreement.sent', '{}');
end $$;
reset role;
select tests.act_as('uX');
do $$ begin
  perform public.send_agreement(tests.id('a901admin'), tests.cp_hash('a901admin'), 'agreement.sent', '{}');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare n text;
begin
  foreach n in array array['a901', 'a901owner', 'a901admin'] loop
    perform tests.ok('C901 status ' || n, tests.cp_status(n) = 'sent', 'not sent');
    perform tests.ok('C901 link ' || n, tests.cp_links(n) = 1 and tests.cp_live(n) = 1
      and exists (select 1 from public.portal_links where token_hash = tests.cp_hash(n) and agreement_version_id = tests.id(n || ':v1')),
      'not exactly one live link with the given hash for version 1');
    perform tests.ok('C901 event ' || n, tests.cp_events(n, 'agreement.sent') = 1, 'not exactly one agreement.sent');
    perform tests.ok('C901 snapshot ' || n, tests.cp_snapshot(n) ? 'types' and tests.cp_snapshot(n) ? 'terms', 'snapshot lacks types or terms');
  end loop;
end $$;

-- C902: a version with 0 lines cannot be sent.
select tests.cp_agr('a902', 'draft', 'A', 0);
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C902', tests.cp_send_sql('a902', 'a902'), '23514');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C902 draft', tests.cp_status('a902') = 'draft', 'the agreement left draft');
  perform tests.ok('C902 no link', tests.cp_links('a902') = 0, 'a link was inserted');
  perform tests.ok('C902 no event', tests.cp_events('a902', 'agreement.sent') = 0, 'an event was written');
  perform tests.ok('C933 failed send', not (tests.cp_snapshot('a902') ? 'terms') and tests.cp_snapshot('a902') = '{}'::jsonb,
    'a failed send wrote a snapshot');
end $$;

-- C903: an agreement already sent, and two sends with two hashes.
select tests.cp_agr('a903sent', 'sent');
select tests.cp_agr('a903');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C903 sent', tests.cp_send_sql('a903sent', 'a903sent'), '40001');
  perform public.send_agreement(tests.id('a903'), tests.cp_hash('a903-first'), 'agreement.sent', '{}');
  perform tests.expect_error('C903 second', tests.cp_send_sql('a903', 'a903-second'), '40001');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C903 no link', tests.cp_links('a903sent') = 0, 'a link was inserted on a sent agreement');
  perform tests.ok('C903 one live', tests.cp_links('a903') = 1 and tests.cp_live('a903') = 1, 'two sends did not leave exactly 1 live link');
  perform tests.ok('C903 one event', tests.cp_events('a903', 'agreement.sent') = 1, 'two sends wrote two events');
end $$;

-- C904: reissue on a sent agreement; 40001 on draft, accepted and refused.
select tests.cp_sent('a904');
select tests.cp_agr('a904draft');
select tests.cp_agr('a904accepted', 'accepted');
select tests.cp_agr('a904refused', 'refused');
select tests.act_as('uE');
do $$ begin
  perform public.reissue_portal_link(tests.id('a904'), tests.cp_hash('a904-new'));
  perform tests.expect_error('C904 draft', format('select public.reissue_portal_link(%L, %L)', tests.id('a904draft'), tests.cp_hash('x1')), '40001');
  perform tests.expect_error('C904 accepted', format('select public.reissue_portal_link(%L, %L)', tests.id('a904accepted'), tests.cp_hash('x2')), '40001');
  perform tests.expect_error('C904 refused', format('select public.reissue_portal_link(%L, %L)', tests.id('a904refused'), tests.cp_hash('x3')), '40001');
  perform tests.expect_error('C904 missing', format('select public.reissue_portal_link(%L, %L)', tests.id('nothing'), tests.cp_hash('x4')), 'P0002');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C904 old revoked', (select revoked_at is not null from public.portal_links where token_hash = tests.cp_hash('a904')), 'old link not revoked');
  perform tests.ok('C904 new live',
    (select revoked_at is null and agreement_version_id = tests.id('a904:v1') from public.portal_links where token_hash = tests.cp_hash('a904-new')),
    'new link missing or not on the same version');
  perform tests.ok('C904 one live', tests.cp_links('a904') = 2 and tests.cp_live('a904') = 1, 'not 1 live of 2 links');
  perform tests.ok('C904 nothing else', tests.cp_links('a904draft') + tests.cp_links('a904accepted') + tests.cp_links('a904refused') = 0,
    'a refused reissue inserted a link');
  perform tests.ok('C904 statuses', tests.cp_status('a904draft') = 'draft' and tests.cp_status('a904accepted') = 'accepted'
    and tests.cp_status('a904refused') = 'refused', 'a refused reissue changed a status');
  perform tests.ok('C904 portal_view old',
    public.portal_view(tests.cp_hash('a904')) -> 'link' ->> 'revoked' = 'true'
    and (public.portal_view(tests.cp_hash('a904')) -> 'link' ->> 'revokedAt') is not null,
    'portal_view of the old hash does not show it revoked');
end $$;

-- C904 (roles): the org A owner and an admin (uX) reissue a sent agreement too.
select tests.cp_sent('a904owner');
select tests.cp_sent('a904admin');
select tests.act_as('uA');
do $$ begin
  perform public.reissue_portal_link(tests.id('a904owner'), tests.cp_hash('a904owner-new'));
end $$;
reset role;
select tests.act_as('uX');
do $$ begin
  perform public.reissue_portal_link(tests.id('a904admin'), tests.cp_hash('a904admin-new'));
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare n text;
begin
  foreach n in array array['a904owner', 'a904admin'] loop
    perform tests.ok('C904 role ' || n, tests.cp_links(n) = 2 and tests.cp_live(n) = 1
      and (select revoked_at is not null from public.portal_links where token_hash = tests.cp_hash(n))
      and (select revoked_at is null from public.portal_links where token_hash = tests.cp_hash(n || '-new')),
      'reissue by this role did not revoke the old link and leave 1 live');
  end loop;
end $$;

-- C906: a viewer can do neither, and nothing is written.
select tests.cp_agr('a906');
select tests.cp_sent('a906sent');
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C906 send', tests.cp_send_sql('a906', 'a906'), '42501');
  perform tests.expect_error('C906 reissue', format('select public.reissue_portal_link(%L, %L)', tests.id('a906sent'), tests.cp_hash('a906new')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C906 nothing written', tests.cp_status('a906') = 'draft' and tests.cp_links('a906') = 0
    and tests.cp_live('a906sent') = 1 and tests.cp_links('a906sent') = 1 and tests.cp_events('a906', 'agreement.sent') = 0,
    'a viewer changed something');
end $$;

-- C907: no column can hold a token, only the 64 hex characters of its hash.
do $$ begin
  perform tests.ok('C907 columns',
    (select array_agg(column_name::text order by column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'portal_links')
      = array['agreement_version_id', 'created_at', 'first_viewed_at', 'id', 'org_id', 'revoked_at', 'token_hash', 'token_sealed'],
    'portal_links has an unexpected column');
  perform tests.expect_error('C907 token refused',
    format('insert into public.portal_links (org_id, agreement_version_id, token_hash) values (%L, %L, %L)',
           tests.id('orgA'), tests.id('a901:v1'), repeat('A', 43)), '23514');
  perform tests.ok('C907 hash only',
    not exists (select 1 from public.portal_links where token_hash !~ '^[0-9a-f]{64}$'), 'a stored value is not a hash');
end $$;

-- C910: a malformed or unknown hash gives no link.
select tests.act_as_anon();
do $$
declare t text;
begin
  foreach t in array array['', repeat('a', 42), repeat('a', 44), repeat('a', 42) || '+', repeat('a', 42) || ' ', tests.cp_hash('nobody')] loop
    perform tests.ok('C910 ' || length(t), public.portal_view(t) is null, 'a link came back for ' || t);
  end loop;
end $$;
reset role;

-- C911: the terms are those frozen at send, not the settings of today.
update public.org_settings set repair_discount_pct = 15 where org_id = tests.id('orgA');
do $$ begin
  perform tests.ok('C911 frozen', (public.portal_view(tests.cp_hash('a901')) -> 'terms' ->> 'repairDiscountPct')::numeric = 10,
    'portal_view does not return the frozen repair discount');
  perform tests.ok('C933 terms', tests.cp_snapshot('a901') -> 'terms'
    = '{"repairDiscountPct": 10, "cpiCapPct": 5, "cancellationNoticeDays": 30, "paymentDays": 30, "governingProvince": "BC", "taxNote": "GST extra", "renewalNoticeDays": 30, "cpiRenegotiationThresholdPct": 5}'::jsonb,
    'the frozen terms are not the eight settings: ' || (tests.cp_snapshot('a901') -> 'terms')::text);
end $$;
update public.org_settings set repair_discount_pct = 10 where org_id = tests.id('orgA');

-- C933: a withdraw from draft freezes the same keys.
select tests.cp_agr('a933w');
select tests.act_as('uE');
do $$ begin
  perform public.apply_agreement_transition(tests.id('a933w'), 'draft', 'withdrawn', 'agreement.withdrawn', '{}');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C933 withdraw', (select array_agg(k order by k) from jsonb_object_keys(tests.cp_snapshot('a933w') -> 'terms') k)
    = array['cancellationNoticeDays', 'cpiCapPct', 'cpiRenegotiationThresholdPct', 'governingProvince', 'paymentDays',
            'renewalNoticeDays', 'repairDiscountPct', 'taxNote'],
    'a withdrawn draft did not freeze the eight terms');
end $$;

-- portal_view carries what the page and the PDF need.
do $$
declare d jsonb := public.portal_view(tests.cp_hash('a901'));
begin
  perform tests.ok('view tenant', d -> 'tenant' = '{"name": "Legal A", "address": null, "phone": null, "accent": null}'::jsonb, d ->> 'tenant');
  perform tests.ok('view agreement', d -> 'agreement' = '{"number": "a901", "status": "sent"}'::jsonb, d ->> 'agreement');
  perform tests.ok('view names', d -> 'customer' ->> 'name' = 'Customer A' and d -> 'site' ->> 'name' = 'Site a901', 'customer or site name');
  perform tests.ok('view lines', jsonb_array_length(d -> 'lines') = 2 and (d -> 'lines' -> 0 ->> 'annualCents')::bigint = 200000
    and (d ->> 'annualCents')::bigint = 600000, 'lines or total: ' || (d -> 'lines')::text);
  perform tests.ok('view link', (d -> 'link' ->> 'versionNo') = '1' and d -> 'link' ->> 'current' = 'true'
    and d -> 'link' ->> 'revoked' = 'false' and d -> 'link' -> 'firstViewedAt' = 'null'::jsonb, (d -> 'link')::text);
  perform tests.ok('view scope', d -> 'scope' ? 'types' and not (d -> 'scope' ? 'terms') and d -> 'decision' = 'null'::jsonb, 'scope or decision');
end $$;

-- C919: accept.
select tests.cp_sent('a919');
select tests.act_as_anon();
do $$ begin
  perform public.portal_decide(tests.cp_hash('a919'), 'accepted', 'agreement.accepted', '{}');
end $$;
reset role;
do $$ begin
  perform tests.ok('C919 status', tests.cp_status('a919') = 'accepted', 'not accepted');
  perform tests.ok('C919 event', tests.cp_events('a919', 'agreement.accepted') = 1
    and (select payload = '{"from": "sent", "to": "accepted", "versionNo": 1, "via": "portal"}'::jsonb and actor_id is null
         from public.events where entity_id = tests.id('a919') and type = 'agreement.accepted'),
    'the event payload or actor is wrong');
  perform tests.ok('C919 outbox', tests.dcount(format('select count(*) from public.outbox o join public.events e on e.id = o.event_id
    where e.entity_id = %L and e.type = ''agreement.accepted''', tests.id('a919'))) = 1, 'not exactly one outbox row for the decision');
  perform tests.ok('C919 view', public.portal_view(tests.cp_hash('a919')) -> 'decision' ->> 'status' = 'accepted', 'portal_view lacks the decision');
end $$;

-- C920: refuse and request changes, with a padded reason.
select tests.cp_sent('a920r');
select tests.cp_sent('a920c');
select tests.act_as_anon();
do $$ begin
  perform public.portal_decide(tests.cp_hash('a920r'), 'refused', 'agreement.refused', '{"reason": "  Too dear  ", "evil": 1, "via": "x"}');
  perform public.portal_decide(tests.cp_hash('a920c'), 'changes_requested', 'agreement.changes_requested', '{"reason": "  Too dear  "}');
end $$;
reset role;
do $$
declare r record;
begin
  for r in select * from (values ('a920r', 'refused'), ('a920c', 'changes_requested')) as x(n, s) loop
    perform tests.ok('C920 status ' || r.s, tests.cp_status(r.n) = r.s, 'wrong status');
    perform tests.ok('C920 event ' || r.s, (select payload = jsonb_build_object('from', 'sent', 'to', r.s, 'versionNo', 1, 'via', 'portal', 'reason', 'Too dear')
        from public.events where entity_id = tests.id(r.n) and type = 'agreement.' || r.s)
      and tests.cp_events(r.n, 'agreement.' || r.s) = 1, 'wrong payload for ' || r.s);
    perform tests.ok('C920 outbox ' || r.s, tests.dcount(format('select count(*) from public.outbox o join public.events e on e.id = o.event_id
      where e.entity_id = %L and e.type = %L', tests.id(r.n), 'agreement.' || r.s)) = 1, 'no outbox row');
  end loop;
end $$;

-- C921: empty, spaces and tab/newline reasons.
select tests.cp_sent('a921');
select tests.act_as_anon();
do $$
declare r text; s text; n int := 0;
begin
  foreach s in array array['refused', 'changes_requested'] loop
    foreach r in array array['', '   ', E' \t\n '] loop
      n := n + 1;
      perform tests.expect_error('C921 ' || s || n, tests.cp_decide_sql('a921', s, 'agreement.' || s, r), '23514');
    end loop;
  end loop;
  perform tests.expect_error('C921 no reason', tests.cp_decide_sql('a921', 'refused', 'agreement.refused'), '23514');
end $$;
reset role;
do $$ begin
  perform tests.ok('C921 nothing written', tests.cp_status('a921') = 'sent' and tests.cp_events('a921', 'agreement.refused') = 0
    and tests.cp_events('a921', 'agreement.changes_requested') = 0 and tests.cp_outbox('a921') = 1, 'a refused reason wrote something');
end $$;

-- C922: 2000 characters after trimming pass, 2001 fail, for both reason decisions.
select tests.cp_sent('a922r2000');
select tests.cp_sent('a922r2001');
select tests.cp_sent('a922c2000');
select tests.cp_sent('a922c2001');
select tests.act_as_anon();
do $$ begin
  perform public.portal_decide(tests.cp_hash('a922r2000'), 'refused', 'agreement.refused', jsonb_build_object('reason', ' ' || repeat('x', 2000) || ' '));
  perform public.portal_decide(tests.cp_hash('a922c2000'), 'changes_requested', 'agreement.changes_requested', jsonb_build_object('reason', repeat('x', 2000)));
  perform tests.expect_error('C922 refused 2001', tests.cp_decide_sql('a922r2001', 'refused', 'agreement.refused', repeat('x', 2001)), '23514');
  perform tests.expect_error('C922 changes 2001', tests.cp_decide_sql('a922c2001', 'changes_requested', 'agreement.changes_requested', repeat('x', 2001)), '23514');
end $$;
reset role;
do $$ begin
  perform tests.ok('C922 2000 accepted', tests.cp_status('a922r2000') = 'refused' and tests.cp_status('a922c2000') = 'changes_requested', '2000 characters were refused');
  perform tests.ok('C922 2001 refused', tests.cp_status('a922r2001') = 'sent' and tests.cp_status('a922c2001') = 'sent', '2001 characters were accepted');
  perform tests.ok('C922 reason stored trimmed',
    (select length(payload ->> 'reason') = 2000 from public.events where entity_id = tests.id('a922r2000') and type = 'agreement.refused'), 'reason not trimmed');
end $$;

-- C923: four ways a decision finds the link no longer open.
select tests.cp_sent('a923version');
select tests.cp_sent('a923withdrawn');
select tests.cp_sent('a923decided');
select tests.cp_sent('a923revoked');
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('a923version:v2'), tests.id('orgA'), tests.id('a923version'), 2);
update public.agreements set status = 'withdrawn' where id = tests.id('a923withdrawn');
update public.agreements set status = 'accepted' where id = tests.id('a923decided');
select tests.act_as('uE');
do $$ begin
  perform public.reissue_portal_link(tests.id('a923revoked'), tests.cp_hash('a923revoked-new'));
end $$;
reset role;
select tests.act_as_anon();
do $$
declare n text;
begin
  foreach n in array array['a923version', 'a923withdrawn', 'a923decided', 'a923revoked'] loop
    perform tests.expect_error('C923 ' || n, tests.cp_decide_sql(n, 'accepted', 'agreement.accepted'), '40001');
  end loop;
end $$;
reset role;
do $$
declare n text;
begin
  foreach n in array array['a923version', 'a923withdrawn', 'a923decided', 'a923revoked'] loop
    perform tests.ok('C923 no event ' || n, tests.cp_events(n, 'agreement.accepted') = 0, 'a decision event was written');
    perform tests.ok('C923 no outbox ' || n, tests.cp_outbox(n) = 1, 'an outbox row was written');
  end loop;
  perform tests.ok('C923 states', tests.cp_status('a923version') = 'sent' and tests.cp_status('a923withdrawn') = 'withdrawn'
    and tests.cp_status('a923revoked') = 'sent', 'a status changed');
  perform tests.ok('C923 view version', public.portal_view(tests.cp_hash('a923version')) -> 'link' ->> 'current' = 'false', 'link still current');
end $$;

-- C924: the same decision twice.
select tests.cp_sent('a924');
select tests.act_as_anon();
do $$ begin
  perform public.portal_decide(tests.cp_hash('a924'), 'accepted', 'agreement.accepted', '{}');
  perform tests.expect_error('C924 second', tests.cp_decide_sql('a924', 'accepted', 'agreement.accepted'), '40001');
end $$;
reset role;
do $$ begin
  perform tests.ok('C924 one event', tests.cp_events('a924', 'agreement.accepted') = 1, 'not exactly one decision event');
  perform tests.ok('C924 one outbox', tests.cp_outbox('a924') = 2, 'not exactly one decision outbox row (plus the send)');
end $$;

-- C925: portal_view writes nothing.
select tests.cp_sent('a925');
create table tests.cp_counts as
select (select count(*) from public.agreements) a, (select count(*) from public.portal_links) l,
       (select count(*) from public.events) e, (select count(*) from public.outbox) o;
grant select on tests.cp_counts to anon;
select tests.act_as_anon();
do $$ begin
  perform public.portal_view(tests.cp_hash('a925'));
  perform public.portal_view(tests.cp_hash('a925'));
  perform public.portal_view('nothing');
end $$;
reset role;
do $$ begin
  perform tests.ok('C925', (select (a, l, e, o) = (
      (select count(*) from public.agreements), (select count(*) from public.portal_links),
      (select count(*) from public.events), (select count(*) from public.outbox)) from tests.cp_counts),
    'portal_view changed a row count');
end $$;

-- C926: pairs outside the whitelist.
select tests.cp_sent('a926');
select tests.act_as_anon();
do $$
declare p text[];
begin
  foreach p slice 1 in array array[array['accepted', 'agreement.refused'], array['withdrawn', 'agreement.withdrawn'],
                                   array['sent', 'agreement.sent'], array['accepted', 'contract.completed'], array['', '']] loop
    perform tests.expect_error('C926 ' || p[1] || '/' || p[2], tests.cp_decide_sql('a926', p[1], p[2], 'a reason'), '42501');
  end loop;
end $$;
reset role;
do $$ begin
  perform tests.ok('C926 nothing written', tests.cp_status('a926') = 'sent' and tests.cp_outbox('a926') = 1
    and (select count(*) from public.events where entity_id = tests.id('a926')) = 1, 'a refused pair wrote something');
end $$;

-- C927 and C928: the first view.
select tests.cp_sent('a927');
select tests.act_as_anon();
do $$ begin
  perform public.portal_record_view(tests.cp_hash('a927'));
end $$;
reset role;
do $$ begin
  perform tests.ok('C927 stamp', (select first_viewed_at is not null from public.portal_links where token_hash = tests.cp_hash('a927')), 'link not stamped');
  perform tests.ok('C927 event', tests.cp_events('a927', 'agreement.viewed') = 1
    and (select payload = '{"versionNo": 1}'::jsonb and actor_id is null and entity_type = 'agreement'
         from public.events where entity_id = tests.id('a927') and type = 'agreement.viewed'), 'wrong viewed event');
  perform tests.ok('C927 no outbox', tests.cp_outbox('a927') = 1, 'the view reached the outbox');
end $$;

update public.portal_links set first_viewed_at = '2026-01-01T00:00:00+00' where token_hash = tests.cp_hash('a927');
select tests.cp_sent('a928revoked');
select tests.cp_sent('a928v2');
select tests.act_as('uE');
do $$ begin
  perform public.reissue_portal_link(tests.id('a928revoked'), tests.cp_hash('a928revoked-new'));
end $$;
reset role;
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('a928v2:v2'), tests.id('orgA'), tests.id('a928v2'), 2);
insert into public.portal_links (org_id, agreement_version_id, token_hash)
values (tests.id('orgA'), tests.id('a928v2:v2'), tests.cp_hash('a928v2-second'));
select tests.act_as_anon();
do $$ begin
  perform public.portal_record_view(tests.cp_hash('a927'));
  perform public.portal_record_view(tests.cp_hash('a927'));
  perform public.portal_record_view(tests.cp_hash('a928revoked'));
  perform public.portal_record_view(tests.cp_hash('a928v2'));
  perform public.portal_record_view(tests.cp_hash('a928v2-second'));
  perform public.portal_record_view('unknown');
end $$;
reset role;
do $$ begin
  perform tests.ok('C928 repeat', tests.cp_events('a927', 'agreement.viewed') = 1
    and (select first_viewed_at = '2026-01-01T00:00:00+00' from public.portal_links where token_hash = tests.cp_hash('a927')),
    'a second view wrote an event or moved the date');
  perform tests.ok('C928 revoked', tests.cp_events('a928revoked', 'agreement.viewed') = 0
    and (select first_viewed_at is null from public.portal_links where token_hash = tests.cp_hash('a928revoked')), 'a revoked link recorded a view');
  perform tests.ok('C928 other version', tests.cp_events('a928v2', 'agreement.viewed') = 2
    and exists (select 1 from public.events where entity_id = tests.id('a928v2') and type = 'agreement.viewed' and payload = '{"versionNo": 2}'::jsonb)
    and exists (select 1 from public.events where entity_id = tests.id('a928v2') and type = 'agreement.viewed' and payload = '{"versionNo": 1}'::jsonb),
    'each version link does not have its own first view');
end $$;

-- C939: anon and a signed-in member see the same document.
select tests.act_as_anon();
insert into tests.cp_results select 'anon', public.portal_view(tests.cp_hash('a901'));
reset role;
select tests.act_as('uE');
insert into tests.cp_results select 'member', public.portal_view(tests.cp_hash('a901'));
reset role;
select tests.act_as('uB');
insert into tests.cp_results select 'other org', public.portal_view(tests.cp_hash('a901'));
reset role;
do $$ begin
  perform tests.ok('C939', (select v from tests.cp_results where k = 'anon') = (select v from tests.cp_results where k = 'member')
    and (select v from tests.cp_results where k = 'anon') is not null
    and (select v from tests.cp_results where k = 'anon') = (select v from tests.cp_results where k = 'other org'),
    'anon, member and another org do not get the same document');
end $$;

-- C940: a link reaches only its own org and version.
select tests.cp_sent('a940');
select tests.cp_sent('b940', 'B');
select tests.cp_sent('a940v');
insert into public.agreement_versions (id, org_id, agreement_id, version_no) values (tests.id('a940v:v2'), tests.id('orgA'), tests.id('a940v'), 2);
insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
values (tests.id('a940v:l9'), tests.id('orgA'), tests.id('a940v:v2'), 1, 'Only in version 2', '{10}', 1, 100);
select tests.act_as_anon();
do $$
declare d jsonb := public.portal_view(tests.cp_hash('a940'));
begin
  perform tests.ok('C940 view', d -> 'agreement' ->> 'number' = 'a940' and d -> 'customer' ->> 'name' = 'Customer A', 'the view is not org A''s agreement');
  perform public.portal_record_view(tests.cp_hash('a940'));
  perform public.portal_decide(tests.cp_hash('a940'), 'accepted', 'agreement.accepted', '{}');
end $$;
reset role;
do $$
declare d jsonb := public.portal_view(tests.cp_hash('a940v'));
begin
  perform tests.ok('C940 org B untouched', tests.cp_status('b940') = 'sent' and tests.cp_events('b940', 'agreement.viewed') = 0
    and tests.cp_events('b940', 'agreement.accepted') = 0 and tests.cp_outbox('b940') = 1
    and (select first_viewed_at is null and revoked_at is null from public.portal_links where token_hash = tests.cp_hash('b940')),
    'org B''s agreement, link or events changed');
  perform tests.ok('C940 org A written', tests.cp_status('a940') = 'accepted' and tests.cp_events('a940', 'agreement.viewed') = 1, 'org A''s own link did nothing');
  perform tests.ok('C940 version 1 lines', jsonb_array_length(d -> 'lines') = 2, 'a version 1 hash returned version 2''s lines');
  perform tests.ok('C940 no version 2 text', not (d -> 'lines')::text like '%Only in version 2%', 'version 2''s line leaked');
  perform tests.ok('C940 total', (d ->> 'annualCents')::bigint = 600000, 'total includes version 2');
  perform tests.ok('C940 version', d -> 'link' ->> 'versionNo' = '1' and d -> 'link' ->> 'current' = 'false', 'link is not version 1, no longer current');
end $$;

-- C941: anon cannot call the staff functions or touch the tables.
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C941 send', tests.cp_send_sql('a933w', 'x'), '42501');
  perform tests.expect_error('C941 reissue', format('select public.reissue_portal_link(%L, %L)', tests.id('a904'), tests.cp_hash('y')), '42501');
  perform tests.expect_error('C941 select links', 'select count(*) from public.portal_links', '42501');
  perform tests.expect_error('C941 insert events',
    format('insert into public.events (org_id, entity_type, entity_id, type) values (%L, ''agreement'', %L, ''agreement.sent'')', tests.id('orgA'), tests.id('a904')), '42501');
  perform tests.expect_error('C941 update agreements', format('update public.agreements set status = ''accepted'' where id = %L', tests.id('a904')), '42501');
  perform tests.expect_error('C941 enqueue', format('select private.enqueue_outbox_for_system(%L)', tests.id('evtA')), '42501');
end $$;
reset role;

-- C942: the table.
select tests.cp_agr('a942');
select tests.cp_agr('a942b');
select tests.cp_agr('b942', 'draft', 'B');
do $$
declare v uuid := tests.id('a942:v1');
begin
  perform tests.ok('C942 rls', (select relrowsecurity from pg_class where oid = 'public.portal_links'::regclass), 'RLS is off');
  insert into public.portal_links (org_id, agreement_version_id, token_hash) values (tests.id('orgA'), v, tests.cp_hash('a942-1'));
  perform tests.expect_error('C942 token unique',
    format('insert into public.portal_links (org_id, agreement_version_id, token_hash) values (%L, %L, %L)', tests.id('orgA'), tests.id('a942b:v1'), tests.cp_hash('a942-1')), '23505');
  perform tests.expect_error('C942 one live',
    format('insert into public.portal_links (org_id, agreement_version_id, token_hash) values (%L, %L, %L)', tests.id('orgA'), v, tests.cp_hash('a942-2')), '23505');
  update public.portal_links set revoked_at = now() where token_hash = tests.cp_hash('a942-1');
  insert into public.portal_links (org_id, agreement_version_id, token_hash) values (tests.id('orgA'), v, tests.cp_hash('a942-2'));
  perform tests.expect_error('C942 cross-org version',
    format('insert into public.portal_links (org_id, agreement_version_id, token_hash) values (%L, %L, %L)', tests.id('orgA'), tests.id('b942:v1'), tests.cp_hash('a942-3')), '23503');
  perform tests.ok('C942 no write grants',
    not has_table_privilege('authenticated', 'public.portal_links', 'insert') and not has_table_privilege('authenticated', 'public.portal_links', 'update')
    and not has_table_privilege('authenticated', 'public.portal_links', 'delete') and not has_table_privilege('anon', 'public.portal_links', 'select'),
    'authenticated can write the table or anon can read it');
end $$;
insert into public.portal_links (org_id, agreement_version_id, token_hash) values (tests.id('orgB'), tests.id('b942:v1'), tests.cp_hash('b942'));
select tests.act_as('uE');
do $$ begin
  perform tests.ok('C942 member reads own',
    tests.count(format('select count(*) from public.portal_links where org_id = %L', tests.id('orgA'))) > 0, 'a member cannot read their links');
  perform tests.ok('C942 member blind to other org',
    tests.count(format('select count(*) from public.portal_links where org_id = %L', tests.id('orgB'))) = 0, 'a member reads another org''s links');
end $$;
reset role;

-- C943: door 2 as the catalogue sees it.
do $$
declare
  f text;
  o oid;
begin
  foreach f in array array['public.portal_view(text)', 'public.portal_record_view(text)', 'public.portal_decide(text, text, text, jsonb)'] loop
    o := f::regprocedure;
    perform tests.ok('C943 ' || f, (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = o)
      and has_function_privilege('anon', o, 'execute') and has_function_privilege('authenticated', o, 'execute'),
      f || ' is not a definer with an empty search_path executable by anon and authenticated');
    perform tests.ok('C943 public ' || f, not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = o and a.grantee = 0),
      f || ' is executable by public');
  end loop;
  foreach f in array array['public.send_agreement(uuid, text, text, jsonb)', 'public.reissue_portal_link(uuid, text)'] loop
    o := f::regprocedure;
    perform tests.ok('C943 ' || f, not (select prosecdef from pg_proc where oid = o)
      and has_function_privilege('authenticated', o, 'execute') and not has_function_privilege('anon', o, 'execute')
      and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = o and a.grantee = 0),
      f || ' is not an invoker for authenticated only');
  end loop;
end $$;

-- C943 (private helpers): org_terms is a definer reachable by no API role; issue_portal_link is a definer that the two
-- invoker functions call as authenticated, so it is executable by authenticated and not by anon or public.
do $$
declare o oid;
begin
  o := 'private.org_terms(uuid)'::regprocedure;
  perform tests.ok('C943 private.org_terms', (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = o)
    and not has_function_privilege('anon', o, 'execute') and not has_function_privilege('authenticated', o, 'execute')
    and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = o and a.grantee = 0),
    'private.org_terms is not a definer with an empty search_path closed to public, anon and authenticated');
  o := 'private.issue_portal_link(uuid, text)'::regprocedure;
  perform tests.ok('C943 private.issue_portal_link', (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = o)
    and has_function_privilege('authenticated', o, 'execute') and not has_function_privilege('anon', o, 'execute')
    and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = o and a.grantee = 0),
    'private.issue_portal_link is not a definer with an empty search_path executable by authenticated only');
end $$;

-- C945: door 5.
do $$
declare o oid := 'private.enqueue_outbox_for_system(uuid)'::regprocedure;
begin
  perform tests.ok('C945 definer', (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = o), 'not a definer with an empty search_path');
  perform tests.ok('C945 grants', not has_function_privilege('anon', o, 'execute') and not has_function_privilege('authenticated', o, 'execute')
    and not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = o and a.grantee = 0), 'executable by public, anon or authenticated');
end $$;

-- C946: send, view, view, accept.
select tests.cp_sent('a946');
select tests.act_as_anon();
do $$ begin
  perform public.portal_record_view(tests.cp_hash('a946'));
  perform public.portal_record_view(tests.cp_hash('a946'));
  perform public.portal_decide(tests.cp_hash('a946'), 'accepted', 'agreement.accepted', '{}');
end $$;
reset role;
do $$ begin
  perform tests.ok('C946 outbox by type',
    (select jsonb_object_agg(type, n) from (
       select e.type, count(o.id) as n from public.events e left join public.outbox o on o.event_id = e.id
       where e.entity_id = tests.id('a946') group by e.type) x)
      = '{"agreement.sent": 1, "agreement.accepted": 1, "agreement.viewed": 0}'::jsonb,
    'outbox rows per event type are not 1, 1, 0');
  perform tests.ok('C946 keys',
    (select array_agg(k order by k) from jsonb_object_keys((select payload from public.events where entity_id = tests.id('a946') and type = 'agreement.accepted')) k)
      = array['from', 'to', 'versionNo', 'via']
    and (select array_agg(k order by k) from jsonb_object_keys((select payload from public.events where entity_id = tests.id('a946') and type = 'agreement.viewed' limit 1)) k)
      = array['versionNo']
    and (select array_agg(k order by k) from jsonb_object_keys((select payload from public.events where entity_id = tests.id('a920r') and type = 'agreement.refused')) k)
      = array['from', 'reason', 'to', 'versionNo', 'via']
    and (select array_agg(k order by k) from jsonb_object_keys((select payload from public.events where entity_id = tests.id('a920c') and type = 'agreement.changes_requested')) k)
      = array['from', 'reason', 'to', 'versionNo', 'via'], 'payload keys differ from the plan');
end $$;

-- term-dates C1149, C1151, C1157, C1164 (doors 4, 5 and 7).
reset role;
select set_config('request.jwt.claims', '', true);
update public.org_settings set renewal_notice_days = 45, cpi_renegotiation_threshold_pct = 4.50 where org_id = tests.id('orgA');

-- C1149: no start date, no send, and nothing changes; with one, the same call sends.
select tests.cp_agr('a1149');
update public.agreement_versions set term_start = null where id = tests.id('a1149:v1');
create table tests.t1149 as select
  (select count(*) from public.events where entity_id = tests.id('a1149')) as events,
  (select count(*) from public.outbox o join public.events e on e.id = o.event_id where e.entity_id = tests.id('a1149')) as outbox,
  (select count(*) from public.portal_links where agreement_version_id = tests.id('a1149:v1')) as links;
create table tests.t1149hint (hint text);
grant all on tests.t1149hint to authenticated;
select tests.act_as('uE');
do $$
declare
  v_state text;
  v_hint text;
begin
  begin
    perform public.send_agreement(tests.id('a1149'), tests.cp_hash('a1149'), 'agreement.sent', '{}');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_hint = pg_exception_hint;
  end;
  perform tests.ok('C1149 refused', v_state = '23514', format('expected 23514, got %s', coalesce(v_state, 'success')));
  insert into tests.t1149hint values (v_hint);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1149 hint', (select hint from tests.t1149hint) = 'no_term_start', 'the refusal carries no no_term_start hint');
  perform tests.ok('C1149 status', (select status from public.agreements where id = tests.id('a1149')) = 'draft', 'the status changed');
  perform tests.ok('C1149 unchanged', (select t.events = (select count(*) from public.events where entity_id = tests.id('a1149'))
    and t.outbox = (select count(*) from public.outbox o join public.events e on e.id = o.event_id where e.entity_id = tests.id('a1149'))
    and t.links = (select count(*) from public.portal_links where agreement_version_id = tests.id('a1149:v1')) from tests.t1149 t),
    'a refused send wrote an event, an outbox row or a link');
end $$;
update public.agreement_versions set term_start = '2027-01-01' where id = tests.id('a1149:v1');
select tests.act_as('uE');
select public.send_agreement(tests.id('a1149'), tests.cp_hash('a1149'), 'agreement.sent', '{}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1149 sends with a start', (select status from public.agreements where id = tests.id('a1149')) = 'sent',
    'the send with a start date did not send');
end $$;

-- C1151: the send froze the two renewal settings beside the six terms, and a settings change leaves them.
create table tests.t1151 as select snapshot::text as s from public.agreement_versions where id = tests.id('a1149:v1');
update public.org_settings set renewal_notice_days = 60, cpi_renegotiation_threshold_pct = 7 where org_id = tests.id('orgA');
do $$
declare t jsonb := (select snapshot -> 'terms' from public.agreement_versions where id = tests.id('a1149:v1'));
begin
  perform tests.ok('C1151 keys', t ?& array['repairDiscountPct', 'cpiCapPct', 'cancellationNoticeDays', 'paymentDays',
    'governingProvince', 'taxNote', 'renewalNoticeDays', 'cpiRenegotiationThresholdPct'], 'the frozen terms lack a key');
  perform tests.ok('C1151 values', (t ->> 'renewalNoticeDays')::int = 45 and (t ->> 'cpiRenegotiationThresholdPct')::numeric = 4.50,
    'the frozen renewal values are not the settings at send');
  perform tests.ok('C1151 frozen', (select snapshot::text from public.agreement_versions where id = tests.id('a1149:v1'))
    = (select s from tests.t1151), 'a settings change altered the frozen snapshot');
end $$;

-- C1157: portal_view carries the term, with nulls for a version with no start.
select tests.cp_sent('a1157');
update public.agreement_versions set term_start = null where id = tests.id('a1157:v1');
create table tests.t1157 (set_view jsonb, null_view jsonb);
grant all on tests.t1157 to anon;
select tests.act_as_anon();
insert into tests.t1157 select public.portal_view(tests.cp_hash('a1149')), public.portal_view(tests.cp_hash('a1157'));
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1157 term', (select set_view -> 'term' from tests.t1157) = '{"start": "2027-01-01", "months": 12, "end": "2027-12-31"}'::jsonb,
    'portal_view term is not {start 2027-01-01, months 12, end 2027-12-31}');
  perform tests.ok('C1157 renewal keys', (select set_view -> 'terms' ?& array['renewalNoticeDays', 'cpiRenegotiationThresholdPct'] from tests.t1157),
    'portal_view terms lack the renewal keys');
  perform tests.ok('C1157 no start', (select null_view -> 'term' from tests.t1157) = '{"start": null, "months": 12, "end": null}'::jsonb,
    'portal_view term for a version with no start is not {start null, months 12, end null}');
end $$;

-- C1164: no service line still refuses with no hint, with or without a start date.
select tests.cp_agr('a1164', 'draft', 'A', 0);
select tests.cp_agr('a1164none', 'draft', 'A', 0);
update public.agreement_versions set term_start = null where id = tests.id('a1164none:v1');
create table tests.t1164 (name text, state text, hint text);
grant all on tests.t1164 to authenticated;
select tests.act_as('uE');
do $$
declare
  n text;
  v_state text;
  v_hint text;
begin
  foreach n in array array['a1164', 'a1164none'] loop
    v_state := null;
    v_hint := null;
    begin
      perform public.send_agreement(tests.id(n), tests.cp_hash(n), 'agreement.sent', '{}');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_hint = pg_exception_hint;
    end;
    insert into tests.t1164 values (n, v_state, v_hint);
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1164 no lines', (select count(*) = 2 from tests.t1164 where state = '23514' and coalesce(hint, '') = ''),
    'a send with no line did not refuse 23514 with no hint');
end $$;

-- Proposal expiry (.specs/features/proposal-expiry/checks.md): C1226-C1231, C1240, C1241. T is today in
-- America/Vancouver.
create function tests.pe_today() returns date
language sql stable as $$ select (now() at time zone 'America/Vancouver')::date $$;

create function tests.pe_valid(p_name text, p_version int default 1) returns date
language sql security definer as $$
  select valid_until from public.agreement_versions where agreement_id = tests.id(p_name) and version_no = p_version
$$;
-- The SQLSTATE a statement raises, or 'ok'.
create function tests.od_state_cp(p_sql text) returns text
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return sqlstate;
  end;
  return 'ok';
end $$;
grant execute on function tests.pe_today(), tests.pe_valid(text, int), tests.od_state_cp(text) to anon, authenticated;

-- C1226: send stamps T + the org's days on the latest version only.
select tests.cp_sent('pe1226');
update public.org_settings set proposal_validity_days = 14 where org_id = tests.id('orgA');
select tests.cp_sent('pe1226b');
update public.org_settings set proposal_validity_days = 30 where org_id = tests.id('orgA');
select tests.cp_agr('pe1226c');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start)
values (tests.id('pe1226c:v2'), tests.id('orgA'), tests.id('pe1226c'), 2, '2027-01-01');
insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
values (tests.id('orgA'), tests.id('pe1226c:v2'), 1, 'pe1226c v2 line', '{4,10}', 2, 30000);
select tests.act_as('uE');
select public.send_agreement(tests.id('pe1226c'), tests.cp_hash('pe1226c'), 'agreement.sent', '{"from": "draft", "to": "sent"}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1226 30 days', tests.pe_valid('pe1226') = tests.pe_today() + 30,
    'got ' || coalesce(tests.pe_valid('pe1226')::text, 'null'));
  perform tests.ok('C1226 14 days', tests.pe_valid('pe1226b') = tests.pe_today() + 14,
    'got ' || coalesce(tests.pe_valid('pe1226b')::text, 'null'));
  perform tests.ok('C1226 latest only', tests.pe_valid('pe1226c', 2) = tests.pe_today() + 30
    and tests.pe_valid('pe1226c', 1) is null, 'v1 ' || coalesce(tests.pe_valid('pe1226c', 1)::text, 'null')
    || ', v2 ' || coalesce(tests.pe_valid('pe1226c', 2)::text, 'null'));
end $$;

-- C1227: changing the setting after a send leaves the date alone.
select tests.cp_sent('pe1227');
update public.org_settings set proposal_validity_days = 7 where org_id = tests.id('orgA');
do $$ begin
  perform tests.ok('C1227 unchanged', tests.pe_valid('pe1227') = tests.pe_today() + 30,
    'got ' || coalesce(tests.pe_valid('pe1227')::text, 'null'));
end $$;
update public.org_settings set proposal_validity_days = 30 where org_id = tests.id('orgA');

-- C1228: a new link keeps the date.
select tests.cp_sent('pe1228');
update public.agreement_versions set valid_until = '2027-01-15' where agreement_id = tests.id('pe1228');
select tests.act_as('uE');
select public.reissue_portal_link(tests.id('pe1228'), tests.cp_hash('pe1228-new'));
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1228 unchanged', tests.pe_valid('pe1228') = '2027-01-15',
    'got ' || coalesce(tests.pe_valid('pe1228')::text, 'null'));
end $$;

-- C1229: revise starts version 2 with no date and keeps version 1's; sending version 2 stamps version 2 only.
select tests.cp_sent('pe1229');
update public.agreement_versions set valid_until = '2027-01-20' where agreement_id = tests.id('pe1229');
select tests.act_as_anon();
select public.portal_decide(tests.cp_hash('pe1229'), 'changes_requested', 'agreement.changes_requested', '{"reason": "fewer visits"}');
select tests.act_as('uE');
select public.apply_agreement_transition(tests.id('pe1229'), 'changes_requested', 'draft', 'agreement.revised',
  '{"from": "changes_requested", "to": "draft"}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1229 v2 null', (select count(*) from public.agreement_versions where agreement_id = tests.id('pe1229')) = 2
    and tests.pe_valid('pe1229', 2) is null, 'v2 ' || coalesce(tests.pe_valid('pe1229', 2)::text, 'null'));
  perform tests.ok('C1229 v1 kept', tests.pe_valid('pe1229', 1) = '2027-01-20', 'v1 changed');
end $$;
select tests.act_as('uE');
select public.send_agreement(tests.id('pe1229'), tests.cp_hash('pe1229-v2'), 'agreement.sent', '{"from": "draft", "to": "sent"}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1229 v2 sent', tests.pe_valid('pe1229', 2) = tests.pe_today() + 30,
    'v2 ' || coalesce(tests.pe_valid('pe1229', 2)::text, 'null'));
  perform tests.ok('C1229 v1 still kept', tests.pe_valid('pe1229', 1) = '2027-01-20', 'v1 changed on the second send');
end $$;

-- C1230: no member writes the date, the owner included.
select tests.cp_sent('pe1230');
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1230 owner update', format(
    'update public.agreement_versions set valid_until = ''2030-01-01'' where id = %L', tests.id('pe1230:v1')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1230 unchanged', tests.pe_valid('pe1230') = tests.pe_today() + 30, 'the date changed');
end $$;

-- C1231: a failed send stamps nothing.
select tests.cp_agr('pe1231a', 'draft', 'A', 0);
select tests.cp_agr('pe1231b');
update public.agreement_versions set term_start = null where agreement_id = tests.id('pe1231b');
select tests.cp_sent('pe1231c');
update public.agreement_versions set valid_until = null where agreement_id = tests.id('pe1231c');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1231 no line', tests.cp_send_sql('pe1231a', 'pe1231a'), '23514');
  perform tests.expect_error('C1231 no term start', tests.cp_send_sql('pe1231b', 'pe1231b'), '23514');
  perform tests.expect_error('C1231 already sent', tests.cp_send_sql('pe1231c', 'pe1231c-again'), '40001');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1231 none stamped', (select count(*) from public.agreement_versions
    where agreement_id in (tests.id('pe1231a'), tests.id('pe1231b'), tests.id('pe1231c')) and valid_until is not null) = 0,
    'a failed send stamped a date');
end $$;

-- C1240: the review page gets the version's date and today in America/Vancouver.
select tests.cp_sent('pe1240');
update public.agreement_versions set valid_until = '2027-01-15' where agreement_id = tests.id('pe1240');
select tests.cp_sent('pe1240n');
update public.agreement_versions set valid_until = null where agreement_id = tests.id('pe1240n');
select tests.act_as_anon();
do $$
declare
  v jsonb := public.portal_view(tests.cp_hash('pe1240'));
  n jsonb := public.portal_view(tests.cp_hash('pe1240n'));
begin
  perform tests.ok('C1240 date', v -> 'version' ->> 'validUntil' = '2027-01-15', 'version ' || coalesce((v -> 'version')::text, 'none'));
  perform tests.ok('C1240 today', v ->> 'today' = to_char(tests.pe_today(), 'YYYY-MM-DD'), 'today ' || coalesce(v ->> 'today', 'none'));
  perform tests.ok('C1240 null', n -> 'version' -> 'validUntil' = 'null'::jsonb, 'version ' || coalesce((n -> 'version')::text, 'none'));
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- C1241: no decision after the date; on the date, and with no date, a decision goes through.
select tests.cp_sent('pe1241a');
select tests.cp_sent('pe1241r');
select tests.cp_sent('pe1241c');
select tests.cp_sent('pe1241t');
select tests.cp_sent('pe1241n');
update public.agreement_versions set valid_until = tests.pe_today() - 1
where agreement_id in (tests.id('pe1241a'), tests.id('pe1241r'), tests.id('pe1241c'));
update public.agreement_versions set valid_until = tests.pe_today() where agreement_id = tests.id('pe1241t');
update public.agreement_versions set valid_until = null where agreement_id = tests.id('pe1241n');
create table tests.t1241 (outbox_before bigint);
grant all on tests.t1241 to anon, authenticated;
insert into tests.t1241 select count(*) from public.outbox;
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C1241 accept past', tests.cp_decide_sql('pe1241a', 'accepted', 'agreement.accepted'), '40001');
  perform tests.expect_error('C1241 refuse past', tests.cp_decide_sql('pe1241r', 'refused', 'agreement.refused', 'too late'), '40001');
  perform tests.expect_error('C1241 changes past',
    tests.cp_decide_sql('pe1241c', 'changes_requested', 'agreement.changes_requested', 'too late'), '40001');
  perform tests.ok('C1241 on the date', tests.od_state_cp(tests.cp_decide_sql('pe1241t', 'accepted', 'agreement.accepted')) = 'ok',
    'a decision on the date was refused');
  perform tests.ok('C1241 no date', tests.od_state_cp(tests.cp_decide_sql('pe1241n', 'accepted', 'agreement.accepted')) = 'ok',
    'a decision with no date was refused');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1241 still sent', tests.cp_status('pe1241a') = 'sent' and tests.cp_status('pe1241r') = 'sent'
    and tests.cp_status('pe1241c') = 'sent', 'a refused decision changed a status');
  perform tests.ok('C1241 no events', tests.cp_events('pe1241a', 'agreement.accepted') + tests.cp_events('pe1241r', 'agreement.refused')
    + tests.cp_events('pe1241c', 'agreement.changes_requested') = 0, 'a refused decision wrote an event');
  perform tests.ok('C1241 no outbox', (select count(*) from public.outbox) = (select outbox_before from tests.t1241) + 2,
    'outbox grew by ' || ((select count(*) from public.outbox) - (select outbox_before from tests.t1241)) || ', expected 2 (the two accepted)');
  perform tests.ok('C1241 accepted', tests.cp_status('pe1241t') = 'accepted' and tests.cp_status('pe1241n') = 'accepted',
    'the allowed decisions did not land');
end $$;

rollback;
select 'customer_portal: pass' as result;
