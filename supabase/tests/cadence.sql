-- cadence, database side: C1060, C1061, C1070, C1071, C1073, C1076, C1078, C1079, C1082, C1087, C1088, C1090, C1093,
-- C1099. Run after fixture.sql in the same execute_sql call (npm run test:db cadence). Fixture: org A owner uA,
-- estimator uE, viewer uV; agrA a draft on siteA (RTU-1 of typeA, code RTU "Rooftop unit"), current version ver2A
-- holding lineA (4 visits); org B's typeB is also RTU. Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

-- More types for org A: BOILER "Boiler" and AHU "AHU".
insert into public.asset_types (id, org_id, code, name) values
  (tests.id('cd:boiler'), tests.id('orgA'), 'BOILER', 'Boiler'),
  (tests.id('cd:ahu'), tests.id('orgA'), 'AHU', 'AHU');

-- Reads past RLS, whoever is signed in.
create function tests.cd_text(p_sql text) returns text
language plpgsql security definer as $$
declare t text;
begin
  execute p_sql into t;
  return t;
end $$;

create function tests.cd_count(p_sql text) returns bigint
language plpgsql security definer as $$
declare n bigint;
begin
  execute p_sql into n;
  return n;
end $$;

-- The covered asset type ids of a line, sorted, as text.
create function tests.cd_cover(p_line uuid) returns text
language sql security definer as $$
  select coalesce(array_agg(asset_type_id order by asset_type_id)::text, '{}')
  from public.service_line_asset_types where service_line_id = p_line
$$;

create function tests.cd_ids(p_names text[]) returns text
language sql immutable as $$
  select array_agg(tests.id(n) order by tests.id(n))::text from unnest(p_names) n
$$;

-- An agreement <name> in <status> on its own site <name>:site holding p_assets (fixture type names), with version 1.
create function tests.cd_agr(p_name text, p_status text, p_assets text[] default '{typeA}') returns uuid
language plpgsql as $$
declare t text;
begin
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name || ':site'), tests.id('orgA'), tests.id('custA'), 'Site ' || p_name);
  foreach t in array p_assets loop
    insert into public.assets (org_id, site_id, asset_type_id, unit_no)
    values (tests.id('orgA'), tests.id(p_name || ':site'), tests.id(t), t || '-1');
  end loop;
  insert into public.agreements (id, org_id, site_id, number, status)
  values (tests.id(p_name), tests.id('orgA'), tests.id(p_name || ':site'), p_name, p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  values (tests.id(p_name || ':v1'), tests.id('orgA'), tests.id(p_name), 1);
  return tests.id(p_name);
end $$;

-- A line <version>:l<position> written as the table owner, with p_types covered (fixture type names).
create function tests.cd_line(p_version text, p_position int, p_months smallint[], p_types text[] default '{}') returns uuid
language plpgsql as $$
declare t text;
begin
  insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                    cost_per_visit_cents)
  values (tests.id(p_version || ':l' || p_position), tests.id('orgA'), tests.id(p_version), p_position, 'Line ' || p_position,
          p_months, cardinality(p_months), 10000);
  foreach t in array p_types loop
    insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
    values (tests.id('orgA'), tests.id(p_version || ':l' || p_position), tests.id(t));
  end loop;
  return tests.id(p_version || ':l' || p_position);
end $$;

create function tests.cd_rpc_sql(p_agreement uuid, p_line uuid, p_months text, p_types uuid[], p_description text default 'Quarterly PM')
returns text
language sql as $$
  select format('select public.save_service_line(%L, %L, %L, %L::smallint[], 25000, %L::uuid[])',
                p_agreement, p_line, p_description, p_months, p_types)
$$;

create table tests.cd_results (k text, v text);
grant all on tests.cd_results to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- C1060: door 1 refuses empty, descending, repeated and out-of-range months, and a count that is not their number.
do $$
declare v text;
begin
  foreach v in array array['{}', '{6,3}', '{3,3}', '{0}', '{13}'] loop
    perform tests.expect_error('C1060 ' || v,
      format('update public.service_lines set visit_months = %L, visits_per_year = greatest(cardinality(%L::smallint[]), 1) where id = %L',
             v, v, tests.id('lineA')), '23514');
  end loop;
  perform tests.expect_error('C1060 count',
    format('update public.service_lines set visit_months = ''{3,6,9,12}'', visits_per_year = 5 where id = %L', tests.id('lineA')), '23514');
  perform tests.expect_rows('C1060 accepted',
    format('update public.service_lines set visit_months = ''{3,6,9,12}'', visits_per_year = 4 where id = %L', tests.id('lineA')), 1);
