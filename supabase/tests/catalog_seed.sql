-- catalog-seed S1 and S2: C1-C11, C25, C26. Runs as table owner, after fixture.sql in the same execute_sql call.
-- The expected lists below are written from the source ("Service included" in the maintenance proposal template),
-- not copied from the migration.

create table tests.expected_types (code text primary key, name text not null, task_count integer not null);
insert into tests.expected_types (code, name, task_count) values
  ('ACID_NEUTRALIZER', 'Acid neutralizer', 1),
  ('AHU', 'AHU', 6),
  ('AIR_SEPARATOR', 'Air separator', 1),
  ('BACKFLOW_PREVENTER', 'Backflow preventer', 1),
  ('BOILER', 'Boiler', 11),
  ('CASE_COOLER', 'Case cooler', 6),
  ('CASE_FREEZER', 'Case freezer', 6),
  ('CHILLER', 'Chiller', 6),
  ('CO_SENSOR', 'CO sensor', 2),
  ('COOLING_TOWER', 'Cooling tower', 7),
  ('DUCTLESS_SPLIT', 'Ductless split', 6),
  ('EXHAUST_FAN', 'Exhaust fan', 4),
  ('ERV', 'ERV', 7),
  ('EXPANSION_TANK', 'Expansion tank', 3),
  ('FAN_COIL', 'Fan coil', 6),
  ('FIRE_DAMPER', 'Fire damper', 1),
  ('FURNACE', 'Furnace', 6),
  ('HEAT_EXCHANGER', 'Heat exchanger', 2),
  ('HRV', 'HRV', 3),
  ('HWT_MID_EFFICIENCY', 'HWT (commercial mid efficiency)', 4),
  ('HWT_HIGH_EFFICIENCY', 'HWT (commercial high efficiency)', 5),
  ('ICE_MACHINE', 'Ice machine', 4),
  ('INDIRECT_TANK', 'Indirect tank', 2),
  ('MUA', 'MUA', 4),
  ('PTAC', 'Packaged terminal AC (PTAC)', 3),
  ('PRESSURE_REGULATING_VALVE', 'Pressure regulating valve', 4),
  ('PUMP', 'Pump', 4),
  ('RTU', 'RTU', 10),
  ('SIDE_STREAM_FILTER', 'Side stream filter', 1),
  ('STORAGE_TANK', 'Storage tank', 4),
  ('SUPPLY_FAN', 'Supply fan', 4),
  ('UNITARY_SPLIT', 'Unitary split system', 7),
  ('UNIT_HEATER_ELECTRIC', 'Unit heater (electric)', 3),
  ('UNIT_HEATER_GAS', 'Unit heater (gas)', 5),
  ('VRF_OUTDOOR', 'VRF (outdoor unit)', 4),
  ('MINI_VRF', 'Mini VRF (entire system)', 6),
  ('WSHP', 'Water source heat pump', 4),
  ('WALK_IN_COOLER', 'Walk-in cooler', 5),
  ('WALK_IN_FREEZER', 'Walk-in freezer', 5),
  ('WYE_STRAINER', 'Wye strainer', 1);

