-- other-trade-draft, database side: C3420-C3424 and C3440 (.specs/features/other-trade-draft/checks.md).
-- Run after fixture.sql and the migration (npm run test:db other_trade_draft): the recipe puts
-- migrations/20261112100000_add_catalog_types.sql between them, inside the rolled-back transaction, until the owner applies it.
-- Fixture: org A owner uA, estimator uE, viewer uV, and a type "Rooftop unit"; org B owner uB. uAd (admin of A) is made here.
-- Expected values come from the plan, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@draft.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- One valid type, with a name and the task descriptions the caller picks.
create function tests.od_type(p_name text, p_tasks text[] default array['Check the unit'], p_months int[] default array[3, 9]) returns jsonb
language sql immutable as $$
  select jsonb_build_object('name', p_name, 'defaultVisitMonths', to_jsonb(p_months), 'synonyms', jsonb_build_array(lower(p_name) || 's'),
    'tasks', (select jsonb_agg(jsonb_build_object('description', t)) from unnest(p_tasks) as t))
$$;

create function tests.od_count(p_org text) returns bigint
language sql stable as $$ select count(*) from public.asset_types where org_id = tests.id(p_org) $$;

create function tests.od_call(p_org text, p_types jsonb) returns text
language sql as $$ select format('select public.add_catalog_types(%L, %L::jsonb)', tests.id(p_org), p_types::text) $$;

grant execute on all functions in schema tests to anon, authenticated;

-- C3423: an owner and an admin add types; each gets pack null, the code the name rule makes, its months, spellings and tasks in order.
do $$
declare
  v_codes text[];
  v_before bigint := tests.od_count('orgA');
  v_pending timestamptz;
begin
  update public.org_settings set setup_completed_at = null where org_id = tests.id('orgA');
  perform tests.act_as('uA');
  v_codes := public.add_catalog_types(tests.id('orgA'), jsonb_build_array(
    tests.od_type('Pool pump', array['Check seals', 'Clean the basket', 'Test the timer'], array[4, 10]),
    tests.od_type('9 Hole Green & Tee-Box')));
  reset role;
  perform tests.ok('C3423 codes', v_codes = array['POOL_PUMP', 'T_9_HOLE_GREEN_TEE_BOX'], 'codes ' || v_codes::text);
  perform tests.ok('C3423 rows', tests.od_count('orgA') = v_before + 2
    and (select pack is null and name = 'Pool pump' and default_visit_months = array[4, 10]::smallint[] and synonyms = array['pool pumps']
         from public.asset_types where org_id = tests.id('orgA') and code = 'POOL_PUMP'), 'the type row is wrong');
  perform tests.ok('C3423 tasks', (select array_agg(description order by position) from public.asset_type_tasks
      where org_id = tests.id('orgA') and asset_type_id = (select id from public.asset_types where org_id = tests.id('orgA') and code = 'POOL_PUMP'))
      = array['Check seals', 'Clean the basket', 'Test the timer']
    and (select min(position) from public.asset_type_tasks
      where asset_type_id = (select id from public.asset_types where org_id = tests.id('orgA') and code = 'POOL_PUMP')) = 0, 'tasks or positions are wrong');
  v_pending := (select setup_completed_at from public.org_settings where org_id = tests.id('orgA'));
  perform tests.ok('C3423 setup flag', v_pending is null, 'setup_completed_at was stamped');

  perform tests.act_as('uAd');
  v_codes := public.add_catalog_types(tests.id('orgA'), jsonb_build_array(tests.od_type('Cooling tower')));
  reset role;
  perform tests.ok('C3423 admin', v_codes = array['COOLING_TOWER'], 'admin could not add');
end $$;

-- C3420: a name that exists (any case), or repeats inside the list, raises 23505 and writes nothing.
do $$
declare
  v_before bigint := tests.od_count('orgA');