end $$;

-- C1061: the RPC stores visits per year as the number of months; annual is visits x cost.
select tests.act_as('uE');
do $$
declare line uuid;
begin
  line := public.save_service_line(tests.id('agrA'), null, 'Quarterly PM', '{3,6,9,12}', 25000, array[tests.id('typeA')]);
  insert into tests.cd_results values ('line', line::text);
  perform tests.ok('C1061 visits', (select visits_per_year from public.service_lines where id = line) = 4,
    'visits_per_year is not 4');
  perform tests.ok('C1061 annual', (select visits_per_year * cost_per_visit_cents from public.service_lines where id = line) = 100000,
    'annual is not 100000');
  perform tests.ok('C1061 months', (select visit_months from public.service_lines where id = line) = '{3,6,9,12}'::smallint[],
    'months not stored');
  perform tests.ok('C1061 version', (select agreement_version_id from public.service_lines where id = line) = tests.id('ver2A'),
    'the line is not on the latest version');
  perform tests.ok('C1061 after last', (select position from public.service_lines where id = line)
    > (select position from public.service_lines where id = tests.id('lineA')), 'the line is not after the last one');
  -- 422: the RPC refuses no type and bad months with 23514.
  perform tests.expect_error('C1060 rpc no type', tests.cd_rpc_sql(tests.id('agrA'), null, '{3,6,9,12}', '{}'), '23514');
  perform tests.expect_error('C1060 rpc bad months', tests.cd_rpc_sql(tests.id('agrA'), null, '{6,3}', array[tests.id('typeA')]), '23514');
  perform tests.expect_error('C1060 rpc no months', tests.cd_rpc_sql(tests.id('agrA'), null, '{}', array[tests.id('typeA')]), '23514');
end $$;

-- C1070: another org's type is refused with 23503 and nothing persists, on add and on update.
do $$
declare
  line uuid := (select v::uuid from tests.cd_results where k = 'line');
  lines bigint := (select count(*) from public.service_lines where agreement_version_id = tests.id('ver2A'));
  cover bigint := tests.cd_count('select count(*) from public.service_line_asset_types');
begin
  perform tests.expect_error('C1070 add', tests.cd_rpc_sql(tests.id('agrA'), null, '{3,6,9,12}', array[tests.id('typeB')]), '23503');
  perform tests.ok('C1070 add line count', (select count(*) from public.service_lines where agreement_version_id = tests.id('ver2A')) = lines,
    'a line was added');
  perform tests.ok('C1070 add coverage', tests.cd_count('select count(*) from public.service_line_asset_types') = cover,
    'a coverage row was added');
  perform tests.expect_error('C1070 update',
    tests.cd_rpc_sql(tests.id('agrA'), line, '{4,10}', array[tests.id('typeB')], 'Changed'), '23503');
  perform tests.ok('C1070 update kept',
    (select description = 'Quarterly PM' and visit_months = '{3,6,9,12}'::smallint[] and visits_per_year = 4
     from public.service_lines where id = line), 'the line changed');
  perform tests.ok('C1070 update coverage kept', tests.cd_cover(line) = tests.cd_ids('{typeA}'), 'the coverage changed');
end $$;

-- C1071: the RPC writes the coverage, and a second call replaces it.
do $$
declare line uuid;
begin
  line := public.save_service_line(tests.id('agrA'), null, 'Mixed', '{4,10}', 15000, array[tests.id('typeA'), tests.id('cd:boiler')]);
  perform tests.ok('C1071 uuid', line is not null, 'no id returned');
  perform tests.ok('C1071 two rows', tests.cd_cover(line) = tests.cd_ids('{typeA,cd:boiler}'),
    'coverage is ' || tests.cd_cover(line));
  perform tests.ok('C1071 returned', public.save_service_line(tests.id('agrA'), line, 'Mixed', '{4,10}', 15000,
    array[tests.id('typeA')]) = line, 'update returned another id');
  perform tests.ok('C1071 one row', tests.cd_cover(line) = tests.cd_ids('{typeA}'), 'coverage is ' || tests.cd_cover(line));
end $$;

