-- record-forms: C315, C321, C327, C336; deactivation C1270-C1309 (.specs/features/deactivation/checks.md). Run after fixture.sql in the same execute_sql call (npm run test:db record_forms).
-- Fixture: siteA names ctA (of custA) as its site contact; ct2A belongs to cust2A and no site names it.

-- C336: a viewer can neither insert, update nor delete customers, contacts, sites or assets.
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C336 viewer insert customers',
    format('insert into public.customers (org_id, name) values (%L, ''V'')', tests.id('orgA')), '42501');
  perform tests.expect_error('C336 viewer insert contacts',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''V'')', tests.id('orgA'), tests.id('custA')), '42501');
  perform tests.expect_error('C336 viewer insert sites',
    format('insert into public.sites (org_id, customer_id, name) values (%L, %L, ''V'')', tests.id('orgA'), tests.id('custA')), '42501');
  perform tests.expect_error('C336 viewer insert assets',
    format('insert into public.assets (org_id, site_id, asset_type_id) values (%L, %L, %L)', tests.id('orgA'), tests.id('siteA'), tests.id('typeA')), '42501');

  perform tests.expect_rows('C336 viewer update customers', format('update public.customers set name = ''V'' where id = %L', tests.id('custA')), 0);
  perform tests.expect_rows('C336 viewer update contacts', format('update public.contacts set name = ''V'' where id = %L', tests.id('ctA')), 0);
  perform tests.expect_rows('C336 viewer update sites', format('update public.sites set name = ''V'' where id = %L', tests.id('siteA')), 0);
  perform tests.expect_rows('C336 viewer update assets', format('update public.assets set location = ''V'' where id = %L', tests.id('assetA')), 0);

  perform tests.expect_rows('C336 viewer delete customers', format('delete from public.customers where id = %L', tests.id('custA')), 0);
  perform tests.expect_rows('C336 viewer delete contacts', format('delete from public.contacts where id = %L', tests.id('ctA')), 0);
  perform tests.expect_rows('C336 viewer delete sites', format('delete from public.sites where id = %L', tests.id('siteA')), 0);
  -- Deactivation door 2 (C1314): assets are never deleted, so the viewer is refused outright.
  perform tests.expect_error('C336 viewer delete assets', format('delete from public.assets where id = %L', tests.id('assetA')), '42501');
end $$;

-- C336: an owner cannot attach a row to another org's parent, nor change another org's row.
reset role;
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C336 foreign parent',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''X'')', tests.id('orgA'), tests.id('custB')), '23503');
  perform tests.expect_rows('C336 foreign asset update', format('update public.assets set location = ''X'' where id = %L', tests.id('assetB')), 0);
end $$;

-- C336, C321, C315, C327: an estimator writes all four, within the composite keys.
reset role;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C336 estimator insert customers',
    format('insert into public.customers (org_id, name) values (%L, ''E'')', tests.id('orgA')), 1);
  perform tests.expect_rows('C336 estimator insert contacts',
    format('insert into public.contacts (org_id, customer_id, name) values (%L, %L, ''E'')', tests.id('orgA'), tests.id('custA')), 1);
  perform tests.expect_rows('C336 estimator insert sites',
    format('insert into public.sites (org_id, customer_id, name) values (%L, %L, ''E'')', tests.id('orgA'), tests.id('custA')), 1);
  perform tests.expect_rows('C336 estimator insert assets',
    format('insert into public.assets (org_id, site_id, asset_type_id) values (%L, %L, %L)', tests.id('orgA'), tests.id('siteA'), tests.id('typeA')), 1);

  perform tests.expect_error('C321 insert with another customer''s contact',
    format('insert into public.sites (org_id, customer_id, site_contact_id, name) values (%L, %L, %L, ''E'')',
      tests.id('orgA'), tests.id('custA'), tests.id('ct2A')), '23503');
  perform tests.expect_error('C321 update to another customer''s contact',
    format('update public.sites set site_contact_id = %L where id = %L', tests.id('ct2A'), tests.id('siteA')), '23503');

  perform tests.expect_error('C315 delete a site contact',
    format('delete from public.contacts where id = %L', tests.id('ctA')), '23503');
  perform tests.ok('C315 site contact kept', (select count(*) from public.contacts where id = tests.id('ctA')) = 1, 'ctA was deleted');
  perform tests.expect_rows('C315 delete an unused contact', format('delete from public.contacts where id = %L', tests.id('ct2A')), 1);

  -- Deactivation door 2 (C1314) supersedes AD-030 for assets: a writer cannot delete one either.
  perform tests.expect_error('C327 delete an asset', format('delete from public.assets where id = %L', tests.id('assetA')), '42501');