create table tests.expected_tasks (code text not null, position integer not null, description text not null);
insert into tests.expected_tasks (code, position, description) values
  ('ACID_NEUTRALIZER', 1, 'Visual check for leak and blockage'),
  ('AHU', 1, 'Replace filters if applicable'),
  ('AHU', 2, 'Check and tension belts if applicable'),
  ('AHU', 3, 'Check and lubricate/grease bearings and motors if applicable'),
  ('AHU', 4, 'Check pulleys for wear and tear if applicable'),
  ('AHU', 5, 'Visual check coil for cleanliness and brush clean if necessary'),
  ('AHU', 6, 'Check and clean drain trap if applicable'),
  ('AIR_SEPARATOR', 1, 'Visual check for leak'),
  ('BACKFLOW_PREVENTER', 1, 'Check operation and recertify'),
  ('BOILER', 1, 'Clean heat exchanger with compressed air'),
  ('BOILER', 2, 'Clean burners and orifices with a wire brush'),
  ('BOILER', 3, 'Check water delta T'),
  ('BOILER', 4, 'Check supply gas pressure'),
  ('BOILER', 5, 'Flow switch test'),
  ('BOILER', 6, 'Low water cut out test'),
  ('BOILER', 7, 'Leak check (water, gas and venting)'),
  ('BOILER', 8, 'Check safety relief valve'),
  ('BOILER', 9, 'Clean condensate trap and acid neutralizer'),
  ('BOILER', 10, 'Check flame current'),
  ('BOILER', 11, 'Clean inlet strainer'),
  ('CASE_COOLER', 1, 'Check and brush clean condenser (brush or compressed air)'),
  ('CASE_COOLER', 2, 'Check evaporator and condenser fan motors'),
  ('CASE_COOLER', 3, 'Check door gaskets'),
  ('CASE_COOLER', 4, 'Visual check electrical for hot spots'),
  ('CASE_COOLER', 5, 'Check drain termination for possible blockage'),
  ('CASE_COOLER', 6, 'Measure and document box temp'),
  ('CASE_FREEZER', 1, 'Check and brush clean condenser (brush or compressed air)'),
  ('CASE_FREEZER', 2, 'Check evaporator and condenser fan motors'),
  ('CASE_FREEZER', 3, 'Check door gaskets'),
  ('CASE_FREEZER', 4, 'Visual check electrical for hot spots'),
  ('CASE_FREEZER', 5, 'Check drain termination for possible blockage'),
  ('CASE_FREEZER', 6, 'Measure and document box temp'),
  ('CHILLER', 1, 'Check flow switch'),
  ('CHILLER', 2, 'Check and clean condenser coil if applicable'),
  ('CHILLER', 3, 'Check condenser fan motors if applicable'),
  ('CHILLER', 4, 'Visual check of electrical connections for hot spots'),
  ('CHILLER', 5, 'Check charge via sight glass'),
  ('CHILLER', 6, 'Measure and document supply water delta T'),
  ('CO_SENSOR', 1, 'Check calibration of the sensor'),
  ('CO_SENSOR', 2, 'Check the operation of the sensor'),
  ('COOLING_TOWER', 1, 'Check/tension the belts if applicable'),
  ('COOLING_TOWER', 2, 'Clean the sump and strainer'),
  ('COOLING_TOWER', 3, 'Clean the fill & nozzles'),
  ('COOLING_TOWER', 4, 'Check the fan & motor bearing (grease both)'),
  ('COOLING_TOWER', 5, 'Check the fan & motor pulleys'),
  ('COOLING_TOWER', 6, 'Check the sump heater is operational'),
  ('COOLING_TOWER', 7, 'Check the overall operation of the cooling tower'),
  ('DUCTLESS_SPLIT', 1, 'Clean or replace indoor filters'),
  ('DUCTLESS_SPLIT', 2, 'Test drain of indoor unit'),
  ('DUCTLESS_SPLIT', 3, 'Check condensate pump reservoir screen if applicable'),
  ('DUCTLESS_SPLIT', 4, 'Visually check evaporator and condenser coil, brush clean as required'),
  ('DUCTLESS_SPLIT', 5, 'Visual check of electrical connections for hot spots'),
  ('DUCTLESS_SPLIT', 6, 'Test run and document supply temperature'),
  ('EXHAUST_FAN', 1, 'Replace filters if applicable'),
  ('EXHAUST_FAN', 2, 'Check and tension belts if applicable'),
  ('EXHAUST_FAN', 3, 'Check and lubricate/grease bearings and motors if applicable'),
  ('EXHAUST_FAN', 4, 'Check pulleys for wear and tear if applicable'),
  ('ERV', 1, 'Replace the prefilters'),
  ('ERV', 2, 'Inspect the core filters'),
  ('ERV', 3, 'Brush or vacuum if necessary'),
  ('ERV', 4, 'Inspect all electrical connections for loose connections or hot spots'),
  ('ERV', 5, 'Check heating operation'),
  ('ERV', 6, 'Clean fresh air grille'),
  ('ERV', 7, 'Check fan motor bearings'),
  ('EXPANSION_TANK', 1, 'Check appropriate water levels and air pressure'),
  ('EXPANSION_TANK', 2, 'Check shell for corrosion'),
  ('EXPANSION_TANK', 3, 'Visual inspection for any leaks'),
  ('FAN_COIL', 1, 'Replace filters if applicable'),
  ('FAN_COIL', 2, 'Check and tension belts if applicable'),
  ('FAN_COIL', 3, 'Check and lubricate/grease bearings and motors if applicable'),
  ('FAN_COIL', 4, 'Check pulleys for wear and tear if applicable'),
  ('FAN_COIL', 5, 'Visually check drain pan'),
  ('FAN_COIL', 6, 'Measure and document supply air temperature'),
  ('FIRE_DAMPER', 1, 'Visually check overall condition'),
  ('FURNACE', 1, 'Replace filters if applicable'),
  ('FURNACE', 2, 'Check and tension belts if applicable'),
  ('FURNACE', 3, 'Check and clean fresh air and vent exhaust as required'),
  ('FURNACE', 4, 'Check and clean condensate trap'),
  ('FURNACE', 5, 'Visually check acid neutralizer for leak and blockage'),
  ('FURNACE', 6, 'Test fire, measure and document supply air delta T'),
  ('HEAT_EXCHANGER', 1, 'Check for leaks'),
  ('HEAT_EXCHANGER', 2, 'Check for temperature difference across heat exchanger if applicable'),
  ('HRV', 1, 'Replace the filters if applicable'),
  ('HRV', 2, 'Check operation of all the fans'),
  ('HRV', 3, 'Check overall operation of the HRV'),
  ('HWT_MID_EFFICIENCY', 1, 'Check for leak'),
  ('HWT_MID_EFFICIENCY', 2, 'Confirm operation of safety devices (hi limit, PRV)'),
  ('HWT_MID_EFFICIENCY', 3, 'Check and ensure unit is venting properly'),
  ('HWT_MID_EFFICIENCY', 4, 'Inspect burner operation'),
  ('HWT_HIGH_EFFICIENCY', 1, 'Check for leak'),
  ('HWT_HIGH_EFFICIENCY', 2, 'Confirm operation of safety devices (hi limit, PRV)'),
  ('HWT_HIGH_EFFICIENCY', 3, 'Inspect and clean flame sensor and sparker as required'),
  ('HWT_HIGH_EFFICIENCY', 4, 'Check and clean burner as required'),
  ('HWT_HIGH_EFFICIENCY', 5, 'Visually check acid neutralizer for leak and blockage'),
  ('ICE_MACHINE', 1, 'Clean condenser if air cooled (brush or compressed air)'),
  ('ICE_MACHINE', 2, 'Visual check of water circulation system'),
  ('ICE_MACHINE', 3, 'Check electrical connections for hot spots'),
  ('ICE_MACHINE', 4, 'Visual check of overall cleanliness and recommend thorough cleaning if required'),
  ('INDIRECT_TANK', 1, 'Check for leak'),
  ('INDIRECT_TANK', 2, 'Check temperature control is calibrated correctly'),
  ('MUA', 1, 'Replace filters if applicable'),
  ('MUA', 2, 'Check and tension belts if applicable'),
  ('MUA', 3, 'Inspect and clean flame sensor and sparker if applicable'),
  ('MUA', 4, 'Visually check heat exchanger if applicable'),
  ('PTAC', 1, 'Replace filters and belts if applicable'),
  ('PTAC', 2, 'Check air coils and brush clean as required'),
  ('PTAC', 3, 'Check cool/heat operation and document supply air temp'),
  ('PRESSURE_REGULATING_VALVE', 1, 'Verify proper operation'),
  ('PRESSURE_REGULATING_VALVE', 2, 'Check all connections'),
  ('PRESSURE_REGULATING_VALVE', 3, 'Confirm proper response and settings'),
  ('PRESSURE_REGULATING_VALVE', 4, 'Report any problems or deficiencies'),
  ('PUMP', 1, 'Check for leak'),
  ('PUMP', 2, 'Check pump coupling for wear and tear if applicable'),
  ('PUMP', 3, 'Oil pump SBA and motor if applicable'),
  ('PUMP', 4, 'Measure and document amp draw'),
  ('RTU', 1, 'Replace filters if applicable'),
  ('RTU', 2, 'Check and tension belts if applicable'),
  ('RTU', 3, 'Inspect heat exchanger during heating season'),
  ('RTU', 4, 'Check compressor operation during cooling operation'),
  ('RTU', 5, 'Clean drain trap'),
  ('RTU', 6, 'Check evaporator and condenser coils for cleanliness, brush clean as required'),
  ('RTU', 7, 'Check and clean mist eliminators if applicable'),
  ('RTU', 8, 'Check motor and fan bearings'),
  ('RTU', 9, 'Check motor and fan pulleys'),
  ('RTU', 10, 'Measure and document supply air temperature'),
  ('SIDE_STREAM_FILTER', 1, 'Check and replace filter as required'),
  ('STORAGE_TANK', 1, 'Check water supply temperature and pressure relief valves'),
  ('STORAGE_TANK', 2, 'Check electrical controls as applicable'),
  ('STORAGE_TANK', 3, 'Check burners/heat exchanger where applicable'),
  ('STORAGE_TANK', 4, 'Visual inspection for any leaks'),
  ('SUPPLY_FAN', 1, 'Replace filters if applicable'),
  ('SUPPLY_FAN', 2, 'Check and tension belts if applicable'),
  ('SUPPLY_FAN', 3, 'Check and lubricate/grease bearings and motors if applicable'),
  ('SUPPLY_FAN', 4, 'Check pulleys for wear and tear if applicable'),
  ('UNITARY_SPLIT', 1, 'Replace filters if applicable'),
  ('UNITARY_SPLIT', 2, 'Check and tension belts if applicable'),
  ('UNITARY_SPLIT', 3, 'Check and lubricate/grease bearings and motors if applicable'),
  ('UNITARY_SPLIT', 4, 'Check pulleys for wear and tear if applicable'),
  ('UNITARY_SPLIT', 5, 'Visually check drain pan'),
  ('UNITARY_SPLIT', 6, 'Check evaporator and condenser coils for cleanliness, brush clean as required'),
  ('UNITARY_SPLIT', 7, 'Visually check electrical connections for hot spots'),
  ('UNIT_HEATER_ELECTRIC', 1, 'Check and lubricate motor as required'),
  ('UNIT_HEATER_ELECTRIC', 2, 'Visually check electrical connections for hot spots'),
  ('UNIT_HEATER_ELECTRIC', 3, 'Test run and document supply air temperature'),
  ('UNIT_HEATER_GAS', 1, 'Check and lubricate motor as required'),
  ('UNIT_HEATER_GAS', 2, 'Inspect and clean flame sensor and sparker as required'),
  ('UNIT_HEATER_GAS', 3, 'Ensure unit is venting properly'),
  ('UNIT_HEATER_GAS', 4, 'Visually check heat exchanger'),
  ('UNIT_HEATER_GAS', 5, 'Test fire and document supply air temperature'),
  ('VRF_OUTDOOR', 1, 'Visually check and clean condenser coils as required (brush or compressed air)'),
  ('VRF_OUTDOOR', 2, 'Visually check electrical connections for hot spots'),
  ('VRF_OUTDOOR', 3, 'Check condenser fan motors operation'),
  ('VRF_OUTDOOR', 4, 'Check error code history if applicable'),
  ('MINI_VRF', 1, 'Clean and replace filters'),
  ('MINI_VRF', 2, 'Check and clean evaporator and condenser coils as required (brush or compressed air)'),
  ('MINI_VRF', 3, 'Test drain of indoor units'),
  ('MINI_VRF', 4, 'Clean condensate pump reservoir screen if applicable'),
  ('MINI_VRF', 5, 'Visually check electrical connections for hot spots'),
  ('MINI_VRF', 6, 'Test run and document supply air temperature'),
  ('WSHP', 1, 'Replace filter'),
  ('WSHP', 2, 'Visually inspect drain pan'),
  ('WSHP', 3, 'Visually check electrical connections for hot spots'),
  ('WSHP', 4, 'Test run and document supply air temperature'),
  ('WALK_IN_COOLER', 1, 'Clean evaporator and condenser as required (brush or compressed air)'),
  ('WALK_IN_COOLER', 2, 'Check evaporator and condenser fan motors if applicable'),
  ('WALK_IN_COOLER', 3, 'Visually check electrical connection for hot spots'),
  ('WALK_IN_COOLER', 4, 'Confirm charge via sight glass'),
  ('WALK_IN_COOLER', 5, 'Measure and document supply air delta T'),
  ('WALK_IN_FREEZER', 1, 'Clean evaporator and condenser as required (brush or compressed air)'),
  ('WALK_IN_FREEZER', 2, 'Check evaporator and condenser fan motors if applicable'),
  ('WALK_IN_FREEZER', 3, 'Visually check electrical connection for hot spots'),
  ('WALK_IN_FREEZER', 4, 'Confirm charge via sight glass'),
  ('WALK_IN_FREEZER', 5, 'Measure and document supply air delta T'),
  ('WYE_STRAINER', 1, 'Check for leak');