-- C1073: 50 lines, a viewer and a missing agreement.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.cd_agr('cd:full', 'draft');
insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
select tests.id('orgA'), tests.id('cd:full:v1'), i, 'Line ' || i, '{10}', 1, 100 from generate_series(0, 49) i;
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1073 50 lines', tests.cd_rpc_sql(tests.id('cd:full'), null, '{10}', array[tests.id('typeA')]), '54000');
  perform tests.ok('C1073 still 50', (select count(*) from public.service_lines where agreement_version_id = tests.id('cd:full:v1')) = 50,
    'a 51st line was added');
  perform tests.expect_error('C1073 missing agreement',
    tests.cd_rpc_sql(tests.id('no such agreement'), null, '{10}', array[tests.id('typeA')]), 'P0002');
  perform tests.expect_error('C1073 missing line',
    tests.cd_rpc_sql(tests.id('agrA'), tests.id('no such line'), '{10}', array[tests.id('typeA')]), 'P0002');
end $$;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C1073 viewer', tests.cd_rpc_sql(tests.id('agrA'), null, '{10}', array[tests.id('typeA')]), '42501');
end $$;

-- C1076: the catalog's default months, over all 40 codes.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  expected jsonb := '{
    "{3,6,9,12}": ["AHU", "CASE_COOLER", "CASE_FREEZER", "CHILLER", "COOLING_TOWER", "DUCTLESS_SPLIT", "ERV", "FAN_COIL",
                   "HRV", "ICE_MACHINE", "MINI_VRF", "MUA", "PTAC", "RTU", "UNITARY_SPLIT", "VRF_OUTDOOR", "WALK_IN_COOLER",
                   "WALK_IN_FREEZER", "WSHP"],
    "{4,10}": ["AIR_SEPARATOR", "CO_SENSOR", "EXHAUST_FAN", "HEAT_EXCHANGER", "PUMP", "SIDE_STREAM_FILTER", "SUPPLY_FAN",
               "WYE_STRAINER"],
    "{10}": ["ACID_NEUTRALIZER", "BACKFLOW_PREVENTER", "BOILER", "EXPANSION_TANK", "FIRE_DAMPER", "FURNACE",
             "HWT_HIGH_EFFICIENCY", "HWT_MID_EFFICIENCY", "INDIRECT_TANK", "PRESSURE_REGULATING_VALVE", "STORAGE_TANK",
             "UNIT_HEATER_ELECTRIC", "UNIT_HEATER_GAS"]}';
  r record;
begin
  perform tests.ok('C1076 sizes', jsonb_array_length(expected -> '{3,6,9,12}') = 19 and jsonb_array_length(expected -> '{4,10}') = 8
    and jsonb_array_length(expected -> '{10}') = 13, 'the expected table is not 19 + 8 + 13');
  perform tests.ok('C1076 40 codes', (select count(*) from private.catalog_asset_types) = 40, 'the catalog does not have 40 codes');
  for r in select e.key as months, c.code from jsonb_each(expected) e, jsonb_array_elements_text(e.value) c(code) loop
    perform tests.ok('C1076 ' || r.code,
      (select default_visit_months from private.catalog_asset_types where code = r.code) = r.months::smallint[],
      r.code || ' is ' || coalesce((select default_visit_months::text from private.catalog_asset_types where code = r.code), 'missing'));
  end loop;
end $$;

-- C1078: a seeded org's types carry the catalog's defaults.
do $$
declare o uuid := tests.id('cd:fresh org');
begin
  insert into public.orgs (id, name) values (o, 'Fresh (test)');
  perform private.seed_org_catalog(o);
  perform tests.ok('C1078 RTU', (select default_visit_months from public.asset_types where org_id = o and code = 'RTU') = '{3,6,9,12}', 'RTU');
  perform tests.ok('C1078 EXHAUST_FAN', (select default_visit_months from public.asset_types where org_id = o and code = 'EXHAUST_FAN') = '{4,10}',
    'EXHAUST_FAN');
  perform tests.ok('C1078 BOILER', (select default_visit_months from public.asset_types where org_id = o and code = 'BOILER') = '{10}', 'BOILER');
  perform tests.ok('C1078 all', (select count(*) from public.asset_types where org_id = o) = 40
    and not exists (select 1 from public.asset_types t join private.catalog_asset_types c using (code)
                    where t.org_id = o and t.default_visit_months is distinct from c.default_visit_months),
    'a seeded type differs from its catalog default');
end $$;

-- C1079: door 3 refuses bad default months and null.
do $$ begin
  perform tests.expect_error('C1079 empty',
    format('update public.asset_types set default_visit_months = ''{}'' where id = %L', tests.id('typeA')), '23514');
  perform tests.expect_error('C1079 13',
    format('update public.asset_types set default_visit_months = ''{13}'' where id = %L', tests.id('typeA')), '23514');
  perform tests.expect_error('C1079 null',
    format('update public.asset_types set default_visit_months = null where id = %L', tests.id('typeA')), '23502');
