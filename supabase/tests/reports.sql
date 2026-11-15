-- Reporting, database side: C5701-C5716 (.specs/features/reporting/checks.md).
-- Run after fixture.sql and the migration 20261115110000_reports.sql, in the same transaction (the recipe replays the migration
-- until the owner applies it to the hosted project). Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB; uX has no
-- membership. Expected values come from the plan, never read back from the migration.
--
-- Scenario, org A, range R = 2030-01-01 to 2030-12-31 (the fixture's own events are dated now, so they stay outside R).
-- Every tests.rn_agreement has two lines worth 4 x 25000 + 1 x 19999 = 119999 cents.
--   rpIn   accepted, term started 30 days ago (in term)
--   rpFut  accepted, term starts in 60 days (not started, no contract)
--   rpSent sent
--   rpAcc  accepted 2030-03-05, sent 2030-03-01, contract completed 2030-03-05, term in 2030
--   rpRen  accepted event 2030-03-06 and an agreement.renewed event, term ended
--   rpRef  refused 2030-03-11 (reason Price), sent 2030-03-02
--   rpExp  expired 2030-03-12;  rpWd  withdrawn 2030-03-13 (note)
-- created_at of rpAcc, rpRef, rpExp, rpRen is 2030-02-01.

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.rp_ev(p_name text, p_type text, p_at text, p_payload jsonb default '{}', p_org text default 'A') returns void
language plpgsql security definer as $$
begin
  insert into public.events (org_id, entity_type, entity_id, type, payload, created_at)
  values (tests.id('org' || p_org), 'agreement', tests.id(p_name), p_type, p_payload, p_at::timestamptz);
end $$;

create function tests.rp_status(p_name text, p_status text) returns void
language sql security definer as $$ update public.agreements set status = p_status where id = tests.id(p_name) $$;

grant execute on all functions in schema tests to anon, authenticated;

select tests.rn_agreement('rpIn', 'A', ((now() at time zone 'America/Vancouver')::date - 30));
select tests.rn_agreement('rpFut', 'A', ((now() at time zone 'America/Vancouver')::date + 60));
select tests.rn_agreement('rpSent', 'A', '2031-01-01');
select tests.rp_status('rpSent', 'sent');
select tests.rn_agreement('rpAcc', 'A', '2030-01-01');
select tests.rn_agreement('rpRen', 'A', '2020-01-01');
select tests.rn_agreement('rpRef', 'A', '2031-01-01');
select tests.rp_status('rpRef', 'refused');
select tests.rn_agreement('rpExp', 'A', '2031-01-01');
select tests.rp_status('rpExp', 'expired');
select tests.rn_agreement('rpWd', 'A', '2031-01-01');
select tests.rp_status('rpWd', 'withdrawn');
-- Org B has an in-term agreement and a refusal inside R; none of it may reach org A.
select tests.rn_agreement('rpB', 'B', ((now() at time zone 'America/Vancouver')::date - 30));

update public.agreements set created_at = '2030-02-01 12:00:00+00'
where id in (tests.id('rpAcc'), tests.id('rpRef'), tests.id('rpExp'), tests.id('rpRen'));

insert into public.contracts (id, org_id, agreement_version_id, status)
values (tests.id('rpAcc:k'), tests.id('orgA'), tests.id('rpAcc:v1'), 'completed');

select tests.rp_ev('rpAcc', 'agreement.sent', '2030-03-01 10:00:00+00');
select tests.rp_ev('rpAcc', 'agreement.accepted', '2030-03-05 10:00:00+00');
select tests.rp_ev('rpRen', 'agreement.accepted', '2030-03-06 10:00:00+00');
select tests.rp_ev('rpRen', 'agreement.renewed', '2030-03-06 10:00:01+00');
select tests.rp_ev('rpRef', 'agreement.sent', '2030-03-02 10:00:00+00');
select tests.rp_ev('rpRef', 'agreement.refused', '2030-03-11 10:00:00+00', '{"reason": "Price"}');
select tests.rp_ev('rpExp', 'agreement.expired', '2030-03-12 10:00:00+00');
select tests.rp_ev('rpWd', 'agreement.withdrawn', '2030-03-13 10:00:00+00', '{"note": "Customer left"}');
select tests.rp_ev('rpB', 'agreement.refused', '2030-03-11 10:00:00+00', '{"reason": "Org B only"}', 'B');
insert into public.events (org_id, entity_type, entity_id, type, created_at)
values (tests.id('orgA'), 'contract', tests.id('rpAcc:k'), 'contract.completed', '2030-03-05 20:00:00+00');

-- C5701, C5702, C5703, C5704: the headline as the owner.
do $$
declare
  h record;
  n record;
begin
  perform tests.act_as('uA');
  select * into h from public.report_headline('2030-01-01', '2030-12-31');
  perform tests.ok('C5701 recurring revenue', h.recurring_cents = 119999, 'recurring is ' || h.recurring_cents);
  -- rpSent 119999 + rpFut 119999; rpIn (in term), rpAcc (completed), rpRen (ended) count zero times.
  perform tests.ok('C5702 pipeline value', h.pipeline_cents = 239998, 'pipeline is ' || h.pipeline_cents);
  perform tests.ok('C5703 accepted excludes the renewed one', h.accepted_n = 1, 'accepted is ' || h.accepted_n);
  perform tests.ok('C5703 refused', h.refused_n = 1, 'refused is ' || h.refused_n);
  perform tests.ok('C5703 expired', h.expired_n = 1, 'expired is ' || h.expired_n);
  perform tests.ok('C5704 signed count', h.signed_n = 1, 'signed is ' || h.signed_n);
  perform tests.ok('C5704 average days to sign', h.avg_days_to_sign = 4.0, 'avg is ' || coalesce(h.avg_days_to_sign::text, 'null'));
  select * into n from public.report_headline('2031-01-01', '2031-12-31');
  perform tests.ok('C5704 none completed in the range', n.avg_days_to_sign is null and n.signed_n = 0, 'avg is ' || coalesce(n.avg_days_to_sign::text, 'null'));
  perform tests.ok('C5703 nothing decided in an empty range', n.accepted_n = 0 and n.refused_n = 0 and n.expired_n = 0, 'counts are not zero');
  reset role;
end $$;

-- C5705: the funnel, by each stage's own event date; C5712 asserts its values are hidden from an estimator.
do $$
declare
  got text;
begin
  perform tests.act_as('uA');
  select string_agg(stage || ':' || n || ':' || value_cents, ' ' order by ord) into got from public.report_funnel('2030-01-01', '2030-12-31');
  perform tests.ok('C5705 funnel counts and values', got = 'created:4:479996 sent:2:239998 accepted:2:239998 signed:1:119999', 'funnel is ' || got);
  select string_agg(stage || ':' || n, ' ' order by ord) into got from public.report_funnel('2029-01-01', '2029-12-31');
  perform tests.ok('C5705 empty range keeps four rows', got = 'created:0 sent:0 accepted:0 signed:0', 'funnel is ' || got);
  reset role;
end $$;

-- C5706: stage medians, then the stuck list capped at ten, oldest first.
do $$
declare
  got text;
  first_id uuid;
  cnt integer;
  i integer;
begin
  perform tests.act_as('uA');
  -- created 2030-02-01 -> sent 03-01 (28 days) and 03-02 (29): median 28.5. sent -> decided: rpAcc 4, rpRef 9: 6.5. accepted -> signed: 0.
  select string_agg(stage || '=' || coalesce(days::text, 'null'), ' ' order by stage) into got
  from public.report_aging('2030-01-01', '2030-12-31') where kind = 'median';
  perform tests.ok('C5706 stage medians', got = 'Accepted to signed=0.0 Created to sent=28.5 Sent to decided=6.5', 'medians are ' || got);
  reset role;

  for i in 1..12 loop
    perform tests.rn_agreement('rpSt' || i, 'A', '2031-01-01');
    perform tests.rp_status('rpSt' || i, 'draft');
  end loop;
  update public.agreements set updated_at = '2020-01-01 00:00:00+00' where id = tests.id('rpSt7');

  perform tests.act_as('uA');
  select count(*), (array_agg(agreement_id order by days desc, number))[1] into cnt, first_id from public.report_aging('2030-01-01', '2030-12-31') where kind = 'stuck';
  perform tests.ok('C5706 at most ten stuck', cnt = 10, 'stuck rows: ' || cnt);
  perform tests.ok('C5706 oldest first', first_id = tests.id('rpSt7'), 'the oldest is not rpSt7');
  perform tests.ok('C5706 first row is the oldest', (select agreement_id from public.report_aging('2030-01-01', '2030-12-31') where kind = 'stuck' limit 1) = tests.id('rpSt7'), 'row order');
  perform tests.ok('C5706 a decided, completed or renewed agreement is never stuck', not exists (
    select 1 from public.report_aging('2030-01-01', '2030-12-31')
    where agreement_id in (tests.id('rpAcc'), tests.id('rpRen'), tests.id('rpRef'), tests.id('rpExp'), tests.id('rpWd'))), 'a finished agreement is listed');
  reset role;
end $$;

-- C5707: losses, newest first, with the reason when the event holds one.
do $$
declare
  got text;
begin
  perform tests.act_as('uA');
  select string_agg(outcome || '=' || coalesce(reason, 'null') || '=' || coalesce(value_cents::text, 'null'), ' ' order by occurred desc) into got
  from public.report_losses('2030-01-01', '2030-12-31');
  perform tests.ok('C5707 losses', got = 'withdrawn=Customer left=119999 expired=null=119999 refused=Price=119999', 'losses are ' || got);
  perform tests.ok('C5707 newest first', (select outcome from public.report_losses('2030-01-01', '2030-12-31') limit 1) = 'withdrawn', 'order');
  reset role;
end $$;

-- C5715: 2030-07-02 03:00 UTC is 2030-07-01 20:00 in Vancouver.
select tests.rn_agreement('rpTz', 'A', '2031-01-01');
select tests.rp_ev('rpTz', 'agreement.sent', '2030-07-02 03:00:00+00');
do $$
declare
  on_first bigint;
  on_second bigint;
begin
  perform tests.act_as('uA');
  select n into on_first from public.report_funnel('2030-07-01', '2030-07-01') where stage = 'sent';
  select n into on_second from public.report_funnel('2030-07-02', '2030-07-02') where stage = 'sent';
  perform tests.ok('C5715 counted on the Vancouver date', on_first = 1, 'on 07-01: ' || on_first);
  perform tests.ok('C5715 not on the UTC date', on_second = 0, 'on 07-02: ' || on_second);
  reset role;
end $$;

-- C5713: org B's agreement, refusal and customer never reach org A.
do $$
begin
  perform tests.act_as('uA');
  perform tests.ok('C5713 no org B loss', not exists (select 1 from public.report_losses('2030-01-01', '2030-12-31') where reason = 'Org B only' or agreement_id = tests.id('rpB')), 'org B loss visible');
  perform tests.ok('C5713 no org B revenue', not exists (select 1 from public.report_revenue_by_customer() where customer_id = tests.id('custB')), 'org B customer visible');
  perform tests.ok('C5713 no org B in the headline', (select recurring_cents from public.report_headline('2030-01-01', '2030-12-31')) = 119999, 'recurring changed');
  reset role;
end $$;

-- C5709, C5710: revenue by customer and by type. Add two more customers and one agreement whose single line (19999) covers two types.
insert into public.customers (id, org_id, name) values
  (tests.id('rpAlpha'), tests.id('orgA'), 'Alpha Co'), (tests.id('rpBeta'), tests.id('orgA'), 'Beta Co');
select tests.rn_agreement('rpAl', 'A', ((now() at time zone 'America/Vancouver')::date - 30));
select tests.rn_agreement('rpBe', 'A', ((now() at time zone 'America/Vancouver')::date - 30));
update public.sites set site_contact_id = null, customer_id = tests.id('rpAlpha') where id = tests.id('rpAl:site');
update public.sites set site_contact_id = null, customer_id = tests.id('rpBeta') where id = tests.id('rpBe:site');
select tests.rn_agreement('rpTy', 'A', ((now() at time zone 'America/Vancouver')::date - 30));
select tests.rp_status('rpTy', 'draft');
delete from public.service_lines where agreement_version_id = tests.id('rpTy:v1');
insert into public.asset_types (id, org_id, code, name) values
  (tests.id('rpTa'), tests.id('orgA'), 'RPA', 'Aaa Type'), (tests.id('rpTz2'), tests.id('orgA'), 'RPZ', 'Zzz Type');
insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
values (tests.id('rpTy:line'), tests.id('orgA'), tests.id('rpTy:v1'), 0, 'Split line', '{6}', 1, 19999);
insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values
  (tests.id('orgA'), tests.id('rpTy:line'), tests.id('rpTa')), (tests.id('orgA'), tests.id('rpTy:line'), tests.id('rpTz2'));
select tests.rp_status('rpTy', 'accepted');

do $$
declare
  got text;
  expected text;
  total bigint;
begin
  perform tests.act_as('uA');
  -- custA holds rpIn (119999) and rpTy (19999): 139998, ahead of Alpha and Beta at 119999 each, which tie and sort by name.
  select string_agg(customer_name || '=' || value_cents, ' ' order by ord) into got
  from (select row_number() over () as ord, * from public.report_revenue_by_customer()) c;
  select string_agg(name, ' ') into expected from (select name from public.customers where id = tests.id('custA')) x;
  perform tests.ok('C5709 customers largest first, ties by name', got = expected || '=139998 Alpha Co=119999 Beta Co=119999', 'customers are ' || got);
  perform tests.ok('C5710 first type takes the remainder', (select value_cents from public.report_revenue_by_type() where type_name = 'Aaa Type') = 10000, 'Aaa Type share');
  perform tests.ok('C5710 second type', (select value_cents from public.report_revenue_by_type() where type_name = 'Zzz Type') = 9999, 'Zzz Type share');
  select sum(value_cents) into total from public.report_revenue_by_type();
  perform tests.ok('C5710 by-type total equals recurring revenue', total = (select recurring_cents from public.report_headline('2030-01-01', '2030-12-31')) and total = 379996,
    'by-type total ' || total);
  reset role;
end $$;

-- C5708: renewals. Each agreement is created so its term ends the stated number of days from today, then found by its real distance.
create function tests.rp_ends_in(p_name text, p_days integer) returns void
language plpgsql as $$
declare
  v_today date := (now() at time zone 'America/Vancouver')::date;
  v_start date;
begin
  select s::date into v_start from generate_series(v_today - 380, v_today - 260, interval '1 day') s
  where ((s + interval '12 months')::date - 1) - v_today = p_days limit 1;
  perform tests.rn_agreement(p_name, 'A', v_start);
end $$;
grant execute on all functions in schema tests to anon, authenticated;
select tests.rp_ends_in('rpR30', 30);
select tests.rp_ends_in('rpR31', 31);
select tests.rp_ends_in('rpR60', 60);
select tests.rp_ends_in('rpR61', 61);
select tests.rp_ends_in('rpR90', 90);
select tests.rp_ends_in('rpR91', 91);
do $$
declare
  got text;
begin
  perform tests.rn_cpi(2, (now() at time zone 'America/Vancouver')::date);
  perform tests.act_as('uA');
  select string_agg(number || '=' || bucket, ' ' order by days_left) into got from public.report_renewals();
  perform tests.ok('C5708 buckets', got = 'AG-rpR30=30 AG-rpR31=60 AG-rpR60=60 AG-rpR61=90 AG-rpR90=90', 'renewals are ' || got);
  perform tests.ok('C5708 beyond 90 days is left out', not exists (select 1 from public.report_renewals() where number = 'AG-rpR91'), 'rpR91 listed');
  perform tests.ok('C5708 CPI below the threshold is auto', (select kind from public.report_renewals() where number = 'AG-rpR30') = 'auto', 'kind');
  reset role;
  perform tests.rn_cpi(6, (now() at time zone 'America/Vancouver')::date);
  perform tests.act_as('uA');
  perform tests.ok('C5708 CPI at or above the threshold needs negotiation', (select kind from public.report_renewals() where number = 'AG-rpR30') = 'negotiate', 'kind');
  reset role;
  update public.org_settings set renewal_cpi_pct = null, renewal_cpi_as_of = null where org_id = tests.id('orgA');
  perform tests.act_as('uA');
  perform tests.ok('C5708 no CPI set needs negotiation', (select kind from public.report_renewals() where number = 'AG-rpR30') = 'negotiate', 'kind');
  reset role;
end $$;

-- C5711: a viewer and a non-member are refused by every function.
do $$
declare
  calls text[] := array[
    $q$select * from public.report_headline('2030-01-01', '2030-12-31')$q$,
    $q$select * from public.report_funnel('2030-01-01', '2030-12-31')$q$,
    $q$select * from public.report_aging('2030-01-01', '2030-12-31')$q$,
    $q$select * from public.report_losses('2030-01-01', '2030-12-31')$q$,
    $q$select * from public.report_renewals()$q$,
    $q$select * from public.report_revenue_by_customer()$q$,
    $q$select * from public.report_revenue_by_type()$q$];
  c text;
  who text;
begin
  foreach who in array array['uV', 'uX'] loop
    perform tests.act_as(who);
    foreach c in array calls loop
      perform tests.expect_error('C5711 ' || who || ' ' || split_part(substr(c, 15), '(', 1), c, '42501');
    end loop;
  end loop;
  reset role;
end $$;

-- C5712: an estimator is refused the money functions and sees null money elsewhere.
do $$
begin
  perform tests.act_as('uE');
  perform tests.expect_error('C5712 headline', $q$select * from public.report_headline('2030-01-01', '2030-12-31')$q$, '42501');
  perform tests.expect_error('C5712 revenue by customer', $q$select * from public.report_revenue_by_customer()$q$, '42501');
  perform tests.expect_error('C5712 revenue by type', $q$select * from public.report_revenue_by_type()$q$, '42501');
  perform tests.ok('C5712 funnel counts without money', (select count(*) from public.report_funnel('2030-01-01', '2030-12-31') where value_cents is null) = 4
    and (select n from public.report_funnel('2030-01-01', '2030-12-31') where stage = 'created') = 4, 'funnel');
  perform tests.ok('C5712 aging', (select count(*) from public.report_aging('2030-01-01', '2030-12-31') where kind = 'median') = 3, 'aging');
  perform tests.ok('C5712 losses without money', (select count(*) from public.report_losses('2030-01-01', '2030-12-31')) = 3
    and (select count(*) from public.report_losses('2030-01-01', '2030-12-31') where value_cents is not null) = 0, 'losses');
  perform tests.ok('C5712 renewals without money', (select count(*) from public.report_renewals()) = 5
    and (select count(*) from public.report_renewals() where value_cents is not null) = 0, 'renewals');
  reset role;
end $$;

-- C5714: a canceled org is still read.
do $$
begin
  insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade, status)
  values (tests.id('orgA'), 'cus_rp_a', 'sub_rp_a', 'starter', 2, array['hvac'], false, 'canceled');
  perform tests.act_as('uA');
  perform tests.ok('C5714 frozen org still reads', (select recurring_cents from public.report_headline('2030-01-01', '2030-12-31')) > 0, 'no row');
  reset role;
