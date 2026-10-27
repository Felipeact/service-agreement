-- service-included: C801, C802, C808, C810-C814, C817, C819, C823, C832. Run after fixture.sql in the same
-- execute_sql call (npm run test:db service_included). Fixture: org A owner uA, estimator uE, viewer uV; siteA with
-- RTU-1 of typeA (RTU, "Rooftop unit", task "Replace filters" at position 1); siteB in org B.
-- Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

create function tests.si_site(p_name text) returns uuid
language sql as $$
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name), tests.id('orgA'), tests.id('custA'), p_name)
  returning id
$$;

create function tests.si_asset(p_site text, p_type text, p_unit text, p_model text default null, p_location text default null)
returns uuid
language sql as $$
  insert into public.assets (id, org_id, site_id, asset_type_id, unit_no, type_model, location)
  values (tests.id(p_site || ':' || coalesce(p_unit, 'none')), tests.id('orgA'), tests.id(p_site), tests.id(p_type), p_unit, p_model, p_location)
  returning id
$$;

-- An agreement <name> in <status> on its own site <name>:site (RTU-1 and B-1), with version 1 (<name>:v1).
create function tests.si_agr(p_name text, p_status text, p_snapshot jsonb default '{}') returns uuid
language plpgsql as $$
begin
  perform tests.si_site(p_name || ':site');
  perform tests.si_asset(p_name || ':site', 'typeA', 'RTU-1');
  perform tests.si_asset(p_name || ':site', 'boilerA', 'B-1');
  insert into public.agreements (id, org_id, site_id, status)
  values (tests.id(p_name), tests.id('orgA'), tests.id(p_name || ':site'), p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no, snapshot)
  values (tests.id(p_name || ':v1'), tests.id('orgA'), tests.id(p_name), 1, p_snapshot);
  return tests.id(p_name);
end $$;

create function tests.si_snapshot(p_version text) returns jsonb
language sql security definer as $$ select snapshot from public.agreement_versions where id = tests.id(p_version) $$;

create function tests.si_transition(p_agr text, p_from text, p_to text, p_event text) returns text
language sql as $$
  select format('select public.apply_agreement_transition(%L, %L, %L, %L, ''{}'')', tests.id(p_agr), p_from, p_to, p_event)
$$;

insert into public.asset_types (id, org_id, code, name) values
  (tests.id('boilerA'), tests.id('orgA'), 'BOILER', 'Boiler'),
  (tests.id('ch802A'), tests.id('orgA'), 'CH802', 'Chiller elsewhere'),
  (tests.id('unusedA'), tests.id('orgA'), 'UNUSED', 'Unused type'),
  (tests.id('chillerA'), tests.id('orgA'), 'CHILLER', 'Chiller');
insert into public.asset_type_tasks (id, org_id, asset_type_id, position, description) values
  (tests.id('rtuTask2'), tests.id('orgA'), tests.id('typeA'), 2, 'Check belts'),
  (tests.id('unusedTask'), tests.id('orgA'), tests.id('unusedA'), 1, 'Never listed'),
  (tests.id('chillerTask'), tests.id('orgA'), tests.id('chillerA'), 1, 'Check oil');

select tests.si_site('s801');
select tests.si_asset('s801', 'typeA', 'RTU-2', 'Carrier 48TC', 'Roof');
select tests.si_asset('s801', 'typeA', 'RTU-10');
select tests.si_asset('s801', 'boilerA', 'B-1', 'Condensing boiler', 'Mechanical room');
select tests.si_site('s802');
select tests.si_asset('s802', 'ch802A', 'CH-1');
select tests.si_site('s808');
select tests.si_asset('s808', 'typeA', 'RTU-1');

select tests.si_agr('a810', 'draft');
insert into public.agreement_versions (id, org_id, agreement_id, version_no)
values (tests.id('a810:v2'), tests.id('orgA'), tests.id('a810'), 2);
select tests.si_agr('a811', 'draft');
select tests.si_agr('a812accepted', 'sent', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a812refused', 'sent', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a812changes', 'sent', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a812expired', 'sent', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a812withdrawn', 'sent', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a812revised', 'changes_requested', '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}');
select tests.si_agr('a813stale', 'sent');
select tests.si_agr('a813viewer', 'draft');
select tests.si_agr('a819', 'draft');