-- C1
do $$ begin
  perform tests.ok('C1 size', (select count(*) from tests.expected_types) = 40, 'expected list is not 40 types');
  perform tests.ok('C1 missing',
    not exists (select code, name from tests.expected_types except select code, name from private.catalog_asset_types),
    'a source type is missing from the template');
  perform tests.ok('C1 extra',
    not exists (select code, name from private.catalog_asset_types except select code, name from tests.expected_types),
    'the template has a type the source does not');
end $$;

-- C2
do $$
declare r record;
begin
  perform tests.ok('C2 total', (select count(*) from private.catalog_asset_type_tasks) = 174, 'template does not hold 174 tasks');
  for r in select e.code, e.task_count, (select count(*) from private.catalog_asset_type_tasks t where t.code = e.code) as n
           from tests.expected_types e loop
    perform tests.ok('C2 ' || r.code, r.n = r.task_count, format('expected %s tasks, got %s', r.task_count, r.n));
  end loop;
end $$;

-- C3
do $$ begin
  perform tests.ok('C3 size', (select count(*) from tests.expected_tasks) = 174, 'expected list is not 174 tasks');
  perform tests.ok('C3 missing',
    not exists (select code, position, description from tests.expected_tasks
                except select code, position, description from private.catalog_asset_type_tasks),
    'a source task is missing or differs in the template');
  perform tests.ok('C3 extra',
    not exists (select code, position, description from private.catalog_asset_type_tasks
                except select code, position, description from tests.expected_tasks),
    'the template has a task the source does not');
  perform tests.ok('C3 positions',
    not exists (select 1 from private.catalog_asset_type_tasks group by code
                having min(position) <> 1 or max(position) <> count(*)),
    'positions do not run 1..n');
  perform tests.ok('C3 preventer',
    exists (select 1 from private.catalog_asset_types where code = 'BACKFLOW_PREVENTER' and name = 'Backflow preventer'),
    'Backflow preventer name not corrected');
  perform tests.ok('C3 hot spots',
    exists (select 1 from private.catalog_asset_type_tasks where code = 'UNIT_HEATER_ELECTRIC'
            and description = 'Visually check electrical connections for hot spots'),
    'hot spots not corrected');