end $$;

-- C5716: a new org with no agreements.
do $$
declare
  h record;
  got text;
begin
  insert into public.orgs (id, name) values (tests.id('orgC'), 'Empty Org');
  insert into public.memberships (org_id, user_id, role) values (tests.id('orgC'), tests.id('uX'), 'owner');
  perform tests.act_as('uX');
  select * into h from public.report_headline('2030-01-01', '2030-12-31');
  perform tests.ok('C5716 headline zeros', h.recurring_cents = 0 and h.pipeline_cents = 0 and h.accepted_n = 0 and h.refused_n = 0 and h.expired_n = 0 and h.signed_n = 0, 'not zero');
  select string_agg(stage || ':' || n || ':' || value_cents, ' ' order by ord) into got from public.report_funnel('2030-01-01', '2030-12-31');
  perform tests.ok('C5716 funnel zeros', got = 'created:0:0 sent:0:0 accepted:0:0 signed:0:0', 'funnel is ' || got);
  perform tests.ok('C5716 no rows elsewhere', (select count(*) from public.report_losses('2030-01-01', '2030-12-31')) = 0
    and (select count(*) from public.report_renewals()) = 0 and (select count(*) from public.report_revenue_by_customer()) = 0
    and (select count(*) from public.report_revenue_by_type()) = 0, 'rows');
  reset role;
end $$;

rollback;
select 'reports: pass' as result;