end $$;
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Deactivation (.specs/features/deactivation/checks.md). T is today in America/Vancouver.

-- A site <name> of p_customer (custA by default) with one asset <name>:U-1 (RTU) and an agreement AG-<name> in
-- p_status, whose version 1 ends on T + p_end_offset (no term when null), with a contract in p_contract when given.
-- Created as the table owner.
create function tests.dz_site(p_name text, p_status text default 'draft', p_end_offset integer default null,
                              p_contract text default null, p_customer text default 'custA')
returns uuid
language plpgsql as $$
declare
  o uuid := tests.id('orgA');
  v_end date := (now() at time zone 'America/Vancouver')::date + p_end_offset;
  v_start date := case when p_end_offset is null then null else ((v_end + 1) - interval '12 months')::date end;
begin
  insert into public.sites (id, org_id, customer_id, name) values (tests.id(p_name), o, tests.id(p_customer), 'Plant ' || p_name);
  insert into public.assets (id, org_id, site_id, asset_type_id, unit_no)
  values (tests.id(p_name || ':U-1'), o, tests.id(p_name), tests.id('typeA'), 'U-1');
  insert into public.agreements (id, org_id, site_id, number) values (tests.id(p_name || ':agr'), o, tests.id(p_name), 'AG-' || p_name);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start, term_months)
  values (tests.id(p_name || ':v1'), o, tests.id(p_name || ':agr'), 1, v_start, 12);
  if p_end_offset is not null then
    perform tests.ok('dz_site ' || p_name || ' term end',
      (select term_end = v_end from public.agreement_versions where id = tests.id(p_name || ':v1')), 'term_end is not T + offset');
  end if;
  update public.agreements set status = p_status where id = tests.id(p_name || ':agr');
  if p_contract is not null then
    insert into public.contracts (org_id, agreement_version_id, status) values (o, tests.id(p_name || ':v1'), p_contract);
  end if;
  return tests.id(p_name);
end $$;

-- 'sqlstate/hint' of a statement that fails, or 'ok'.
create function tests.dz_fail(p_sql text) returns text
language plpgsql as $$
declare v_hint text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return sqlstate || '/' || coalesce(v_hint, '');
end $$;

-- The detail of a statement that fails, as jsonb.
create function tests.dz_detail(p_sql text) returns jsonb
language plpgsql as $$
declare v_detail text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end $$;

create function tests.dz_status(p_name text) returns text
language sql security definer as $$ select status from public.agreements where id = tests.id(p_name || ':agr') $$;

create function tests.dz_inactive(p_table text, p_id uuid) returns boolean
language plpgsql security definer as $$
declare v boolean;
begin
  execute format('select deactivated_at is not null from public.%I where id = %L', p_table, p_id) into v;
  return v;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