end $$;

-- C4
do $$ begin
  perform tests.ok('C4',
    not exists (select 1 from private.catalog_asset_types where name ~* '(enviroware|byrne|metro tower|604 803)'
                union all
                select 1 from private.catalog_asset_type_tasks where description ~* '(enviroware|byrne|metro tower|604 803)'),
    'template carries the source company');
end $$;

-- C25
do $$ begin
  perform tests.expect_error('C25 type',
    'insert into private.catalog_asset_types (code, name) values (''RTU'', ''x'')', '23505');
  perform tests.expect_error('C25 task',
    'insert into private.catalog_asset_type_tasks (code, position, description) values (''RTU'', 1, ''x'')', '23505');
end $$;

-- C6 (org A, so org B stays as the fixture left it for C9)
do $$
declare
  v text;
  a uuid := tests.id('orgA');
begin
  foreach v in array array['rtu', 'Rooftop unit', '1RTU', 'RTU-2'] loop
    perform tests.expect_error('C6 ' || v,
      format('insert into public.asset_types (org_id, code, name) values (%L, %L, ''x'')', a, v), '23514');
  end loop;
  foreach v in array array['RTU_2', 'A'] loop
    perform tests.expect_rows('C6 ' || v,
      format('insert into public.asset_types (org_id, code, name) values (%L, %L, ''x'')', a, v), 1);
  end loop;
  perform tests.expect_error('C6 template rtu',
    'insert into private.catalog_asset_types (code, name) values (''rtu'', ''x'')', '23514');