-- C801: the document of a site with two RTUs and a boiler.
select tests.act_as('uE');
do $$
declare
  doc jsonb := public.site_service_scope(tests.id('s801'));
  rtu jsonb;
  boiler jsonb;
  bare jsonb;
begin
  perform tests.ok('C801 top keys', (select array_agg(k order by k) from jsonb_object_keys(doc) k) = array['schema', 'types'],
    'top-level keys are not exactly schema and types: ' || doc::text);
  perform tests.ok('C801 schema', doc -> 'schema' = '1'::jsonb, 'schema is not 1');
  perform tests.ok('C801 no takenAt', not doc ? 'takenAt', 'a live scope carries takenAt');
  perform tests.ok('C801 two types', jsonb_array_length(doc -> 'types') = 2, 'not exactly 2 types: ' || doc::text);
  perform tests.ok('C801 type keys',
    (select bool_and((select array_agg(k order by k) from jsonb_object_keys(t) k) = array['assets', 'code', 'name', 'tasks'])
     from jsonb_array_elements(doc -> 'types') t),
    'a type does not have exactly code, name, tasks and assets');
  select t into rtu from jsonb_array_elements(doc -> 'types') t where t ->> 'code' = 'RTU';
  select t into boiler from jsonb_array_elements(doc -> 'types') t where t ->> 'code' = 'BOILER';
  perform tests.ok('C801 RTU name', rtu ->> 'name' = 'Rooftop unit', 'RTU name is wrong');
  perform tests.ok('C801 RTU tasks', rtu -> 'tasks' = '["Replace filters", "Check belts"]'::jsonb,
    'RTU tasks are not in position order: ' || (rtu -> 'tasks')::text);
  perform tests.ok('C801 BOILER tasks', boiler -> 'tasks' = '[]'::jsonb, 'a type without tasks does not give []');
  perform tests.ok('C801 asset counts', jsonb_array_length(rtu -> 'assets') = 2 and jsonb_array_length(boiler -> 'assets') = 1,
    'asset counts are not 2 and 1');
  perform tests.ok('C801 asset keys',
    (select bool_and((select array_agg(k order by k) from jsonb_object_keys(a) k) = array['location', 'typeModel', 'unitNo'])
     from jsonb_array_elements(doc -> 'types') t, jsonb_array_elements(t -> 'assets') a),
    'an asset does not have exactly unitNo, typeModel and location');
  select a into bare from jsonb_array_elements(rtu -> 'assets') a where a ->> 'unitNo' = 'RTU-10';
  perform tests.ok('C801 nulls kept', bare -> 'typeModel' = 'null'::jsonb and bare -> 'location' = 'null'::jsonb,
    'a null field is not JSON null: ' || bare::text);
  perform tests.ok('C801 values',
    exists (select 1 from jsonb_array_elements(rtu -> 'assets') a
            where a = '{"unitNo": "RTU-2", "typeModel": "Carrier 48TC", "location": "Roof"}'::jsonb),
    'RTU-2 is not carried with its type/model and location');
end $$;

-- C802: nothing from another site, a type with no asset on the site, or another org.
do $$ begin
  perform tests.ok('C802 codes',
    (select array_agg(t ->> 'code' order by t ->> 'code') from jsonb_array_elements(public.site_service_scope(tests.id('s801')) -> 'types') t)
      = array['BOILER', 'RTU'],
    'the scope holds a type from another site or a type with no asset on the site');
  perform tests.ok('C802 other org', public.site_service_scope(tests.id('siteB')) = '{"schema": 1, "types": []}'::jsonb,
    'org B''s site does not give an empty scope');
end $$;

-- C808: a live scope follows the site and the checklists on every call.
do $$
declare doc jsonb;
begin
  insert into public.assets (id, org_id, site_id, asset_type_id, unit_no)
  values (tests.id('s808:CH-1'), tests.id('orgA'), tests.id('s808'), tests.id('chillerA'), 'CH-1');
  doc := public.site_service_scope(tests.id('s808'));
  perform tests.ok('C808 asset added',
    exists (select 1 from jsonb_array_elements(doc -> 'types') t where t ->> 'code' = 'CHILLER' and t -> 'tasks' = '["Check oil"]'::jsonb),
    'the new type is not in the next scope: ' || doc::text);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