do $$ begin
  perform tests.dz_site('dz1', 'draft');
  perform tests.dz_site('dz2', 'sent');
  perform tests.dz_site('dz3', 'accepted', 0);
  perform tests.dz_site('dz4', 'accepted', 30);
  perform tests.dz_site('dz5', 'accepted', null);
  perform tests.dz_site('dz6', 'accepted', -1, 'pending_signature');
  perform tests.dz_site('dz7', 'accepted', -1, 'client_signed');
  perform tests.dz_site('dz8', 'accepted', -1, 'completed');
  perform tests.dz_site('dz9', 'accepted', -1);
  perform tests.dz_site('dz10', 'accepted', -1, 'declined');
  perform tests.dz_site('dz11', 'accepted', -1, 'voided');
  perform tests.dz_site('dz12', 'refused');
  perform tests.dz_site('dz13', 'expired');
  perform tests.dz_site('dz14', 'withdrawn');
  perform tests.dz_site('dz15', 'changes_requested');
  -- dz16: an in-term accepted agreement and a draft renewal of it on the same site.
  perform tests.dz_site('dz16', 'accepted', 30);
  insert into public.agreements (id, org_id, site_id, number, renews_agreement_id)
  values (tests.id('dz16:draft'), tests.id('orgA'), tests.id('dz16'), 'AG-dz16r', tests.id('dz16:agr'));
  insert into public.agreement_versions (org_id, agreement_id, version_no) values (tests.id('orgA'), tests.id('dz16:draft'), 1);
  -- dz20: the asset site, with RTU-2, RTU-3 and a removed RTU-4 beside U-1; dz21 is another site of org A.
  perform tests.dz_site('dz20', 'sent');
  insert into public.assets (id, org_id, site_id, asset_type_id, unit_no) values
    (tests.id('dz20:RTU-2'), tests.id('orgA'), tests.id('dz20'), tests.id('typeA'), 'RTU-2'),
    (tests.id('dz20:RTU-3'), tests.id('orgA'), tests.id('dz20'), tests.id('typeA'), 'RTU-3'),
    (tests.id('dz20:RTU-4'), tests.id('orgA'), tests.id('dz20'), tests.id('typeA'), 'RTU-4');
  update public.assets set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('dz20:RTU-4');
  -- dz20's sent version froze its scope while U-1 was still in service.
  update public.agreement_versions set snapshot = public.site_service_scope(tests.id('dz20')) where id = tests.id('dz20:v1');
  perform tests.dz_site('dz21', 'draft');
  -- custZ: two sites with live agreements and one deactivated earlier; custY: one site free, one in term.
  insert into public.customers (id, org_id, name) values (tests.id('custZ'), tests.id('orgA'), 'Zephyr Foods'),
                                                         (tests.id('custY'), tests.id('orgA'), 'Yarrow Hotels');
  perform tests.dz_site('zs1', 'draft', null, null, 'custZ');
  perform tests.dz_site('zs2', 'sent', null, null, 'custZ');
  perform tests.dz_site('zs3', 'withdrawn', null, null, 'custZ');
  update public.sites set deactivated_at = '2026-01-01T00:00:00Z', deactivated_by = tests.id('uA') where id = tests.id('zs3');
  perform tests.dz_site('ys1', 'draft', null, null, 'custY');
  perform tests.dz_site('ys2', 'accepted', 30, null, 'custY');
end $$;

-- C1273: the column checks hold for the table owner too.
do $$ begin
  perform tests.expect_error('C1273 replaced_by on an active asset',
    format('update public.assets set replaced_by_asset_id = %L where id = %L', tests.id('dz20:RTU-2'), tests.id('dz20:U-1')), '23514');
  perform tests.expect_error('C1273 replaced_by itself',
    format('update public.assets set deactivated_at = now(), deactivated_by = %L, replaced_by_asset_id = id where id = %L',
      tests.id('uA'), tests.id('dz20:U-1')), '23514');
  perform tests.expect_error('C1273 replaced_by on another site',
    format('update public.assets set deactivated_at = now(), deactivated_by = %L, replaced_by_asset_id = %L where id = %L',
      tests.id('uA'), tests.id('dz21:U-1'), tests.id('dz20:U-1')), '23503');
  perform tests.expect_error('C1273 customers at without by',
    format('update public.customers set deactivated_at = now() where id = %L', tests.id('custZ')), '23514');
  perform tests.expect_error('C1273 sites by without at',
    format('update public.sites set deactivated_by = %L where id = %L', tests.id('uA'), tests.id('dz21')), '23514');
  perform tests.expect_error('C1273 assets at without by',
    format('update public.assets set deactivated_at = now() where id = %L', tests.id('dz21:U-1')), '23514');
end $$;

-- C1275 (before): the draft scope of dz20 lists U-1 and RTU-2, not the removed RTU-4.
select tests.act_as('uE');
do $$
declare doc text := public.site_service_scope(tests.id('dz20'))::text;
begin
  perform tests.ok('C1275 before has U-1', doc like '%"unitNo": "U-1"%', doc);
  perform tests.ok('C1275 removed RTU-4 not in scope', doc not like '%RTU-4%', doc);
end $$;

