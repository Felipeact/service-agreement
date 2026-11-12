-- other-trade-draft, database side: C4116, C4117, C4118, C4119, C4121, C4123 (.specs/features/other-trade-draft/checks.md).
-- Run after fixture.sql and migration 20261112100000_add_catalog_draft.sql in the same execute_sql call (npm run test:db
-- other_trade_draft): the recipe puts the migration between them, inside the rolled-back transaction (create or replace, so it
-- also runs where the function already exists). Fixture orgs A and B already hold a type, so the empty orgs are made here: org E (owner uOw, admin uAd,
-- estimator uEs, viewer uVw) and org F (owner uOf). Expected values come from the plan, never read back from the migration.

reset role;
select set_config('request.jwt.claims', '', true);

grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, aud, role)
select tests.id(u), u || '@example.test', 'authenticated', 'authenticated'
from unnest(array['uOw','uAd','uEs','uVw','uOf']) as u;

insert into public.orgs (id, name) values (tests.id('orgE'), 'Org E'), (tests.id('orgF'), 'Org F');
insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgE'), tests.id('uOw'), 'owner'),
  (tests.id('orgE'), tests.id('uAd'), 'admin'),
  (tests.id('orgE'), tests.id('uEs'), 'estimator'),
  (tests.id('orgE'), tests.id('uVw'), 'viewer'),
  (tests.id('orgF'), tests.id('uOf'), 'owner');
insert into public.org_settings (org_id, legal_name, trade_context) values
  (tests.id('orgE'), 'Legal E', 'HVAC and mechanical'),
  (tests.id('orgF'), 'Legal F', null);

-- The state a failed call must leave: orgE has no type, no task and its original trade_context.
create function tests.otd_untouched() returns boolean
language sql as $$
  select not exists (select 1 from public.asset_types where org_id = tests.id('orgE'))
     and not exists (select 1 from public.asset_type_tasks where org_id = tests.id('orgE'))
     and (select trade_context from public.org_settings where org_id = tests.id('orgE')) = 'HVAC and mechanical'
$$;

-- The SQLSTATE of calling the function as a user, or 'ok'.
create function tests.otd_state(p_user text, p_org text, p_trade text, p_types jsonb) returns text
language plpgsql as $$
begin
  perform tests.act_as(p_user);
  perform public.add_catalog_draft(tests.id(p_org), p_trade, p_types);
  reset role;
  return 'ok';
exception when others then
  reset role;
  return sqlstate;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- C4117: every bad draft raises 23514 and leaves no type, no task and the old trade_context.
do $$
declare
  good jsonb := '{"name":"Termite inspection","months":[3,9],"tasks":["Check bait stations"]}';
  bad jsonb[] := array[
    '[{"name":"A","months":[13],"tasks":[]}]'::jsonb,
    jsonb_build_array(jsonb_build_object('name', repeat('A', 61), 'months', jsonb_build_array(3), 'tasks', jsonb_build_array())),
    jsonb_build_array(jsonb_build_object('name', 'A', 'months', jsonb_build_array(3), 'tasks', jsonb_build_array(repeat('x', 201)))),
    ('[' || good::text || ',' || replace(good::text, 'Termite inspection', 'TERMITE INSPECTION') || ']')::jsonb,
    '[]'::jsonb,
    '[{"name":"A","months":[],"tasks":[]}]'::jsonb,
    '[{"name":"A","months":[0],"tasks":[]}]'::jsonb,
    (select jsonb_agg(jsonb_build_object('name', 'Type ' || n, 'months', jsonb_build_array(1), 'tasks', jsonb_build_array())) from generate_series(1, 41) n),
    jsonb_build_array(jsonb_build_object('name', 'A', 'months', jsonb_build_array(1), 'tasks', (select jsonb_agg('t' || n) from generate_series(1, 13) n)))
  ];
  b jsonb;
  i integer := 0;
begin
  foreach b in array bad loop
    i := i + 1;
    perform tests.ok('C4117 bad draft ' || i, tests.otd_state('uOw', 'orgE', 'pest control', b) = '23514', 'did not raise 23514');
    perform tests.ok('C4117 nothing written ' || i, tests.otd_untouched(), 'a row or the trade changed');
  end loop;
  -- A good draft after a failed 41st-type style failure in the middle: the first type is rolled back with the second.
  perform tests.ok('C4117 second type bad', tests.otd_state('uOw', 'orgE', 'pest control',
    ('[' || good::text || ',{"name":"B","months":[1],"tasks":[1]}]')::jsonb) = '23514', 'did not raise');
  perform tests.ok('C4117 all or nothing', tests.otd_untouched(), 'the first type stayed');
  perform tests.ok('C4117 trade bad', tests.otd_state('uOw', 'orgE', 'bad;trade', ('[' || good::text || ']')::jsonb) = '23514', 'did not raise');
  perform tests.ok('C4117 trade bad nothing', tests.otd_untouched(), 'a row changed');
end $$;

-- C4119: an estimator, a viewer and the owner of another org are refused with 42501 and nothing is written.
do $$
declare
  good jsonb := '[{"name":"Termite inspection","months":[3,9],"tasks":["Check bait stations"]}]';
  u text;
begin
  foreach u in array array['uEs','uVw','uOf'] loop
    perform tests.ok('C4119 ' || u, tests.otd_state(u, 'orgE', 'pest control', good) = '42501', u || ' was not refused');
  end loop;
  perform tests.ok('C4119 nothing written', tests.otd_untouched(), 'a row or the trade changed');
end $$;

-- C4118: an org that already has a type raises 55000 and nothing is written.
do $$
declare
  before_count integer;