update public.asset_type_tasks set description = 'Check and tension belts' where id = tests.id('rtuTask2');
select tests.act_as('uE');
do $$
declare doc jsonb := public.site_service_scope(tests.id('s808'));
begin
  perform tests.ok('C808 task updated',
    exists (select 1 from jsonb_array_elements(doc -> 'types') t
            where t ->> 'code' = 'RTU' and t -> 'tasks' = '["Replace filters", "Check and tension belts"]'::jsonb),
    'the task change is not in the next scope: ' || doc::text);
  delete from public.assets where id = tests.id('s808:CH-1');
  doc := public.site_service_scope(tests.id('s808'));
  perform tests.ok('C808 asset deleted',
    not exists (select 1 from jsonb_array_elements(doc -> 'types') t where t ->> 'code' = 'CHILLER'),
    'the deleted asset''s type is still in the scope');
end $$;

-- C810, C832: sending a draft freezes its site's scope into its highest version.
do $$
declare
  v2 jsonb;
begin
  execute tests.si_transition('a810', 'draft', 'sent', 'agreement.sent');
  v2 := tests.si_snapshot('a810:v2');
  perform tests.ok('C810 scope', v2 - 'takenAt' = public.site_service_scope(tests.id('a810:site')),
    'the snapshot is not the site''s scope: ' || coalesce(v2::text, 'null'));
  perform tests.ok('C810 takenAt', (v2 ->> 'takenAt')::timestamptz = now(), 'takenAt is not the transaction time');
  perform tests.ok('C810 version 1 kept', tests.si_snapshot('a810:v1') = '{}'::jsonb, 'version 1 was written');
  perform tests.ok('C810 event',
    exists (select 1 from public.events where entity_id = tests.id('a810') and type = 'agreement.sent'), 'no agreement.sent event');
  perform tests.ok('C832 same document', (v2 - 'takenAt')::text = public.site_service_scope(tests.id('a810:site'))::text,
    'the frozen document differs from the live one');
end $$;

-- C811: withdrawing a draft freezes it too.
do $$
declare v1 jsonb;
begin
  execute tests.si_transition('a811', 'draft', 'withdrawn', 'agreement.withdrawn');
  v1 := tests.si_snapshot('a811:v1');
  perform tests.ok('C811 scope', v1 - 'takenAt' = public.site_service_scope(tests.id('a811:site')),
    'the withdrawn draft''s snapshot is not the site''s scope');
  perform tests.ok('C811 takenAt', (v1 ->> 'takenAt')::timestamptz = now(), 'takenAt is not the transaction time');
end $$;

-- C812: no transition from another status writes a new scope.
do $$
declare
  frozen constant jsonb := '{"schema": 1, "types": [], "takenAt": "2026-01-01T00:00:00+00:00"}';
  r record;
begin
  for r in select * from (values ('accepted', 'agreement.accepted'), ('refused', 'agreement.refused'),
                                 ('changes', 'agreement.changes_requested'), ('expired', 'agreement.expired'),
                                 ('withdrawn', 'agreement.withdrawn')) as x(name, event) loop
    execute tests.si_transition('a812' || r.name, 'sent',
      case r.name when 'changes' then 'changes_requested' else r.name end, r.event);
    perform tests.ok('C812 ' || r.name, tests.si_snapshot('a812' || r.name || ':v1') = frozen,
      'the snapshot changed on sent -> ' || r.name);
  end loop;
  execute tests.si_transition('a812revised', 'changes_requested', 'draft', 'agreement.revised');
  perform tests.ok('C812 revised v1', tests.si_snapshot('a812revised:v1') = frozen, 'revise changed version 1''s snapshot');
  perform tests.ok('C812 revised v2',
    (select snapshot from public.agreement_versions where agreement_id = tests.id('a812revised') and version_no = 2) = frozen,
    'version 2 is not a copy of version 1''s snapshot');
end $$;