-- C1270, C1271, C1272: removing assets as the estimator.
do $$ begin
  perform tests.ok('C1272 itself', tests.dz_fail(format('select public.set_asset_active(%L, false, %L)',
    tests.id('dz20:U-1'), tests.id('dz20:U-1'))) = '23514/replacement_invalid', 'itself accepted');
  perform tests.ok('C1272 inactive', tests.dz_fail(format('select public.set_asset_active(%L, false, %L)',
    tests.id('dz20:U-1'), tests.id('dz20:RTU-4'))) = '23514/replacement_invalid', 'inactive accepted');
  perform tests.ok('C1272 other site', tests.dz_fail(format('select public.set_asset_active(%L, false, %L)',
    tests.id('dz20:U-1'), tests.id('dz21:U-1'))) = '23514/replacement_invalid', 'other site accepted');
  perform tests.ok('C1272 other org', tests.dz_fail(format('select public.set_asset_active(%L, false, %L)',
    tests.id('dz20:U-1'), tests.id('assetB'))) = '23514/replacement_invalid', 'other org accepted');
  perform tests.ok('C1272 unchanged', (select deactivated_at is null and replaced_by_asset_id is null
    from public.assets where id = tests.id('dz20:U-1')), 'a refused removal changed the asset');

  perform public.set_asset_active(tests.id('dz20:RTU-3'), false);
  perform tests.ok('C1270 stamped', (select deactivated_at is not null and deactivated_by = tests.id('uE') and replaced_by_asset_id is null
    from public.assets where id = tests.id('dz20:RTU-3')), 'RTU-3 not removed by uE');

  perform public.set_asset_active(tests.id('dz20:U-1'), false, tests.id('dz20:RTU-2'));
  perform tests.ok('C1271 linked', (select deactivated_at is not null and replaced_by_asset_id = tests.id('dz20:RTU-2')
    from public.assets where id = tests.id('dz20:U-1')), 'U-1 not linked to RTU-2');
end $$;

-- C1275 (after): U-1 left the draft scope; the sent version's frozen snapshot kept it.
do $$
declare doc text := public.site_service_scope(tests.id('dz20'))::text;
begin
  perform tests.ok('C1275 after has no U-1', doc not like '%"unitNo": "U-1"%', doc);
  perform tests.ok('C1275 RTU-2 still in scope', doc like '%RTU-2%', doc);
  perform tests.ok('C1275 snapshot kept U-1',
    (select snapshot::text like '%"unitNo": "U-1"%' from public.agreement_versions where id = tests.id('dz20:v1')), 'snapshot rewritten');
end $$;

-- C1274: no member deletes an asset.
do $$ begin
  perform tests.expect_error('C1274 estimator delete', format('delete from public.assets where id = %L', tests.id('dz21:U-1')), '42501');
end $$;
reset role;
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1274 owner delete', format('delete from public.assets where id = %L', tests.id('dz21:U-1')), '42501');
end $$;
reset role;
do $$ begin
  perform tests.ok('C1274 row kept', exists (select 1 from public.assets where id = tests.id('dz21:U-1')), 'asset deleted');
end $$;

-- C1281, C1282, C1283, C1284, C1285, C1286: deactivating sites as the estimator.
select tests.act_as('uE');
do $$
declare
  n text;
  r uuid[];
  t date := (now() at time zone 'America/Vancouver')::date;
  d jsonb;
