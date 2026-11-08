-- type-editor, database side: C1901-C1913, C1915-C1918, C1920-C1928, C1934-C1936, C1939, C1940
-- (.specs/features/type-editor/checks.md). Run after fixture.sql in the same execute_sql call (npm run test:db type_editor).
-- Fixture: org A owner uA, estimator uE, viewer uV; typeA is RTU "Rooftop unit" with one task, an asset, and org B owner uB.
-- Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- A second template pack for C1920 and C1936, and three empty orgs to seed.
insert into private.catalog_asset_types (pack, code, name, default_visit_months) values
  ('tl_plumb', 'SUMP', 'Sump pit', '{4,10}'),
  ('tl_plumb', 'GREASE', 'Grease trap', '{1,7}');
insert into private.catalog_asset_type_tasks (pack, code, position, description) values
  ('tl_plumb', 'SUMP', 1, 'Clear the pit'),
  ('tl_plumb', 'SUMP', 2, 'Test the float'),
  ('tl_plumb', 'GREASE', 1, 'Pump out');
insert into public.orgs (id, name) values (tests.id('orgX'), 'Org X'), (tests.id('orgY'), 'Org Y'), (tests.id('orgZ'), 'Org Z');

-- typeA belongs to the hvac pack, like a seeded type.
update public.asset_types set pack = 'hvac' where id = tests.id('typeA');

-- name|months|pack|task count|id of a type by org and code, read past RLS.
create function tests.te_state(p_org uuid, p_code text) returns text
language sql security definer as $$
  select t.name || '|' || t.default_visit_months::text || '|' || coalesce(t.pack, '-') || '|' ||
         (select count(*) from public.asset_type_tasks k where k.asset_type_id = t.id) || '|' || t.id
  from public.asset_types t where t.org_id = p_org and t.code = p_code
$$;

create function tests.te_tasks(p_org uuid, p_code text) returns text
language sql security definer as $$
  select coalesce(string_agg(k.position || ':' || k.description || ':' || coalesce(k.visit_months::text, 'null'), ' | ' order by k.position), '')
  from public.asset_type_tasks k join public.asset_types t on t.id = k.asset_type_id
  where t.org_id = p_org and t.code = p_code
$$;

create function tests.te_types(p_org uuid) returns bigint
language sql security definer as $$ select count(*) from public.asset_types where org_id = p_org $$;

grant execute on function tests.te_state(uuid, text), tests.te_tasks(uuid, text), tests.te_types(uuid) to anon, authenticated;

-- A sent agreement with a fixed snapshot, for C1913 and C1917.
select tests.pe_sent('te-sent', '2027-12-31');
update public.agreement_versions set snapshot = '{"schema":2,"types":[{"code":"RTU","name":"Rooftop unit"}]}'::jsonb
where id = tests.id('te-sent:v1');
create table tests.te_before as
  select md5(snapshot::text) as digest, (select md5(c::text) from public.contracts c where c.id = tests.id('conA')) as contract
  from public.agreement_versions where id = tests.id('te-sent:v1');
grant select on tests.te_before to anon, authenticated;

-- C1901-C1905, C1907: the owner adds types.
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  n bigint := tests.te_types(tests.id('orgA'));
  c text;
begin
  c := public.create_task_library_type(a, '  Sump pump  ');
  perform tests.ok('C1901 code', c = 'SUMP_PUMP', 'returned ' || c);
  perform tests.ok('C1901 row', tests.te_state(a, 'SUMP_PUMP') like 'Sump pump|{3,6,9,12}|-|0|%', tests.te_state(a, 'SUMP_PUMP'));
  perform tests.ok('C1901 count', tests.te_types(a) = n + 1, 'one type was not added');

  perform tests.ok('C1902 second', public.create_task_library_type(a, 'Sump-pump!') = 'SUMP_PUMP_2', 'second code');
  perform tests.ok('C1902 third', public.create_task_library_type(a, 'Sump_pump') = 'SUMP_PUMP_3', 'third code');

  perform tests.ok('C1903 digit', public.create_task_library_type(a, '2-pipe fan coil') = 'T_2_PIPE_FAN_COIL', 'digit code');

  c := public.create_task_library_type(a, repeat('a', 60));
  perform tests.ok('C1904 cap', char_length(c) = 40, 'code is ' || char_length(c) || ' characters');

  n := tests.te_types(a);
  perform tests.expect_error('C1905 empty', format('select public.create_task_library_type(%L, %L)', a, ''), '23514');
  perform tests.expect_error('C1905 spaces', format('select public.create_task_library_type(%L, %L)', a, '   '), '23514');
  perform tests.expect_error('C1905 long', format('select public.create_task_library_type(%L, %L)', a, repeat('a', 61)), '23514');
  perform tests.expect_error('C1905 symbols', format('select public.create_task_library_type(%L, %L)', a, '--- !!!'), '23514');
  perform tests.ok('C1905 no row', tests.te_types(a) = n, 'a refused name added a row');

  perform tests.expect_error('C1907 duplicate', format('select public.create_task_library_type(%L, %L)', a, 'SUMP PUMP'), '23505');
  perform tests.ok('C1907 one row', tests.te_types(a) = n, 'the duplicate was added');