-- C813: a refused transition writes no snapshot.
do $$
declare frozen_before bigint := (select count(*) from public.agreement_versions where snapshot ? 'takenAt');
begin
  perform tests.expect_error('C813 stale', tests.si_transition('a813stale', 'draft', 'sent', 'agreement.sent'), '40001');
  perform tests.ok('C813 stale kept', tests.si_snapshot('a813stale:v1') = '{}'::jsonb, 'a stale send wrote a snapshot');
  perform tests.expect_error('C813 missing',
    format('select public.apply_agreement_transition(%L, ''draft'', ''sent'', ''agreement.sent'', ''{}'')', tests.id('nothing')), 'P0002');
  perform tests.ok('C813 missing kept', (select count(*) from public.agreement_versions where snapshot ? 'takenAt') = frozen_before,
    'a call on a missing agreement wrote a snapshot');
end $$;
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C813 viewer', tests.si_transition('a813viewer', 'draft', 'sent', 'agreement.sent'), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C813 viewer kept', tests.si_snapshot('a813viewer:v1') = '{}'::jsonb
    and (select status from public.agreements where id = tests.id('a813viewer')) = 'draft', 'a viewer''s send changed something');
end $$;

-- C814: a frozen scope survives later changes to the site and the checklists.
do $$
declare before jsonb := tests.si_snapshot('a810:v2');
begin
  perform tests.si_asset('a810:site', 'chillerA', 'CH-9');
  update public.asset_type_tasks set description = 'Check belts, again' where id = tests.id('rtuTask2');
  delete from public.assets where id = tests.id('a810:site:B-1');
  perform tests.ok('C814 kept', tests.si_snapshot('a810:v2')::text = before::text, 'the frozen snapshot changed with the site');
end $$;

-- C817: no member updates a version.
do $$
declare u text;
begin
  foreach u in array array['uE', 'uA', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_error('C817 ' || u,
      format('update public.agreement_versions set snapshot = ''{}'' where id = %L', tests.id('verA')), '42501');
    execute 'reset role';
  end loop;
  perform tests.ok('C817 no update grant', not has_table_privilege('authenticated', 'public.agreement_versions', 'update'),
    'authenticated can update agreement_versions');
  perform tests.ok('C817 insert kept', has_table_privilege('authenticated', 'public.agreement_versions', 'insert'),
    'authenticated lost insert on agreement_versions');
end $$;
select set_config('request.jwt.claims', '', true);

-- C819: the freeze function is a definer with an empty search_path, refuses anon and a viewer.
do $$
declare f oid := 'private.freeze_agreement_version(uuid)'::regprocedure;
begin
  perform tests.ok('C819 definer', (select prosecdef from pg_proc where oid = f), 'the freeze function is not security definer');
  perform tests.ok('C819 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C819 anon', format('select private.freeze_agreement_version(%L)', tests.id('a819')), '42501');
end $$;
reset role;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C819 viewer', format('select private.freeze_agreement_version(%L)', tests.id('a819')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C819 nothing written', tests.si_snapshot('a819:v1') = '{}'::jsonb, 'the viewer''s call wrote a snapshot');
end $$;

-- C823: grants and shape of the scope function; the transition RPC keeps its grants.
do $$
declare f oid := 'public.site_service_scope(uuid)'::regprocedure;
begin
  perform tests.ok('C823 invoker', not (select prosecdef from pg_proc where oid = f), 'the scope function is security definer');
  perform tests.ok('C823 stable', (select provolatile = 's' from pg_proc where oid = f), 'the scope function is not stable');
  perform tests.ok('C823 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
  perform tests.ok('C823 authenticated', has_function_privilege('authenticated', 'public.site_service_scope(uuid)', 'execute'),
    'authenticated cannot execute the scope function');
  perform tests.ok('C823 transition authenticated',
    has_function_privilege('authenticated', 'public.apply_agreement_transition(uuid, text, text, text, jsonb)', 'execute'),
    'authenticated cannot execute the transition RPC');
end $$;
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C823 anon scope', format('select public.site_service_scope(%L)', tests.id('s801')), '42501');
  perform tests.expect_error('C823 anon transition', tests.si_transition('a819', 'draft', 'sent', 'agreement.sent'), '42501');
end $$;
reset role;

rollback;
select 'service_included: pass' as result;