begin
  r := public.set_site_active(tests.id('dz1'), false);
  perform tests.ok('C1281 returns the withdrawn id', r = array[tests.id('dz1:agr')], coalesce(r::text, 'null'));
  r := public.set_site_active(tests.id('dz2'), false);
  perform tests.ok('C1282 returns the withdrawn id', r = array[tests.id('dz2:agr')], coalesce(r::text, 'null'));

  foreach n in array array['dz3', 'dz4', 'dz5', 'dz6', 'dz7', 'dz8'] loop
    perform tests.ok('C1283 ' || n, tests.dz_fail(format('select public.set_site_active(%L, false)', tests.id(n))) = '55000/in_term',
      n || ' was not refused in_term');
    perform tests.ok('C1283 ' || n || ' unchanged', not tests.dz_inactive('sites', tests.id(n)) and tests.dz_status(n) = 'accepted',
      n || ' changed');
  end loop;
  d := tests.dz_detail(format('select public.set_site_active(%L, false)', tests.id('dz4')));
  perform tests.ok('C1283 detail', d ->> 'number' = 'AG-dz4' and d ->> 'termEnd' = (t + 30)::text and d ->> 'site' = 'Plant dz4',
    coalesce(d::text, 'null'));

  foreach n in array array['dz9', 'dz10', 'dz11'] loop
    r := public.set_site_active(tests.id(n), false);
    perform tests.ok('C1284 ' || n, tests.dz_inactive('sites', tests.id(n)) and tests.dz_status(n) = 'accepted' and r = '{}',
      n || ' not deactivated, or its agreement moved');
  end loop;
  foreach n in array array['dz12', 'dz13', 'dz14'] loop
    r := public.set_site_active(tests.id(n), false);
    perform tests.ok('C1284 ' || n, tests.dz_inactive('sites', tests.id(n)) and r = '{}'
      and tests.dz_status(n) = case n when 'dz12' then 'refused' when 'dz13' then 'expired' else 'withdrawn' end,
      n || ' not deactivated, or its agreement moved');
  end loop;

  perform tests.ok('C1285', tests.dz_fail(format('select public.set_site_active(%L, false)', tests.id('dz15'))) = '55000/changes_requested',
    'dz15 not refused changes_requested');
  perform tests.ok('C1285 unchanged', not tests.dz_inactive('sites', tests.id('dz15')) and tests.dz_status('dz15') = 'changes_requested',
    'dz15 changed');

  perform tests.ok('C1286', tests.dz_fail(format('select public.set_site_active(%L, false)', tests.id('dz16'))) = '55000/in_term',
    'dz16 not refused');
  perform tests.ok('C1286 draft kept', (select status = 'draft' from public.agreements where id = tests.id('dz16:draft'))
    and not tests.dz_inactive('sites', tests.id('dz16')), 'the renewal draft moved');
end $$;
reset role;

do $$
declare n text;
begin
  foreach n in array array['dz1', 'dz2'] loop
    perform tests.ok('C1281 site stamped ' || n, (select deactivated_at is not null and deactivated_by = tests.id('uE')
      from public.sites where id = tests.id(n)), n || ' not stamped by uE');
    perform tests.ok('C1281 withdrawn ' || n, tests.dz_status(n) = 'withdrawn', n || ' not withdrawn');
    perform tests.ok('C1281 one event ' || n, (select count(*) = 1 from public.events
      where entity_id = tests.id(n || ':agr') and type = 'agreement.withdrawn'), n || ' event count');
    perform tests.ok('C1281 one outbox row ' || n, (select count(*) = 1 from public.outbox o join public.events e on e.id = o.event_id
      where e.entity_id = tests.id(n || ':agr') and e.type = 'agreement.withdrawn'), n || ' outbox count');
  end loop;
  perform tests.ok('C1281 payload', (select payload = '{"from": "draft", "to": "withdrawn", "via": "deactivation"}'::jsonb
    and actor_id = tests.id('uE') from public.events where entity_id = tests.id('dz1:agr') and type = 'agreement.withdrawn'), 'dz1 event');
  perform tests.ok('C1282 payload', (select payload = '{"from": "sent", "to": "withdrawn", "via": "deactivation"}'::jsonb
    and actor_id = tests.id('uE') from public.events where entity_id = tests.id('dz2:agr') and type = 'agreement.withdrawn'), 'dz2 event');
  perform tests.ok('C1286 no withdrawn event', (select count(*) = 0 from public.events
    where entity_id in (tests.id('dz16:agr'), tests.id('dz16:draft')) and type = 'agreement.withdrawn'), 'dz16 wrote an event');

  -- For C1288: a site, a customer and an asset already inactive since a fixed past time, by uA.
  update public.sites set deactivated_at = '2026-02-02T00:00:00Z', deactivated_by = tests.id('uA') where id = tests.id('dz1');
  update public.customers set deactivated_at = '2026-02-02T00:00:00Z', deactivated_by = tests.id('uA') where id = tests.id('cust2A');
  update public.assets set deactivated_at = '2026-02-02T00:00:00Z', deactivated_by = tests.id('uA') where id = tests.id('dz20:RTU-4');
end $$;

-- C1287: roles and orgs.
do $$
declare
  u text;
  f text;
  fns text[] := array[
    format('select public.set_site_active(%L, false)', tests.id('dz21')),
    format('select public.set_customer_active(%L, false)', tests.id('custY')),
    format('select public.set_asset_active(%L, false)', tests.id('dz21:U-1'))];
