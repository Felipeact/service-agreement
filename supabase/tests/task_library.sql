-- task-library-page, database side: C1421, C1426, C1427, C1435, C1436, C1437. Run after fixture.sql in the same
-- execute_sql call (npm run test:db task_library). Fixture: org A owner uA, estimator uE, viewer uV; typeA is RTU
-- "Rooftop unit" on siteA (asset RTU-1); org B owner uB. Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

-- A second type for org A, with one task, so a save can be shown to leave it alone.
insert into public.asset_types (id, org_id, code, name, default_visit_months) values
  (tests.id('tl:boiler'), tests.id('orgA'), 'BOILER', 'Boiler', '{10}');
insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months) values
  (tests.id('orgA'), tests.id('tl:boiler'), 0, 'Check flue', null),
  (tests.id('orgA'), tests.id('typeA'), 0, 'Old first', null),
  (tests.id('orgA'), tests.id('typeA'), 1, 'Old second', '{6}');
update public.asset_types set default_visit_months = '{3,6,9,12}' where id = tests.id('typeA');

create function tests.tl_tasks(p_type uuid) returns text
language sql security definer as $$
  select coalesce(string_agg(position || ':' || description || ':' || coalesce(visit_months::text, 'null'), ' | ' order by position), '')
  from public.asset_type_tasks where asset_type_id = p_type
$$;

create function tests.tl_months(p_type uuid) returns text
language sql security definer as $$ select default_visit_months::text from public.asset_types where id = p_type $$;

grant execute on function tests.tl_tasks(uuid), tests.tl_months(uuid) to anon, authenticated;

-- A sent agreement on its own site whose version holds a fixed snapshot, for C1436.
select tests.pe_sent('tl-sent', '2027-12-31');
update public.agreement_versions set snapshot = '{"schema":2,"types":[{"code":"RTU","tasks":[{"description":"Old first","visitMonths":null}]}]}'::jsonb
where id = tests.id('tl-sent:v1');
create table tests.tl_before as
  select md5(snapshot::text) as digest from public.agreement_versions where id = tests.id('tl-sent:v1');

-- C1421, C1426, C1437: the owner saves RTU.
select tests.act_as('uA');
do $$
begin
  perform public.save_task_library_type('RTU', '{4,10}',
    '[{"description":"A","visitMonths":null},{"description":"  B  ","visitMonths":[3,4]}]'::jsonb);

  perform tests.ok('C1421 months', tests.tl_months(tests.id('typeA')) = '{4,10}', 'RTU default months are not {4,10}');
  perform tests.ok('C1421 other type', tests.tl_months(tests.id('tl:boiler')) = '{10}', 'BOILER months changed');
  perform tests.ok('C1426 tasks', tests.tl_tasks(tests.id('typeA')) = '0:A:null | 1:B:{3,4}',
    'RTU tasks are not exactly A at 0 and B at 1: ' || tests.tl_tasks(tests.id('typeA')));
  perform tests.ok('C1426 other type', tests.tl_tasks(tests.id('tl:boiler')) = '0:Check flue:null', 'BOILER tasks changed');
  perform tests.ok('C1437 scope', (
      select count(*) from jsonb_array_elements(public.site_service_scope(tests.id('siteA')) -> 'types') t,
                           jsonb_array_elements(t -> 'tasks') k
      where t ->> 'code' = 'RTU' and k ->> 'description' = 'B' and k -> 'visitMonths' = '[3,4]'::jsonb) = 1,
    'site_service_scope does not show the new seasonal task');
end $$;

-- C1427: a bad second task raises and leaves the previous tasks and months exactly as they were.
do $$
begin
  perform tests.expect_error('C1427 bad months',
    $q$select public.save_task_library_type('RTU', '{1,2}', '[{"description":"X","visitMonths":null},{"description":"Y","visitMonths":[13]}]'::jsonb)$q$,
    '23514');
  perform tests.expect_error('C1427 blank description',
    $q$select public.save_task_library_type('RTU', '{1,2}', '[{"description":"X","visitMonths":null},{"description":"   ","visitMonths":null}]'::jsonb)$q$,
    '23514');
  perform tests.expect_error('C1427 bad default months',
    $q$select public.save_task_library_type('RTU', '{2,1}', '[]'::jsonb)$q$, '23514');
  perform tests.ok('C1427 tasks kept', tests.tl_tasks(tests.id('typeA')) = '0:A:null | 1:B:{3,4}', 'tasks changed after a failed save');
  perform tests.ok('C1427 months kept', tests.tl_months(tests.id('typeA')) = '{4,10}', 'default months changed after a failed save');
end $$;

-- C1435: an estimator and a viewer of the org are refused; the owner of another org cannot see this org's type.
select tests.act_as('uE');
do $$
begin
  perform tests.expect_error('C1435 estimator',
    $q$select public.save_task_library_type('RTU', '{1}', '[]'::jsonb)$q$, '42501');
end $$;
select tests.act_as('uV');
do $$
begin
  perform tests.expect_error('C1435 viewer',
    $q$select public.save_task_library_type('RTU', '{1}', '[]'::jsonb)$q$, '42501');
end $$;
select tests.act_as('uB');
do $$
begin
  -- Org B has its own RTU, so aim at BOILER, a code only org A has.
  perform tests.expect_error('C1435 other org',
    $q$select public.save_task_library_type('BOILER', '{1}', '[]'::jsonb)$q$, 'P0002');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform tests.ok('C1435 nothing changed', tests.tl_tasks(tests.id('typeA')) = '0:A:null | 1:B:{3,4}'
    and tests.tl_months(tests.id('typeA')) = '{4,10}'
    and tests.tl_tasks(tests.id('tl:boiler')) = '0:Check flue:null' and tests.tl_months(tests.id('tl:boiler')) = '{10}',
    'a refused call changed RTU or BOILER');
  -- C1435: the function is a security invoker; signed-in users may run it and anon may not.
  perform tests.ok('C1435 grants', has_function_privilege('authenticated', 'public.save_task_library_type(text, smallint[], jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_task_library_type(text, smallint[], jsonb)', 'execute')
    and not (select prosecdef from pg_proc where oid = 'public.save_task_library_type(text, smallint[], jsonb)'::regprocedure),
    'grants or security mode of save_task_library_type are wrong');
  -- C1436: the sent version's snapshot is byte-identical after all the saves above.
  perform tests.ok('C1436 snapshot', (select md5(snapshot::text) from public.agreement_versions where id = tests.id('tl-sent:v1'))
    = (select digest from tests.tl_before), 'a sent version''s snapshot changed');
end $$;

rollback;
select 'task_library: pass' as result;
