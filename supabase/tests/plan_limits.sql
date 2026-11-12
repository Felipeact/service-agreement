-- plan-limits, database side: C5100-C5109, C5120-C5124, C5140-C5142 (.specs/features/plan-limits/checks.md).
-- Run after fixture.sql and the migration in the same execute_sql call (npm run test:db plan_limits): the recipe puts
-- 20261112220000_plan_limits.sql between them, inside the rolled-back transaction, so the hosted project needs no change.
-- Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB; uX has no membership. agrA is a draft on siteA.
-- Expected values come from the plan, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

-- A site of its own in an org, so the one-live-per-site index never decides a case.
create function tests.pl_site(p_name text, p_org text default 'A') returns uuid
language sql as $$
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id('cust' || p_org), p_name)
  returning id
$$;

-- An agreement in a status of its own on its own site, made as the table owner.
create function tests.pl_agr(p_name text, p_status text, p_org text default 'A') returns uuid
language plpgsql as $$
begin
  perform tests.pl_site(p_name || ':site', p_org);
  insert into public.agreements (id, org_id, site_id, status)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1);
  return tests.id(p_name);
end $$;

-- A parsed import job of an org.
create function tests.pl_job(p_name text, p_org text default 'A') returns uuid
language sql as $$
  insert into public.import_jobs (id, org_id, site_id, original_name, content_type, size_bytes, status, table_count, row_count, read_at)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id('site' || p_org), p_name || '.csv', 'text/csv', 100, 'parsed', 1, 4, now())
  returning id
$$;

-- The first instant of this month in America/Vancouver, written without the migration's helper.
create function tests.pl_month() returns timestamptz
language sql stable as $$
  select date_trunc('month', now() at time zone 'America/Vancouver') at time zone 'America/Vancouver'
$$;

-- Runs create_agreement as the estimator and returns hint and detail of a refusal, or 'ok'.
create function tests.pl_create(p_site text, p_user text default 'uE') returns text
language plpgsql as $$
declare v_hint text; v_detail text; v_state text;
begin
  perform tests.act_as(p_user);
  begin
    perform public.create_agreement(tests.id(p_site));
    reset role;
    return 'ok';
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint, v_detail = pg_exception_detail;
    v_state := sqlstate;
    reset role;
    return v_state || '/' || coalesce(v_hint, '') || '/' || coalesce(v_detail, '');
  end;
end $$;

-- Org A holds a starter subscription; org B has none until C5108.
insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
values (tests.id('orgA'), 'cus_pl_a', 'sub_pl_a', 'starter', 2, array['hvac'], false);

-- C5107: the seeded limits are the draft price table.
do $$
declare r record;
begin
  perform tests.ok('C5107 starter', (select live_agreements = 15 and ai_imports = 10 from private.plan_limits where plan = 'starter'), 'starter is not 15 and 10');
  perform tests.ok('C5107 team', (select live_agreements = 60 and ai_imports = 40 from private.plan_limits where plan = 'team'), 'team is not 60 and 40');
  perform tests.ok('C5107 business', (select live_agreements = 200 and ai_imports = 120 from private.plan_limits where plan = 'business'), 'business is not 200 and 120');
  perform tests.ok('C5107 three rows', (select count(*) from private.plan_limits) = 3, 'plan_limits does not hold exactly three plans');
end $$;

-- C5109: members cannot read the limits.
do $$
begin
  perform tests.ok('C5109 authenticated', not has_table_privilege('authenticated', 'private.plan_limits', 'select'), 'authenticated can read plan_limits');
  perform tests.ok('C5109 anon', not has_table_privilege('anon', 'private.plan_limits', 'select'), 'anon can read plan_limits');
end $$;

-- From here the starter plan allows 2 live agreements and 2 AI imports, so the cases stay small.
update private.plan_limits set live_agreements = 2, ai_imports = 2 where plan = 'starter';

-- C5101, C5100, C5104: org A holds 1 live agreement (agrA). A create at 1 succeeds, a create at 2 is refused with the
-- plan, the limit and the count, and the refusal writes nothing.
select tests.pl_site('s5101a');
select tests.pl_site('s5101b');
do $$
declare
  agr_before bigint;
  ver_before bigint;
  r text;