begin
  foreach u in array array['uV', 'uB', 'uX'] loop
    perform tests.act_as(u);
    foreach f in array fns loop
      perform tests.ok('C1287 ' || u || ' ' || f, tests.dz_fail(f) like case u when 'uV' then '42501/%' else 'P0002/%' end,
        u || ' got ' || tests.dz_fail(f));
    end loop;
  end loop;
  perform tests.act_as('uE');
  foreach f in array array[
    format('select public.set_site_active(%L, false)', tests.id('nope')),
    format('select public.set_customer_active(%L, false)', tests.id('nope')),
    format('select public.set_asset_active(%L, false)', tests.id('nope'))] loop
    perform tests.ok('C1287 unknown ' || f, tests.dz_fail(f) like 'P0002/%', 'unknown id got ' || tests.dz_fail(f));
  end loop;
end $$;
reset role;
do $$ begin
  perform tests.ok('C1287 unchanged', not tests.dz_inactive('sites', tests.id('dz21')) and not tests.dz_inactive('customers', tests.id('custY'))
    and not tests.dz_inactive('assets', tests.id('dz21:U-1')) and tests.dz_status('dz21') = 'draft', 'a refused call changed something');
end $$;

-- C1288: repeating a deactivation, or reactivating an active row, changes nothing and writes no event.
select tests.act_as('uE');
do $$
declare before bigint := (select count(*) from public.events);
begin
  perform tests.ok('C1288 site again', public.set_site_active(tests.id('dz1'), false) = '{}', 'returned withdrawals');
  perform tests.ok('C1288 customer again', public.set_customer_active(tests.id('cust2A'), false) = '{}', 'returned withdrawals');
  perform public.set_asset_active(tests.id('dz20:RTU-4'), false, tests.id('dz20:RTU-2'));
  perform tests.ok('C1288 site kept', (select deactivated_at = '2026-02-02T00:00:00Z' and deactivated_by = tests.id('uA')
    from public.sites where id = tests.id('dz1')), 'dz1 restamped');
  perform tests.ok('C1288 customer kept', (select deactivated_at = '2026-02-02T00:00:00Z' and deactivated_by = tests.id('uA')
    from public.customers where id = tests.id('cust2A')), 'cust2A restamped');
  perform tests.ok('C1288 asset kept', (select deactivated_at = '2026-02-02T00:00:00Z' and deactivated_by = tests.id('uA')
    and replaced_by_asset_id is null from public.assets where id = tests.id('dz20:RTU-4')), 'RTU-4 restamped');
  perform tests.ok('C1288 active site', public.set_site_active(tests.id('dz21'), true) = '{}', 'returned withdrawals');
  perform tests.ok('C1288 active customer', public.set_customer_active(tests.id('custY'), true) = '{}', 'returned withdrawals');
  perform public.set_asset_active(tests.id('dz21:U-1'), true);
  perform tests.ok('C1288 active rows kept', not tests.dz_inactive('sites', tests.id('dz21'))
    and not tests.dz_inactive('customers', tests.id('custY')) and not tests.dz_inactive('assets', tests.id('dz21:U-1')), 'an active row moved');
  perform tests.ok('C1288 no event', (select count(*) from public.events) = before, 'an event was written');
end $$;

-- C1289: an inactive site starts no agreement; reactivated, it does.
do $$
declare before bigint := (select count(*) from public.agreements where site_id = tests.id('dz1'));
begin
  perform tests.ok('C1289 refused', tests.dz_fail(format('select public.create_agreement(%L)', tests.id('dz1'))) = '55000/site_inactive',
    'create_agreement on an inactive site');
  perform tests.ok('C1289 nothing inserted', (select count(*) from public.agreements where site_id = tests.id('dz1')) = before, 'inserted');
  perform public.set_site_active(tests.id('dz1'), true);
  perform tests.ok('C1289 reactivated creates', public.create_agreement(tests.id('dz1')) is not null, 'no id');
end $$;