end $$;

-- C26
do $$ begin
  perform tests.ok('C26',
    exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'private' and p.proname = 'seed_org_catalog'
              and p.prorettype = 'integer'::regtype and not p.prosecdef
              and p.proconfig @> array['search_path=""']),
    'seed_org_catalog is not integer, security invoker, search_path empty');
end $$;

-- C5 as authenticated
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C5 authenticated types', 'select count(*) from private.catalog_asset_types', '42501');
  perform tests.expect_error('C5 authenticated tasks', 'select count(*) from private.catalog_asset_type_tasks', '42501');
  perform tests.expect_error('C5 authenticated seed',
    format('select private.seed_org_catalog(%L)', tests.id('orgA')), '42501');
end $$;
reset role;

-- C5 as anon
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C5 anon types', 'select count(*) from private.catalog_asset_types', '42501');
  perform tests.expect_error('C5 anon tasks', 'select count(*) from private.catalog_asset_type_tasks', '42501');
  perform tests.expect_error('C5 anon seed',
    format('select private.seed_org_catalog(%L)', tests.id('orgA')), '42501');
end $$;
reset role;

-- C7: org C has no asset types.
insert into public.orgs (id, name) values (tests.id('orgC'), 'Org C (test)');
do $$
declare
  c uuid := tests.id('orgC');
  n integer;