end $$;

-- C1082 and C1099: a draft with months and coverage is sent; the portal reads them per line.
select tests.cd_agr('cd:portal', 'draft', '{typeA,cd:boiler,cd:ahu}');
select tests.cd_line('cd:portal:v1', 0, '{3,6,9,12}', '{typeA,cd:ahu,cd:boiler}');
select tests.cd_line('cd:portal:v1', 1, '{10}', '{cd:boiler}');
select tests.cd_agr('cd:empty', 'draft');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1099 no lines',
    format('select public.send_agreement(%L, %L, ''agreement.sent'', ''{}'')', tests.id('cd:empty'),
           encode(sha256(convert_to('cd:empty', 'UTF8')), 'hex')), '23514');
  perform public.send_agreement(tests.id('cd:portal'), encode(sha256(convert_to('cd:portal', 'UTF8')), 'hex'), 'agreement.sent',
                                '{"from": "draft", "to": "sent"}');
  perform tests.ok('C1099 sent', (select status from public.agreements where id = tests.id('cd:portal')) = 'sent', 'not sent');
end $$;
select tests.act_as_anon();
do $$
declare d jsonb := public.portal_view(encode(sha256(convert_to('cd:portal', 'UTF8')), 'hex'));
begin
  perform tests.ok('C1082 unknown', public.portal_view(encode(sha256(convert_to('cd:nothing', 'UTF8')), 'hex')) is null,
    'an unknown hash returned a view');
  perform tests.ok('C1082 months', d -> 'lines' -> 0 -> 'visitMonths' = '[3,6,9,12]'::jsonb
    and d -> 'lines' -> 1 -> 'visitMonths' = '[10]'::jsonb, 'visitMonths are ' || coalesce(d ->> 'lines', 'null'));
  perform tests.ok('C1082 equipment', d -> 'lines' -> 0 -> 'equipment'
    = '[{"code": "AHU", "name": "AHU"}, {"code": "BOILER", "name": "Boiler"}, {"code": "RTU", "name": "Rooftop unit"}]'::jsonb
    and d -> 'lines' -> 1 -> 'equipment' = '[{"code": "BOILER", "name": "Boiler"}]'::jsonb,
    'equipment is ' || coalesce(d ->> 'lines', 'null'));
  perform tests.ok('C1082 kept keys', d -> 'lines' -> 0 ->> 'visitsPerYear' = '4' and d -> 'lines' -> 0 ->> 'annualCents' = '40000'
    and d ->> 'annualCents' = '50000', 'the existing line keys changed');
end $$;