begin
  perform tests.ok('C5101 at limit - 1', tests.pl_create('s5101a') = 'ok', 'a create at 1 of 2 was refused');
  perform tests.ok('C5101 created', (select count(*) from public.agreements where site_id = tests.id('s5101a')) = 1, 'no agreement on the site');
  select count(*) into agr_before from public.agreements where org_id = tests.id('orgA');
  select count(*) into ver_before from public.agreement_versions where org_id = tests.id('orgA');
  r := tests.pl_create('s5101b');
  perform tests.ok('C5100 refused', split_part(r, '/', 1) = '55000' and split_part(r, '/', 2) = 'plan_limit_agreements', 'answered ' || r);
  perform tests.ok('C5100 no agreement', (select count(*) from public.agreements where org_id = tests.id('orgA')) = agr_before, 'a refused create inserted an agreement');
  perform tests.ok('C5100 no version', (select count(*) from public.agreement_versions where org_id = tests.id('orgA')) = ver_before, 'a refused create inserted a version');
  perform tests.ok('C5101 at limit', split_part(r, '/', 1) = '55000', 'a create at 2 of 2 was not refused');
  perform tests.ok('C5104 detail', split_part(r, '/', 3) = 'starter|2|2', 'detail is ' || split_part(r, '/', 3));
end $$;

-- C5106: a downgrade leaves org A over its limit (limit 1 against 2 live agreements). The existing agreements stay editable
-- and only a create is refused.
update private.plan_limits set live_agreements = 1 where plan = 'starter';
select tests.act_as('uE');
do $$
begin
  perform tests.expect_rows('C5106 edit', format('update public.service_lines set description = ''Edited'' where id = %L', tests.id('lineA')), 1);
end $$;
reset role;
select tests.pl_site('s5106');
do $$
begin
  perform tests.ok('C5106 create refused', split_part(tests.pl_create('s5106'), '/', 2) = 'plan_limit_agreements', 'a create over the limit was allowed');
  perform tests.ok('C5104 limit and count differ', split_part(tests.pl_create('s5106'), '/', 3) = 'starter|1|2', 'detail is ' || split_part(tests.pl_create('s5106'), '/', 3));
end $$;

-- C5105: the renewal job still creates its draft for an org over its limit.
select tests.rn_agreement('r5105');
select private.run_renewals('2027-12-01');
do $$
begin
  perform tests.ok('C5105 renewal draft', exists (select 1 from public.agreements where renews_agreement_id = tests.id('r5105') and status = 'draft'),
    'no renewal draft for an org at its limit');
  perform tests.ok('C5105 over the limit', (select count(*) from public.agreements where org_id = tests.id('orgA') and status in ('draft', 'sent', 'changes_requested')) > 1,
    'the org is not over its limit');
end $$;

-- C5102: with every agreement of org A out of the way and the limit at 1, the four non-live statuses do not count and each
-- of the three live statuses does.
update public.agreements set status = 'withdrawn' where org_id = tests.id('orgA') and status in ('draft', 'sent', 'changes_requested');
select tests.pl_agr('n5102a', 'accepted');
select tests.pl_agr('n5102b', 'refused');
select tests.pl_agr('n5102c', 'expired');
select tests.pl_agr('n5102d', 'withdrawn');
select tests.pl_site('s5102');
select tests.pl_site('s5102x');
do $$
declare s text;
begin
  perform tests.ok('C5102 non-live statuses', tests.pl_create('s5102') = 'ok', 'accepted, refused, expired and withdrawn counted toward the limit');
  foreach s in array array['draft', 'sent', 'changes_requested'] loop
    update public.agreements set status = s where site_id = tests.id('s5102');
    perform tests.ok('C5102 ' || s, split_part(tests.pl_create('s5102x'), '/', 2) = 'plan_limit_agreements', s || ' did not count toward the limit');
  end loop;
end $$;

-- C5103: an org with no billing row has no limit, even with every plan's limit at 1.
update private.plan_limits set live_agreements = 1;
select tests.pl_site('s5103a', 'B');
select tests.pl_site('s5103b', 'B');
select tests.pl_site('s5103c', 'B');
do $$
begin
  perform tests.ok('C5103 first', tests.pl_create('s5103a', 'uB') = 'ok', 'org B was limited');
  perform tests.ok('C5103 second', tests.pl_create('s5103b', 'uB') = 'ok', 'org B was limited');
  perform tests.ok('C5103 third', tests.pl_create('s5103c', 'uB') = 'ok', 'org B was limited');
end $$;

-- C5120: the first chunk stamps the job once. The stamp is moved to a known old instant so the later calls can be seen to
-- leave it alone.
select tests.pl_job('j5120');
select tests.act_as('uE');
do $$
begin
  perform public.record_extraction_chunk(tests.id('j5120'), null, 3, '[]'::jsonb);
  perform tests.ok('C5120 stamped', (select extract_started_at is not null from public.import_jobs where id = tests.id('j5120')), 'the first chunk set no stamp');