-- C1291: members cannot write the deactivation columns, and still edit the rest.
do $$ begin
  perform tests.expect_error('C1291 customers deactivated_at',
    format('update public.customers set deactivated_at = now() where id = %L', tests.id('custY')), '42501');
  perform tests.expect_error('C1291 customers deactivated_by',
    format('update public.customers set deactivated_by = null where id = %L', tests.id('custY')), '42501');
  perform tests.expect_error('C1291 sites deactivated_at',
    format('update public.sites set deactivated_at = now() where id = %L', tests.id('dz21')), '42501');
  perform tests.expect_error('C1291 sites deactivated_by',
    format('update public.sites set deactivated_by = null where id = %L', tests.id('dz21')), '42501');
  perform tests.expect_error('C1291 assets deactivated_at',
    format('update public.assets set deactivated_at = now() where id = %L', tests.id('dz21:U-1')), '42501');
  perform tests.expect_error('C1291 assets deactivated_by',
    format('update public.assets set deactivated_by = null where id = %L', tests.id('dz21:U-1')), '42501');
  perform tests.expect_error('C1291 assets replaced_by_asset_id',
    format('update public.assets set replaced_by_asset_id = null where id = %L', tests.id('dz21:U-1')), '42501');

  perform tests.expect_rows('C1291 customer name', format('update public.customers set name = ''Yarrow Hotels Ltd'' where id = %L', tests.id('custY')), 1);
  perform tests.expect_rows('C1291 site name', format('update public.sites set name = ''Plant dz21b'' where id = %L', tests.id('dz21')), 1);
  perform tests.expect_rows('C1291 site address', format('update public.sites set address = ''1 Main St'' where id = %L', tests.id('dz21')), 1);
  perform tests.expect_rows('C1291 site contact', format('update public.sites set site_contact_id = %L where id = %L', tests.id('ctA'), tests.id('siteA')), 1);
  perform tests.expect_rows('C1291 asset type', format('update public.assets set asset_type_id = %L where id = %L', tests.id('typeA'), tests.id('dz21:U-1')), 1);
  perform tests.expect_rows('C1291 asset unit', format('update public.assets set unit_no = ''U-9'' where id = %L', tests.id('dz21:U-1')), 1);
  perform tests.expect_rows('C1291 asset model', format('update public.assets set type_model = ''M'' where id = %L', tests.id('dz21:U-1')), 1);
  perform tests.expect_rows('C1291 asset location', format('update public.assets set location = ''Roof'' where id = %L', tests.id('dz21:U-1')), 1);
end $$;

-- C1296, C1297: deactivating customers.
do $$
declare r uuid[];
begin
  perform tests.ok('C1297 refused', tests.dz_fail(format('select public.set_customer_active(%L, false)', tests.id('custY'))) = '55000/in_term',
    'custY not refused');
  perform tests.ok('C1297 detail names the site',
    tests.dz_detail(format('select public.set_customer_active(%L, false)', tests.id('custY'))) ->> 'site' = 'Plant ys2', 'no site in detail');
  perform tests.ok('C1297 unchanged', not tests.dz_inactive('customers', tests.id('custY')) and not tests.dz_inactive('sites', tests.id('ys1'))
    and not tests.dz_inactive('sites', tests.id('ys2')) and tests.dz_status('ys1') = 'draft' and tests.dz_status('ys2') = 'accepted',
    'a refused customer deactivation changed something');

  r := public.set_customer_active(tests.id('custZ'), false);
  perform tests.ok('C1296 returns both', r @> array[tests.id('zs1:agr'), tests.id('zs2:agr')] and cardinality(r) = 2, coalesce(r::text, 'null'));
end $$;
reset role;
do $$ begin
  perform tests.ok('C1296 one timestamp', (select count(distinct deactivated_at) = 1 and bool_and(deactivated_by = tests.id('uE'))
    from (select deactivated_at, deactivated_by from public.customers where id = tests.id('custZ')
          union all select deactivated_at, deactivated_by from public.sites where id in (tests.id('zs1'), tests.id('zs2'))) x),
    'customer and sites not stamped together');
  perform tests.ok('C1296 earlier site kept', (select deactivated_at = '2026-01-01T00:00:00Z' and deactivated_by = tests.id('uA')
    from public.sites where id = tests.id('zs3')), 'zs3 restamped');
  perform tests.ok('C1296 withdrawn', tests.dz_status('zs1') = 'withdrawn' and tests.dz_status('zs2') = 'withdrawn', 'not withdrawn');
  perform tests.ok('C1296 events', (select count(*) = 2 from public.events where entity_id in (tests.id('zs1:agr'), tests.id('zs2:agr'))
    and type = 'agreement.withdrawn' and payload ->> 'via' = 'deactivation'), 'withdrawn events');