end $$;
reset role;

-- C1910-C1913: rename.
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  v_before text;
begin
  perform public.create_task_library_type(a, 'Rename me');
  insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
  select a, t.id, 1, 'Check it', '{5}' from public.asset_types t where t.org_id = a and t.code = 'RENAME_ME';
  update public.asset_types set default_visit_months = '{2,8}' where org_id = a and code = 'RENAME_ME';
  v_before := tests.te_state(a, 'RENAME_ME') || '#' || tests.te_tasks(a, 'RENAME_ME');

  perform public.rename_task_library_type('RENAME_ME', 'Renamed type');
  perform tests.ok('C1910 name only',
    tests.te_state(a, 'RENAME_ME') = replace(split_part(v_before, '#', 1), 'Rename me|', 'Renamed type|')
    and tests.te_tasks(a, 'RENAME_ME') = split_part(v_before, '#', 2),
    'rename changed more than the name: ' || tests.te_state(a, 'RENAME_ME'));

  perform tests.expect_error('C1911 taken', $q$select public.rename_task_library_type('RENAME_ME', 'sump PUMP')$q$, '23505');
  perform tests.ok('C1911 kept', tests.te_state(a, 'RENAME_ME') like 'Renamed type|%', 'name changed on refusal');
  perform public.rename_task_library_type('SUMP_PUMP', 'sump PUMP');
  perform tests.ok('C1911 own case', tests.te_state(a, 'SUMP_PUMP') like 'sump PUMP|%', 'case-only rename refused');

  perform tests.expect_error('C1912 empty', $q$select public.rename_task_library_type('RENAME_ME', '')$q$, '23514');
  perform tests.expect_error('C1912 long', format('select public.rename_task_library_type(%L, %L)', 'RENAME_ME', repeat('a', 61)), '23514');
  perform tests.ok('C1912 kept', tests.te_state(a, 'RENAME_ME') like 'Renamed type|%', 'name changed on refusal');
end $$;
reset role;

do $$
begin
  perform tests.ok('C1913 snapshot',
    (select md5(snapshot::text) from public.agreement_versions where id = tests.id('te-sent:v1')) = (select digest from tests.te_before),
    'a rename changed a sent snapshot');
end $$;

-- C1939: an unknown code.
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1939 rename', $q$select public.rename_task_library_type('NO_SUCH', 'x')$q$, 'P0002');
  perform tests.expect_error('C1939 remove', $q$select public.remove_task_library_type('NO_SUCH')$q$, 'P0002');
  perform tests.expect_error('C1939 reset', $q$select public.reset_task_library_type('NO_SUCH')$q$, 'P0002');
end $$;
reset role;

-- C1915, C1918: remove.
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  others text := tests.te_tasks(a, 'RTU');
  total bigint := (select count(*) from public.asset_type_tasks where org_id = tests.id('orgA'));
begin
  perform public.create_task_library_type(a, 'Temp type');
  insert into public.asset_type_tasks (org_id, asset_type_id, position, description)
  select a, t.id, g, 'Task ' || g from public.asset_types t, generate_series(1, 3) g where t.org_id = a and t.code = 'TEMP_TYPE';
  perform tests.ok('C1915 setup', tests.te_state(a, 'TEMP_TYPE') like '%|3|%', 'three tasks were not added');
  perform public.remove_task_library_type('TEMP_TYPE');
  perform tests.ok('C1915 gone', tests.te_state(a, 'TEMP_TYPE') is null, 'the type remains');
  perform tests.ok('C1915 tasks', (select count(*) from public.asset_type_tasks where org_id = a) = total, 'task count is not back to ' || total);
  perform tests.ok('C1915 others', tests.te_tasks(a, 'RTU') = others, 'another type lost tasks');
end $$;
reset role;

-- C1916, C1918: a type in use is refused and left whole; one use of each kind.
do $$
declare
  a uuid := tests.id('orgA');
  u text;
  v_id uuid;
  v_state text;