end $$;
reset role;
update public.import_jobs set extract_started_at = '2020-01-15 12:00:00+00' where id = tests.id('j5120');
select tests.act_as('uE');
do $$
begin
  perform public.record_extraction_chunk(tests.id('j5120'), 1, 3, '[]'::jsonb);
  perform tests.ok('C5120 second chunk', (select extract_started_at = '2020-01-15 12:00:00+00' from public.import_jobs where id = tests.id('j5120')), 'a later chunk moved the stamp');
  perform tests.expect_error('C5120 stale retry', format('select public.record_extraction_chunk(%L, null, 3, ''[]''::jsonb)', tests.id('j5120')), '40001');
end $$;
do $$
begin
  perform tests.ok('C5120 retry', (select extract_started_at = '2020-01-15 12:00:00+00' from public.import_jobs where id = tests.id('j5120')), 'a stale retry moved the stamp');
end $$;

-- C5121: the allowance is 2 for starter. j5120 is stamped long ago, so it does not count.
reset role;
update private.plan_limits set ai_imports = 2 where plan = 'starter';
select tests.pl_job('q5121');
select tests.pl_job('s5121a');
select tests.pl_job('s5121b');
update public.import_jobs set extract_started_at = now() where id = tests.id('s5121a');
select tests.act_as('uE');
do $$
declare a jsonb;
begin
  a := public.import_allowance(tests.id('q5121'));
  perform tests.ok('C5121 one used', (a ->> 'used')::int = 1 and (a ->> 'limit')::int = 2 and (a ->> 'allowed')::boolean and a ->> 'plan' = 'starter', 'answered ' || a::text);
end $$;
reset role;
update public.import_jobs set extract_started_at = now() where id = tests.id('s5121b');
select tests.act_as('uE');
do $$
declare a jsonb;
begin
  a := public.import_allowance(tests.id('q5121'));
  perform tests.ok('C5121 two used', (a ->> 'used')::int = 2 and (a ->> 'limit')::int = 2 and not (a ->> 'allowed')::boolean, 'answered ' || a::text);
end $$;

-- C5122: the edges of the month in America/Vancouver. Starter's allowance is raised so every case answers `used`.
reset role;
update private.plan_limits set ai_imports = 50 where plan = 'starter';
update public.import_jobs set extract_started_at = null where org_id = tests.id('orgA');
select tests.pl_job('e5122a');
select tests.pl_job('e5122b');
select tests.pl_job('e5122c');
select tests.pl_job('e5122d');
select tests.pl_job('e5122e');
update public.import_jobs set extract_started_at = tests.pl_month() - interval '7 hours' where id = tests.id('e5122a');
update public.import_jobs set extract_started_at = tests.pl_month() - interval '1 second' where id = tests.id('e5122b');
update public.import_jobs set extract_started_at = tests.pl_month() where id = tests.id('e5122c');
update public.import_jobs set extract_started_at = (tests.pl_month() at time zone 'America/Vancouver' + interval '1 month') at time zone 'America/Vancouver' - interval '1 second' where id = tests.id('e5122d');
update public.import_jobs set extract_started_at = (tests.pl_month() at time zone 'America/Vancouver' + interval '1 month') at time zone 'America/Vancouver' where id = tests.id('e5122e');
select tests.act_as('uE');
do $$
declare a jsonb;
begin
  a := public.import_allowance(tests.id('q5121'));
  perform tests.ok('C5122 edges', (a ->> 'used')::int = 2, 'counted ' || (a ->> 'used') || ' of 5 edge jobs; only the first instant and the last second of the month count');
  perform tests.ok('C5122 resets on', (a ->> 'resets_on')::date = ((tests.pl_month() at time zone 'America/Vancouver' + interval '1 month')::date), 'resets_on is ' || (a ->> 'resets_on'));
end $$;

-- C5123: an org with no billing row is always allowed, with no limit.
reset role;
select tests.pl_job('q5123', 'B');
select tests.act_as('uB');
do $$
declare a jsonb;
begin
  a := public.import_allowance(tests.id('q5123'));
  perform tests.ok('C5123 allowed', (a ->> 'allowed')::boolean and a -> 'limit' = 'null'::jsonb and a -> 'plan' = 'null'::jsonb, 'answered ' || a::text);
end $$;

-- C5121: an admin may ask too (the estimator is promoted inside the transaction).
reset role;
update public.memberships set role = 'admin' where user_id = tests.id('uE') and org_id = tests.id('orgA');
select tests.act_as('uE');
do $$
begin
  perform tests.ok('C5121 admin', (public.import_allowance(tests.id('q5121')) ->> 'plan') = 'starter', 'an admin could not ask the allowance');