begin
  n := private.seed_org_catalog(c);
  perform tests.ok('C7 return', n = 40, 'returned ' || n);
  perform tests.ok('C7 types', (select count(*) from public.asset_types where org_id = c) = 40, 'org C does not have 40 types');
  perform tests.ok('C7 tasks', (select count(*) from public.asset_type_tasks where org_id = c) = 174, 'org C does not have 174 tasks');
  perform tests.ok('C7 type set',
    not exists ((select code, name from public.asset_types where org_id = c
                 except select code, name from private.catalog_asset_types)
                union all
                (select code, name from private.catalog_asset_types
                 except select code, name from public.asset_types where org_id = c)),
    'org C types differ from the template');
  perform tests.ok('C7 task set',
    not exists ((select t.code, k.position, k.description from public.asset_type_tasks k
                 join public.asset_types t on t.id = k.asset_type_id where k.org_id = c
                 except select code, position, description from private.catalog_asset_type_tasks)
                union all
                (select code, position, description from private.catalog_asset_type_tasks
                 except select t.code, k.position, k.description from public.asset_type_tasks k
                 join public.asset_types t on t.id = k.asset_type_id where k.org_id = c)),
    'org C tasks differ from the template');
end $$;

-- C8
do $$
declare
  c uuid := tests.id('orgC');
  n integer;
begin
  n := private.seed_org_catalog(c);
  perform tests.ok('C8 return', n = 0, 'returned ' || n);
  perform tests.ok('C8 types', (select count(*) from public.asset_types where org_id = c) = 40, 'type count changed');
  perform tests.ok('C8 tasks', (select count(*) from public.asset_type_tasks where org_id = c) = 174, 'task count changed');
end $$;

-- C9: org B already has RTU 'Rooftop unit' with 1 task 'Replace filters' (fixture).
do $$
declare
  b uuid := tests.id('orgB');
  n integer;
begin
  n := private.seed_org_catalog(b);
  perform tests.ok('C9 return', n = 39, 'returned ' || n);
  perform tests.ok('C9 RTU name',
    (select name from public.asset_types where org_id = b and code = 'RTU') = 'Rooftop unit', 'RTU renamed');
  perform tests.ok('C9 RTU tasks',
    (select array_agg(description order by position) from public.asset_type_tasks
     where asset_type_id = tests.id('typeB')) = array['Replace filters'], 'RTU tasks changed');
  perform tests.ok('C9 types', (select count(*) from public.asset_types where org_id = b) = 40, 'org B does not have 40 types');
  perform tests.ok('C9 tasks', (select count(*) from public.asset_type_tasks where org_id = b) = 165, 'org B does not have 165 tasks');
end $$;

-- C10
do $$
declare
  src text := 'Clean heat exchanger with compressed air';
begin
  update public.asset_type_tasks k set description = 'edited'
  from public.asset_types t
  where t.id = k.asset_type_id and t.org_id = tests.id('orgC') and t.code = 'BOILER' and k.position = 1;
  perform tests.ok('C10 edited',
    (select k.description from public.asset_type_tasks k join public.asset_types t on t.id = k.asset_type_id
     where t.org_id = tests.id('orgC') and t.code = 'BOILER' and k.position = 1) = 'edited', 'org C edit did not apply');
  perform tests.ok('C10 template',
    (select description from private.catalog_asset_type_tasks where code = 'BOILER' and position = 1) = src, 'template changed');
  perform tests.ok('C10 org B',
    (select k.description from public.asset_type_tasks k join public.asset_types t on t.id = k.asset_type_id
     where t.org_id = tests.id('orgB') and t.code = 'BOILER' and k.position = 1) = src, 'org B copy changed');
end $$;

-- C11
do $$
declare
  ghost uuid := gen_random_uuid();
begin
  perform tests.expect_error('C11', format('select private.seed_org_catalog(%L)', ghost), '23503');
  perform tests.ok('C11 rows', (select count(*) from public.asset_types where org_id = ghost) = 0, 'rows inserted for a missing org');
end $$;

rollback;
select 'catalog_seed: pass' as result;