begin
  foreach u in array array['asset', 'line', 'import'] loop
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    insert into public.asset_types (org_id, code, name) values (a, 'USED_' || u, 'Used by ' || u) returning id into v_id;
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description) values (a, v_id, 1, 'One'), (a, v_id, 2, 'Two');
    if u = 'asset' then
      insert into public.assets (org_id, site_id, asset_type_id, unit_no) values (a, tests.id('siteA'), v_id, 'U-USED');
    elsif u = 'line' then
      insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id) values (a, tests.id('lineA'), v_id);
    else
      update public.import_rows set asset_type_id = v_id where id = tests.id('rowA');
    end if;
    v_state := tests.te_state(a, 'USED_' || u);

    perform tests.act_as('uA');
    perform tests.expect_error('C1916 ' || u, format('select public.remove_task_library_type(%L)', 'USED_' || u), '23503');
    perform tests.ok('C1918 ' || u, tests.te_state(a, 'USED_' || u) = v_state, 'the type or its tasks changed after the refusal');
    execute 'reset role';
  end loop;
end $$;
reset role;

-- C1917: the sent snapshot and the contract are untouched after a removal.
select tests.act_as('uA');
do $$ begin
  perform public.create_task_library_type(tests.id('orgA'), 'Gone soon');
  perform public.remove_task_library_type('GONE_SOON');
end $$;
reset role;
do $$ begin
  perform tests.ok('C1917 snapshot',
    (select md5(snapshot::text) from public.agreement_versions where id = tests.id('te-sent:v1')) = (select digest from tests.te_before),
    'a removal changed a sent snapshot');
  perform tests.ok('C1917 contract',
    (select md5(c::text) from public.contracts c where c.id = tests.id('conA')) = (select contract from tests.te_before),
    'a removal changed a contract');
end $$;

-- C1928: a reset whose name is taken changes nothing.
update public.asset_types set name = 'Rooftop unit', default_visit_months = '{1}' where id = tests.id('typeA');
delete from public.asset_type_tasks where asset_type_id = tests.id('typeA');
insert into public.asset_type_tasks (org_id, asset_type_id, position, description) values (tests.id('orgA'), tests.id('typeA'), 1, 'Only task');
insert into public.asset_types (org_id, code, name) values (tests.id('orgA'), 'RTU_HAND', 'rtu');
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  v_state text := tests.te_state(tests.id('orgA'), 'RTU');
begin
  perform tests.expect_error('C1928 taken', $q$select public.reset_task_library_type('RTU')$q$, '23505');
  perform tests.ok('C1928 unchanged', tests.te_state(a, 'RTU') = v_state and tests.te_tasks(a, 'RTU') = '1:Only task:null',
    'a refused reset changed the type');
end $$;
reset role;
delete from public.asset_types where org_id = tests.id('orgA') and code = 'RTU_HAND';

-- C1926: reset restores name, months and checklist from the pack, keeping id and code.
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  v_id text := split_part(tests.te_state(tests.id('orgA'), 'RTU'), '|', 5);
  v_months text;
  v_tasks text;
  v_count bigint;
begin
  select default_visit_months::text into v_months from private.catalog_asset_types where pack = 'hvac' and code = 'RTU';
  perform public.reset_task_library_type('RTU');
  select string_agg(t.position || ':' || t.description || ':' || coalesce(t.visit_months::text, 'null'), ' | ' order by t.position), count(*)
  into v_tasks, v_count from private.catalog_asset_type_tasks t where t.pack = 'hvac' and t.code = 'RTU';
  perform tests.ok('C1926 name', tests.te_state(a, 'RTU') like 'RTU|' || v_months || '|hvac|' || v_count || '|' || v_id, tests.te_state(a, 'RTU'));
  perform tests.ok('C1926 tasks', tests.te_tasks(a, 'RTU') = v_tasks, 'checklist is not the template');
  perform tests.ok('C1926 ten', v_count = 10, 'the RTU template has ' || v_count || ' tasks');
  perform tests.ok('C1926 seasonal', (select count(*) from public.asset_type_tasks where asset_type_id = v_id::uuid and visit_months is not null) = 2,
    'the two seasonal tasks lost their months');
end $$;
reset role;

-- C1927: nothing to reset to.
insert into public.asset_types (org_id, code, name, pack) values (tests.id('orgA'), 'GONE', 'Gone type', 'hvac');
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  v_hand text := tests.te_state(tests.id('orgA'), 'SUMP_PUMP');
  v_gone text := tests.te_state(tests.id('orgA'), 'GONE');