begin
  select count(*) into before_count from public.asset_types where org_id = tests.id('orgA');
  perform tests.ok('C4118 not empty', tests.otd_state('uA', 'orgA', 'pest control',
    '[{"name":"Termite inspection","months":[3],"tasks":[]}]'::jsonb) = '55000', 'did not raise 55000');
  perform tests.ok('C4118 nothing written', (select count(*) from public.asset_types where org_id = tests.id('orgA')) = before_count, 'a type was added');
end $$;

-- C4116, C4121: an admin adds a draft. Two names derive one code; a third keeps its plain code.
do $$
declare
  added integer;
  t public.asset_types;
begin
  perform tests.act_as('uAd');
  added := public.add_catalog_draft(tests.id('orgE'), 'pest control', jsonb_build_array(
    jsonb_build_object('name', 'Rodent stations', 'months', jsonb_build_array(9, 3, 3), 'tasks', jsonb_build_array('Check bait', 'Replace bait', 'Log activity')),
    jsonb_build_object('name', 'Rodent-stations', 'months', jsonb_build_array(6), 'tasks', jsonb_build_array()),
    jsonb_build_object('name', 'Gutters', 'months', jsonb_build_array(5, 10), 'tasks', jsonb_build_array('Clear debris'))
  ));
  reset role;
  perform tests.ok('C4116 count', added = 3, 'returned ' || added);
  perform tests.ok('C4116 rows', (select count(*) from public.asset_types where org_id = tests.id('orgE')) = 3, 'wrong type count');
  select * into t from public.asset_types where org_id = tests.id('orgE') and name = 'Rodent stations';
  perform tests.ok('C4116 pack null', t.pack is null, 'pack is ' || coalesce(t.pack, 'null'));
  perform tests.ok('C4116 code', t.code = 'RODENT_STATIONS', 'code is ' || t.code);
  perform tests.ok('C4116 months sorted and unique', t.default_visit_months = '{3,9}', 'months are ' || t.default_visit_months::text);
  perform tests.ok('C4116 tasks in order', (select array_agg(description order by position) from public.asset_type_tasks where asset_type_id = t.id) = array['Check bait', 'Replace bait', 'Log activity'], 'tasks out of order');
  perform tests.ok('C4116 task positions', (select array_agg(position order by position) from public.asset_type_tasks where asset_type_id = t.id) = array[1, 2, 3], 'positions wrong');
  perform tests.ok('C4116 trade appended', (select trade_context from public.org_settings where org_id = tests.id('orgE')) = 'HVAC and mechanical, pest control', 'trade_context wrong');
  perform tests.ok('C4121 suffix', exists (select 1 from public.asset_types where org_id = tests.id('orgE') and name = 'Rodent-stations' and code = 'RODENT_STATIONS_2'), 'second code has no suffix');
  perform tests.ok('C4121 plain code', exists (select 1 from public.asset_types where org_id = tests.id('orgE') and name = 'Gutters' and code = 'GUTTERS'), 'a non-colliding name lost its plain code');
end $$;

-- C4116: the trade is not appended twice when it is already in trade_context (org F starts with none).
do $$
begin
  perform tests.act_as('uOf');
  perform public.add_catalog_draft(tests.id('orgF'), 'pest control', '[{"name":"Gutters","months":[5],"tasks":[]}]'::jsonb);
  reset role;
  perform tests.ok('C4116 trade from null', (select trade_context from public.org_settings where org_id = tests.id('orgF')) = 'pest control', 'trade_context wrong');
  delete from public.asset_types where org_id = tests.id('orgF');
  perform tests.act_as('uOf');
  perform public.add_catalog_draft(tests.id('orgF'), 'pest control', '[{"name":"Gutters","months":[5],"tasks":[]}]'::jsonb);
  reset role;
  perform tests.ok('C4116 trade once', (select trade_context from public.org_settings where org_id = tests.id('orgF')) = 'pest control', 'the trade was appended twice');
end $$;

-- C4116: a draft at every upper limit is accepted (40 types, 60-character names, 12 tasks of 200 characters, 12 months).
do $$
begin
  delete from public.asset_types where org_id = tests.id('orgF');
  perform tests.act_as('uOf');
  perform public.add_catalog_draft(tests.id('orgF'), repeat('a', 60), (
    select jsonb_agg(jsonb_build_object(
      'name', case when n = 1 then repeat('N', 60) else 'Type ' || n end,
      'months', jsonb_build_array(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
      'tasks', (select jsonb_agg(repeat('t', 200)) from generate_series(1, 12))))
    from generate_series(1, 40) n));
  reset role;
  perform tests.ok('C4116 upper limits', (select count(*) from public.asset_types where org_id = tests.id('orgF')) = 40, 'not 40 types');
  perform tests.ok('C4116 upper tasks', (select count(*) from public.asset_type_tasks where org_id = tests.id('orgF')) = 480, 'not 480 tasks');
end $$;

-- C4123: door 2's shape.
do $$
declare
  f record;
begin
  select p.prosecdef, p.proconfig, p.prorettype::regtype::text as ret into f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'add_catalog_draft';
  perform tests.ok('C4123 invoker', f.prosecdef is false, 'the function is security definer');
  perform tests.ok('C4123 search_path', f.proconfig @> array['search_path=""'], 'search_path is not empty: ' || coalesce(f.proconfig::text, 'null'));
  perform tests.ok('C4123 returns integer', f.ret = 'integer', 'returns ' || f.ret);
  perform tests.ok('C4123 anon', not has_function_privilege('anon', 'public.add_catalog_draft(uuid,text,jsonb)', 'execute'), 'anon can execute');
  perform tests.ok('C4123 authenticated', has_function_privilege('authenticated', 'public.add_catalog_draft(uuid,text,jsonb)', 'execute'), 'authenticated cannot execute');
end $$;

reset role;
rollback;
select 'other_trade_draft: pass' as result;