end $$;
reset role;
update public.memberships set role = 'estimator' where user_id = tests.id('uE') and org_id = tests.id('orgA');

-- C5124: a viewer is refused, and a non-member, another org's member and a missing job find nothing.
select tests.act_as('uV');
select tests.expect_error('C5124 viewer', format('select public.import_allowance(%L)', tests.id('q5121')), '42501');
select tests.act_as('uX');
select tests.expect_error('C5124 non-member', format('select public.import_allowance(%L)', tests.id('q5121')), 'P0002');
select tests.act_as('uB');
select tests.expect_error('C5124 other org', format('select public.import_allowance(%L)', tests.id('q5121')), 'P0002');
select tests.act_as('uE');
select tests.expect_error('C5124 missing', 'select public.import_allowance(''00000000-0000-4000-8000-00000000dead'')', 'P0002');
reset role;

-- C5140: usage of org A with three live agreements and two imports started this month, against the seeded starter limits.
update private.plan_limits set live_agreements = 15, ai_imports = 10 where plan = 'starter';
update public.agreements set status = 'withdrawn' where org_id = tests.id('orgA') and status in ('draft', 'sent', 'changes_requested');
select tests.pl_agr('u5140a', 'draft');
select tests.pl_agr('u5140b', 'sent');
select tests.pl_agr('u5140c', 'changes_requested');
update public.import_jobs set extract_started_at = null where org_id = tests.id('orgA');
update public.import_jobs set extract_started_at = now() where id in (tests.id('s5121a'), tests.id('s5121b'));
update public.import_jobs set extract_started_at = tests.pl_month() - interval '1 second' where id = tests.id('e5122a');
select tests.act_as('uA');
do $$
declare u jsonb;
begin
  u := public.org_usage();
  perform tests.ok('C5140 plan', u ->> 'plan' = 'starter', 'answered ' || u::text);
  perform tests.ok('C5140 agreements', (u -> 'live_agreements' ->> 'used')::int = 3 and (u -> 'live_agreements' ->> 'limit')::int = 15, 'answered ' || u::text);
  perform tests.ok('C5140 imports', (u -> 'ai_imports' ->> 'used')::int = 2 and (u -> 'ai_imports' ->> 'limit')::int = 10, 'answered ' || u::text);
  perform tests.ok('C5140 resets on', (u ->> 'resets_on')::date = ((tests.pl_month() at time zone 'America/Vancouver' + interval '1 month')::date), 'resets_on is ' || (u ->> 'resets_on'));
end $$;

-- C5140: an admin reads usage too (the estimator is promoted inside the transaction).
reset role;
update public.memberships set role = 'admin' where user_id = tests.id('uE') and org_id = tests.id('orgA');
select tests.act_as('uE');
do $$
begin
  perform tests.ok('C5140 admin', (public.org_usage() ->> 'plan') = 'starter', 'an admin could not read usage');
end $$;
reset role;
update public.memberships set role = 'estimator' where user_id = tests.id('uE') and org_id = tests.id('orgA');

-- C5141: only an owner or admin reads usage.
select tests.act_as('uE');
select tests.expect_error('C5141 estimator', 'select public.org_usage()', '42501');
select tests.act_as('uV');
select tests.expect_error('C5141 viewer', 'select public.org_usage()', '42501');
select tests.act_as('uX');
select tests.expect_error('C5141 non-member', 'select public.org_usage()', '42501');
reset role;

-- C5142: usage is computed. Withdrawing an agreement and deleting a started job each lower it by one.
update public.agreements set status = 'withdrawn' where id = tests.id('u5140a');
delete from public.import_jobs where id = tests.id('s5121a');
select tests.act_as('uA');
do $$
declare u jsonb;
begin
  u := public.org_usage();
  perform tests.ok('C5142 agreements', (u -> 'live_agreements' ->> 'used')::int = 2, 'answered ' || u::text);
  perform tests.ok('C5142 imports', (u -> 'ai_imports' ->> 'used')::int = 1, 'answered ' || u::text);
end $$;
reset role;

-- C5108: org_billing.plan references plan_limits.
insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
values (tests.id('orgB'), 'cus_pl_b', 'sub_pl_b', 'team', 5, array['hvac'], false);
select tests.expect_error('C5108 team limit referenced', $q$delete from private.plan_limits where plan = 'team'$q$, '23503');

reset role;
rollback;
select 'plan_limits: pass' as result;