begin
  perform tests.act_as('uA');
  perform tests.expect_error('C3420 existing', tests.od_call('orgA', jsonb_build_array(tests.od_type('Fresh type'), tests.od_type('POOL PUMP'))), '23505');
  perform tests.expect_error('C3420 seeded', tests.od_call('orgA', jsonb_build_array(tests.od_type('rooftop UNIT'))), '23505');
  perform tests.expect_error('C3420 inside the list', tests.od_call('orgA', jsonb_build_array(tests.od_type('Twin'), tests.od_type('twin'))), '23505');
  reset role;
  perform tests.ok('C3420 nothing written', tests.od_count('orgA') = v_before
    and not exists (select 1 from public.asset_types where org_id = tests.id('orgA') and lower(name) in ('fresh type', 'twin')), 'a row was written');
end $$;

-- C3424: the same list twice: the second raises 23505 and the org holds one row per name.
do $$
declare
  v_draft jsonb := jsonb_build_array(tests.od_type('Zone valve'), tests.od_type('Sprinkler head'));
  v_before bigint := tests.od_count('orgA');
begin
  perform tests.act_as('uA');
  perform public.add_catalog_types(tests.id('orgA'), v_draft);
  perform tests.expect_error('C3424 second', tests.od_call('orgA', v_draft), '23505');
  reset role;
  perform tests.ok('C3424 one row each', tests.od_count('orgA') = v_before + 2
    and (select count(*) from public.asset_types where org_id = tests.id('orgA') and name in ('Zone valve', 'Sprinkler head')) = 2, 'duplicates exist');
end $$;

-- C3422: any invalid piece raises 23514 and none of the types is written.
do $$
declare
  v_before bigint := tests.od_count('orgA');
  v_case text;
  v_bad jsonb;
  v_cases jsonb := jsonb_build_object(
    'months not ascending', tests.od_type('Bad A', array['x'], array[9, 3]),
    'month out of range', tests.od_type('Bad A2', array['x'], array[0, 13]),
    'no months', tests.od_type('Bad A3', array['x'], array[]::int[]),
    'task over 200', tests.od_type('Bad B', array[repeat('x', 201)]),
    'bad spelling', jsonb_set(tests.od_type('Bad D'), '{synonyms}', '["Upper Case"]'),
    'empty name', tests.od_type('   '),
    'no task', jsonb_set(tests.od_type('Bad C'), '{tasks}', '[]'),
    '41 tasks', tests.od_type('Bad E', (select array_agg('t' || n) from generate_series(1, 41) n)));
begin
  perform tests.act_as('uA');
  for v_case in select key from jsonb_each(v_cases) loop
    perform tests.expect_error('C3422 ' || v_case, tests.od_call('orgA', jsonb_build_array(tests.od_type('Valid first'), v_cases -> v_case)), '23514');
  end loop;
  perform tests.expect_error('C3422 31 types', tests.od_call('orgA', (select jsonb_agg(tests.od_type('Many ' || n)) from generate_series(1, 31) n)), '23514');
  perform tests.expect_error('C3422 no types', tests.od_call('orgA', '[]'::jsonb), '23514');
  reset role;
  perform tests.ok('C3422 nothing written', tests.od_count('orgA') = v_before
    and not exists (select 1 from public.asset_types where org_id = tests.id('orgA') and name in ('Valid first') or name like 'Many %'), 'a row was written');
end $$;

-- C3421: an estimator, a viewer, another org's owner and anon get 42501 and write nothing.
do $$
declare
  v_user text;
  v_before bigint := tests.od_count('orgA');
begin
  foreach v_user in array array['uE', 'uV', 'uB'] loop
    perform tests.act_as(v_user);
    perform tests.expect_error('C3421 ' || v_user, tests.od_call('orgA', jsonb_build_array(tests.od_type('Blocked ' || v_user))), '42501');
    reset role;
  end loop;
  perform tests.act_as_anon();
  perform tests.expect_error('C3421 anon', tests.od_call('orgA', jsonb_build_array(tests.od_type('Blocked anon'))), '42501');
  reset role;
  perform tests.ok('C3421 nothing written', tests.od_count('orgA') = v_before, 'a row was written');
end $$;

-- C3440: a drafted type has no pack template, so reset_task_library_type refuses it (55000) like any type made by hand.
do $$
begin
  perform tests.act_as('uA');
  perform tests.expect_error('C3440 reset', 'select public.reset_task_library_type(''POOL_PUMP'')', '55000');
  reset role;
end $$;

rollback;
select 'other_trade_draft: pass' as result;