-- C1087: a revise copies months and coverage into version 2 and leaves version 1 as it was.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.cd_agr('cd:rev', 'changes_requested', '{typeA,cd:boiler}');
select tests.cd_line('cd:rev:v1', 0, '{4,10}', '{typeA,cd:boiler}');
select tests.act_as('uE');
do $$
declare v2line uuid;
begin
  perform public.apply_agreement_transition(tests.id('cd:rev'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":2}');
  select l.id into v2line from public.service_lines l join public.agreement_versions v on v.id = l.agreement_version_id
  where v.agreement_id = tests.id('cd:rev') and v.version_no = 2;
  perform tests.ok('C1087 v2 line', v2line is not null and v2line <> tests.id('cd:rev:v1:l0'), 'no new line on version 2');
  perform tests.ok('C1087 v2 months', (select visit_months from public.service_lines where id = v2line) = '{4,10}'::smallint[],
    'version 2 months differ');
  perform tests.ok('C1087 v2 types', tests.cd_cover(v2line) = tests.cd_ids('{typeA,cd:boiler}'), 'version 2 coverage differs');
  perform tests.ok('C1087 v1 kept', (select visit_months = '{4,10}'::smallint[] and agreement_version_id = tests.id('cd:rev:v1')
    from public.service_lines where id = tests.id('cd:rev:v1:l0')), 'version 1 line changed');
  perform tests.ok('C1087 v1 types', tests.cd_cover(tests.id('cd:rev:v1:l0')) = tests.cd_ids('{typeA,cd:boiler}'),
    'version 1 coverage changed');
end $$;

-- C1088: coverage of a sent agreement or a past draft version is frozen for members; the table owner passes; a line
-- delete on the current draft takes its coverage with it.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.cd_agr('cd:sent', 'sent', '{typeA,cd:boiler}');
select tests.cd_line('cd:sent:v1', 0, '{4,10}', '{typeA}');
select tests.cd_line('verA', 0, '{4,10}', '{typeA}');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1088 sent insert',
    format('insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values (%L, %L, %L)',
           tests.id('orgA'), tests.id('cd:sent:v1:l0'), tests.id('cd:boiler')), '55000');
  perform tests.expect_error('C1088 sent delete',
    format('delete from public.service_line_asset_types where service_line_id = %L', tests.id('cd:sent:v1:l0')), '55000');
  perform tests.expect_error('C1088 past version insert',
    format('insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values (%L, %L, %L)',
           tests.id('orgA'), tests.id('verA:l0'), tests.id('cd:boiler')), '55000');
  perform tests.expect_error('C1088 past version delete',
    format('delete from public.service_line_asset_types where service_line_id = %L', tests.id('verA:l0')), '55000');
  perform tests.expect_error('C1088 rpc on sent',
    tests.cd_rpc_sql(tests.id('cd:sent'), tests.id('cd:sent:v1:l0'), '{10}', array[tests.id('typeA')]), '55000');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.expect_rows('C1088 owner insert',
    format('insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values (%L, %L, %L)',
           tests.id('orgA'), tests.id('cd:sent:v1:l0'), tests.id('cd:boiler')), 1);
end $$;
select tests.cd_line('ver2A', 90, '{4,10}', '{typeA,cd:boiler}');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_rows('C1088 line delete', format('delete from public.service_lines where id = %L', tests.id('ver2A:l90')), 1);
  perform tests.ok('C1088 cascade',
    tests.cd_count(format('select count(*) from public.service_line_asset_types where service_line_id = %L', tests.id('ver2A:l90'))) = 0,
    'the coverage rows outlived their line');
end $$;

-- C1090: door 5, n visits -> months; more than 12 or fewer than 1 raises.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare r record; n int;
begin
  for r in select * from (values (1, '{1}'), (2, '{4,10}'), (3, '{1,5,9}'), (4, '{3,6,9,12}'), (6, '{1,3,5,7,9,11}'),
                                 (8, '{1,2,4,5,7,8,10,11}'), (12, '{1,2,3,4,5,6,7,8,9,10,11,12}')) x(n, months) loop
    perform tests.ok('C1090 ' || r.n, private.months_for_visits(r.n) = r.months::smallint[],
      r.n || ' gives ' || coalesce(private.months_for_visits(r.n)::text, 'null'));
  end loop;
  foreach n in array array[13, 0] loop
    begin
      perform private.months_for_visits(n);
      raise exception 'C1090 %: no exception', n;
    exception when others then
      if sqlerrm = 'C1090 ' || n || ': no exception' then
        raise;
      end if;
    end;
  end loop;
end $$;

-- C1093: the backfill covers a frozen version from its snapshot and a draft from its site, and adds nothing twice.
select tests.cd_agr('cd:bf frozen', 'sent', '{typeA}');
update public.agreement_versions
set snapshot = '{"schema": 1, "takenAt": "2026-10-01T00:00:00+00:00", "types": [{"code": "BOILER", "name": "Boiler", "tasks": [], "assets": []}]}'
where id = tests.id('cd:bf frozen:v1');
select tests.cd_line('cd:bf frozen:v1', 0, '{10}');
select tests.cd_agr('cd:bf draft', 'draft', '{typeA,cd:ahu}');
select tests.cd_line('cd:bf draft:v1', 0, '{3,6,9,12}');
do $$
declare n bigint;
begin
  perform private.backfill_line_coverage();
  perform tests.ok('C1093 frozen', tests.cd_cover(tests.id('cd:bf frozen:v1:l0')) = tests.cd_ids('{cd:boiler}'),
    'frozen line covers ' || tests.cd_cover(tests.id('cd:bf frozen:v1:l0')));
  perform tests.ok('C1093 site', tests.cd_cover(tests.id('cd:bf draft:v1:l0')) = tests.cd_ids('{typeA,cd:ahu}'),
    'draft line covers ' || tests.cd_cover(tests.id('cd:bf draft:v1:l0')));
  n := (select count(*) from public.service_line_asset_types);
  perform private.backfill_line_coverage();
  perform tests.ok('C1093 twice', (select count(*) from public.service_line_asset_types) = n, 'the second run added rows');
end $$;

rollback;
select 'cadence: pass' as result;