end $$;

-- C1306: inactive records stay readable, with their agreements.
select tests.act_as('uV');
do $$ begin
  perform tests.ok('C1306 customer', (select count(*) = 1 from public.customers where id = tests.id('custZ')), 'custZ hidden');
  perform tests.ok('C1306 site', (select count(*) = 1 from public.sites where id = tests.id('zs1')), 'zs1 hidden');
  perform tests.ok('C1306 asset', (select count(*) = 1 from public.assets where id = tests.id('dz20:U-1')), 'U-1 hidden');
  perform tests.ok('C1306 agreements', (select count(*) = 1 from public.agreements where site_id = tests.id('zs1')), 'zs1 agreement hidden');
end $$;
reset role;

-- C1307, C1308, C1309: reactivating. zs1:U-2 is an inactive asset on an inactive site.
insert into public.assets (id, org_id, site_id, asset_type_id, unit_no, deactivated_at, deactivated_by)
values (tests.id('zs1:U-2'), tests.id('orgA'), tests.id('zs1'), tests.id('typeA'), 'U-2', now(), tests.id('uA'));
select tests.act_as('uE');
do $$ begin
  perform tests.ok('C1309 site under inactive customer',
    tests.dz_fail(format('select public.set_site_active(%L, true)', tests.id('zs1'))) = '55000/customer_inactive', 'zs1 reactivated');
  perform tests.ok('C1309 detail', tests.dz_detail(format('select public.set_site_active(%L, true)', tests.id('zs1'))) ->> 'customer' = 'Zephyr Foods',
    'no customer in detail');
  perform tests.ok('C1309 asset on inactive site',
    tests.dz_fail(format('select public.set_asset_active(%L, true)', tests.id('zs1:U-2'))) = '55000/site_inactive', 'U-2 reactivated');
  perform tests.ok('C1309 unchanged', tests.dz_inactive('sites', tests.id('zs1')) and tests.dz_inactive('assets', tests.id('zs1:U-2')),
    'a refused reactivation changed something');

  perform public.set_customer_active(tests.id('custZ'), true);
  perform tests.ok('C1308 customer back', not tests.dz_inactive('customers', tests.id('custZ')), 'custZ still inactive');
  perform tests.ok('C1308 sites stay inactive', tests.dz_inactive('sites', tests.id('zs1')) and tests.dz_inactive('sites', tests.id('zs2')),
    'a site came back with its customer');

  perform public.set_site_active(tests.id('zs2'), true);
  perform public.set_asset_active(tests.id('dz20:U-1'), true);
  perform tests.ok('C1307 site cleared', (select deactivated_at is null and deactivated_by is null from public.sites where id = tests.id('zs2')),
    'zs2 not cleared');
  perform tests.ok('C1307 asset cleared', (select deactivated_at is null and deactivated_by is null and replaced_by_asset_id is null
    from public.assets where id = tests.id('dz20:U-1')), 'U-1 not cleared');
  perform tests.ok('C1307 agreement stays withdrawn', tests.dz_status('zs2') = 'withdrawn', 'zs2 agreement restored');
  perform public.set_customer_active(tests.id('custZ'), false);
  perform public.set_customer_active(tests.id('custZ'), true);
  perform tests.ok('C1307 customer cleared', (select deactivated_at is null and deactivated_by is null from public.customers
    where id = tests.id('custZ')), 'custZ not cleared');
end $$;
reset role;

-- C1290: W7 renews nothing on an inactive site; an active site's due agreement renews in the same run.
do $$ begin
  perform tests.rn_agreement('dzr1');
  perform tests.rn_agreement('dzr2');
  update public.sites set deactivated_at = now(), deactivated_by = tests.id('uA') where id = tests.id('dzr1:site');
  perform private.run_renewals('2027-12-15');
  perform tests.ok('C1290 inactive site not renewed', (tests.rn_of(tests.id('dzr1'))).id is null, 'dzr1 renewed');
  perform tests.ok('C1290 active site renewed', (tests.rn_of(tests.id('dzr2'))).id is not null, 'dzr2 not renewed');
end $$;

reset role;

rollback;
select 'record_forms: pass' as result;