begin
  perform tests.expect_error('C1927 no pack', $q$select public.reset_task_library_type('SUMP_PUMP')$q$, '55000');
  perform tests.expect_error('C1927 no template', $q$select public.reset_task_library_type('GONE')$q$, '55000');
  perform tests.ok('C1927 unchanged', tests.te_state(a, 'SUMP_PUMP') = v_hand and tests.te_state(a, 'GONE') = v_gone, 'a refused reset changed a type');
end $$;
reset role;

-- C1909: who may call. Org A's SUMP_PUMP is visible to org A members and hidden from org B.
do $$
declare
  u text;
  f text;
  a uuid := tests.id('orgA');
begin
  foreach u in array array['uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C1909 ' || u || ' create', format('select public.create_task_library_type(%L, ''Nope'')', a), '42501');
    perform tests.expect_error('C1909 ' || u || ' rename', $q$select public.rename_task_library_type('SUMP_PUMP', 'Nope')$q$, '42501');
    perform tests.expect_error('C1909 ' || u || ' remove', $q$select public.remove_task_library_type('SUMP_PUMP')$q$, '42501');
    perform tests.expect_error('C1909 ' || u || ' reset', $q$select public.reset_task_library_type('SUMP_PUMP')$q$, '42501');
    execute 'reset role';
  end loop;

  perform tests.act_as('uB');
  perform tests.expect_error('C1909 uB create', format('select public.create_task_library_type(%L, ''Nope'')', a), '42501');
  perform tests.expect_error('C1909 uB rename', $q$select public.rename_task_library_type('SUMP_PUMP', 'Nope')$q$, 'P0002');
  perform tests.expect_error('C1909 uB remove', $q$select public.remove_task_library_type('SUMP_PUMP')$q$, 'P0002');
  perform tests.expect_error('C1909 uB reset', $q$select public.reset_task_library_type('SUMP_PUMP')$q$, 'P0002');
  execute 'reset role';

  perform tests.act_as_anon();
  perform tests.expect_error('C1909 anon create', format('select public.create_task_library_type(%L, ''Nope'')', a), '42501');
  perform tests.expect_error('C1909 anon rename', $q$select public.rename_task_library_type('SUMP_PUMP', 'Nope')$q$, '42501');
  perform tests.expect_error('C1909 anon remove', $q$select public.remove_task_library_type('SUMP_PUMP')$q$, '42501');
  perform tests.expect_error('C1909 anon reset', $q$select public.reset_task_library_type('SUMP_PUMP')$q$, '42501');
  execute 'reset role';
  perform tests.ok('C1909 untouched', tests.te_state(a, 'SUMP_PUMP') like 'sump PUMP|%', 'a refused call changed the type');
end $$;
reset role;

-- C1940: an admin may do all four.
select tests.act_as('uAd');
do $$
declare a uuid := tests.id('orgA');
begin
  perform tests.ok('C1940 create', public.create_task_library_type(a, 'Admin made') = 'ADMIN_MADE', 'admin cannot create');
  perform public.rename_task_library_type('ADMIN_MADE', 'Admin renamed');
  perform tests.ok('C1940 rename', tests.te_state(a, 'ADMIN_MADE') like 'Admin renamed|%', 'admin cannot rename');
  perform public.reset_task_library_type('RTU');
  perform public.remove_task_library_type('ADMIN_MADE');
  perform tests.ok('C1940 remove', tests.te_state(a, 'ADMIN_MADE') is null, 'admin cannot remove');
end $$;
reset role;

-- C1920-C1925: seeding.
do $$
declare
  x uuid := tests.id('orgX');
  y uuid := tests.id('orgY');
  z uuid := tests.id('orgZ');
  n integer;
begin
  n := private.seed_org_catalog(x, 'tl_plumb');
  perform tests.ok('C1920 return', n = 2, 'returned ' || n);
  perform tests.ok('C1920 types', (select count(*) from public.asset_types where org_id = x and pack = 'tl_plumb') = 2
                                 and tests.te_types(x) = 2, 'org X does not have exactly the 2 plumbing types');
  perform tests.ok('C1920 tasks', (select count(*) from public.asset_type_tasks where org_id = x) = 3, 'org X does not have 3 tasks');

  n := private.seed_org_catalog(y);
  perform tests.ok('C1921 return', n = 40, 'returned ' || n);
  perform tests.ok('C1921 tasks', (select count(*) from public.asset_type_tasks where org_id = y) = 174, 'org Y does not have 174 tasks');
  perform tests.ok('C1921 pack', (select count(*) from public.asset_types where org_id = y and pack = 'hvac') = 40, 'not all 40 are hvac');

  perform tests.ok('C1923 rerun', private.seed_org_catalog(y, 'hvac') = 0, 'a second seed inserted rows');
  perform tests.ok('C1923 counts', tests.te_types(y) = 40 and (select count(*) from public.asset_type_tasks where org_id = y) = 174, 'counts changed');

  perform tests.expect_error('C1922 unknown', format('select private.seed_org_catalog(%L, ''nope'')', z), '22023');
  perform tests.ok('C1922 none', tests.te_types(z) = 0, 'org Z gained a type');
end $$;

select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1925 authenticated one', format('select private.seed_org_catalog(%L)', tests.id('orgA')), '42501');
  perform tests.expect_error('C1925 authenticated two', format('select private.seed_org_catalog(%L, ''hvac'')', tests.id('orgA')), '42501');
end $$;
reset role;
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C1925 anon one', format('select private.seed_org_catalog(%L)', tests.id('orgA')), '42501');
  perform tests.expect_error('C1925 anon two', format('select private.seed_org_catalog(%L, ''hvac'')', tests.id('orgA')), '42501');
end $$;
reset role;

-- C1924: the migration's backfill over types that predate the pack column.
insert into public.asset_types (org_id, code, name, default_visit_months) values
  (tests.id('orgB'), 'ERV', 'ERV', '{3,6,9,12}'), (tests.id('orgB'), 'SUMP_PUMP', 'Hand made', '{3,6,9,12}');
update public.asset_types set pack = null where org_id = tests.id('orgB');
update public.asset_types t set pack = 'hvac'
where exists (select 1 from private.catalog_asset_types c where c.pack = 'hvac' and c.code = t.code);
do $$ begin
  perform tests.ok('C1924 hvac', (select count(*) from public.asset_types where org_id = tests.id('orgB') and code in ('ERV', 'RTU') and pack = 'hvac') = 2,
    'ERV and RTU are not hvac');
  perform tests.ok('C1924 hand-made', (select pack from public.asset_types where org_id = tests.id('orgB') and code = 'SUMP_PUMP') is null,
    'a hand-made type got a pack');
end $$;

-- C1935: the pack format.
do $$
declare p text;
begin
  foreach p in array array['Hvac', '1abc', 'a-b'] loop
    perform tests.expect_error('C1935 ' || p, format('update public.asset_types set pack = %L where id = %L', p, tests.id('typeB')), '23514');
  end loop;
  foreach p in array array['hvac', 'a_1'] loop
    perform tests.expect_rows('C1935 ' || p, format('update public.asset_types set pack = %L where id = %L', p, tests.id('typeB')), 1);
  end loop;
end $$;

-- C1936: template identity is (pack, code).
do $$ begin
  perform tests.expect_rows('C1936 same code other pack',
    'insert into private.catalog_asset_types (pack, code, name, default_visit_months) values (''tl_plumb'', ''PUMP'', ''Pump'', ''{4,10}'')', 1);
  perform tests.expect_error('C1936 duplicate',
    'insert into private.catalog_asset_types (pack, code, name, default_visit_months) values (''tl_plumb'', ''PUMP'', ''Pump'', ''{4,10}'')', '23505');
  perform tests.expect_error('C1936 orphan task',
    'insert into private.catalog_asset_type_tasks (pack, code, position, description) values (''tl_plumb'', ''NOPE'', 1, ''x'')', '23503');
end $$;

-- C1934: a code and an org never change; a name does.
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1934 code', format('update public.asset_types set code = ''ZZ'' where id = %L', tests.id('typeA')), '23514');
  perform tests.expect_rows('C1934 name', format('update public.asset_types set name = ''Rooftop'' where id = %L', tests.id('typeA')), 1);
end $$;
reset role;
do $$ begin
  perform tests.expect_error('C1934 org', format('update public.asset_types set org_id = %L where id = %L', tests.id('orgB'), tests.id('typeA')), '23514');
end $$;

-- C1908: the name index holds below the functions.
do $$ begin
  perform tests.expect_error('C1908 duplicate name',
    format('insert into public.asset_types (org_id, code, name) values (%L, ''ZZ_DUP'', ''SUMP pump'')', tests.id('orgA')), '23505');
  perform tests.expect_rows('C1908 other org',
    format('insert into public.asset_types (org_id, code, name) values (%L, ''ZZ_DUP'', ''SUMP pump'')', tests.id('orgB')), 1);
  perform tests.ok('C1908 definition',
    exists (select 1 from pg_indexes where indexname = 'asset_types_org_name_key' and indexdef like '%(org_id, lower(name))%'),
    'the index is not on (org_id, lower(name))');
end $$;

rollback;
select 'type_editor: pass' as result;
