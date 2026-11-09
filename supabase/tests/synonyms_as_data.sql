-- synonyms-as-data, database side: C2109-C2119, C2126, C2127 (.specs/features/synonyms-as-data/checks.md).
-- Run after fixture.sql in the same execute_sql call (npm run test:db synonyms_as_data).
-- Fixture: org A owner uA, estimator uE, viewer uV, admin uAd (added here); typeA is RTU "Rooftop unit" with no pack; org B owner uB.
-- Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

-- Two template packs for the seed claims: plumbing (SUMP has spellings, GREASE has none) and electrical.
insert into private.catalog_packs (pack, trade_context) values ('sd_plumb', 'plumbing'), ('sd_electric', 'electrical');
insert into private.catalog_asset_types (pack, code, name, default_visit_months, synonyms) values
  ('sd_plumb', 'SUMP', 'Sump pit', '{4,10}', array['pit pump', 'sump']),
  ('sd_plumb', 'GREASE', 'Grease trap', '{1,7}', '{}'),
  ('sd_electric', 'PANEL', 'Electrical panel', '{6}', array['breaker panel']);

insert into public.orgs (id, name) values
  (tests.id('orgS'), 'Org S'), (tests.id('orgS2'), 'Org S2'), (tests.id('orgW'), 'Org W'), (tests.id('orgX'), 'Org X'),
  (tests.id('orgV'), 'Org V'), (tests.id('orgU'), 'Org U'), (tests.id('orgT'), 'Org T');
insert into public.org_settings (org_id, legal_name) values
  (tests.id('orgS'), 'S'), (tests.id('orgV'), 'V'), (tests.id('orgU'), 'U'), (tests.id('orgT'), 'T');

-- A spelling list sorted, so two lists compare as sets.
create function tests.sd_set(p_values text[]) returns text[]
language sql immutable as $$ select coalesce(array_agg(v order by v), '{}') from unnest(p_values) v $$;

-- The spellings of an org's type by code, read past RLS (null when the type is absent).
create function tests.sd_syn(p_org uuid, p_code text) returns text[]
language sql security definer as $$
  select tests.sd_set(t.synonyms) from public.asset_types t where t.org_id = p_org and t.code = p_code
$$;

create function tests.sd_ctx(p_org uuid) returns text
language sql security definer as $$ select s.trade_context from public.org_settings s where s.org_id = p_org $$;

-- The spellings of a pack's template type, read past the privileges on the private table.
create function tests.sd_pack_syn(p_pack text, p_code text) returns text[]
language sql security definer as $$
  select tests.sd_set(c.synonyms) from private.catalog_asset_types c where c.pack = p_pack and c.code = p_code
$$;

-- A digest of an org's types and spellings, read past RLS.
create function tests.sd_digest(p_org uuid) returns text
language sql security definer as $$
  select coalesce(md5(string_agg(t.code || ':' || t.synonyms::text, ',' order by t.code)), '-') from public.asset_types t where t.org_id = p_org
$$;

grant execute on function tests.sd_set(text[]), tests.sd_syn(uuid, text), tests.sd_ctx(uuid), tests.sd_digest(uuid), tests.sd_pack_syn(text, text) to anon, authenticated;

-- C2109: the hvac pack holds today's SYNONYMS (the feature base's web/domain/imports/index.ts) and nothing else.
do $$
declare
  r record;
  c text;
  n_empty integer := 0;
  total integer;
begin
  for r in
    select e.code, e.spellings from (values
    ('AHU', array['air handling unit', 'air handler', 'air handler unit']),
    ('BOILER', array['hot water boiler', 'steam boiler', 'boilers']),
    ('CHILLER', array['water chiller', 'chillers']),
    ('COOLING_TOWER', array['cooling towers']),
    ('DUCTLESS_SPLIT', array['mini split', 'ductless mini split', 'ductless heat pump']),
    ('ERV', array['energy recovery ventilator', 'energy recovery unit']),
    ('EXHAUST_FAN', array['exhaust fans', 'ef', 'roof exhaust fan']),
    ('FAN_COIL', array['fan coil unit', 'fcu']),
    ('FURNACE', array['gas furnace', 'furnaces']),
    ('HEAT_EXCHANGER', array['plate heat exchanger', 'hx']),
    ('HRV', array['heat recovery ventilator']),
    ('ICE_MACHINE', array['ice maker']),
    ('MINI_VRF', array['mini vrf system']),
    ('MUA', array['mau', 'make up air', 'make up air unit', 'makeup air unit', 'make up air handler']),
    ('PTAC', array['packaged terminal ac', 'packaged terminal air conditioner']),
    ('PUMP', array['circulating pump', 'circulation pump', 'pumps']),
    ('RTU', array['rooftop unit', 'rooftop', 'roof top unit', 'roof top', 'rooftop air conditioner', 'packaged rooftop unit']),
    ('STORAGE_TANK', array['storage tanks', 'hot water storage tank']),
    ('SUPPLY_FAN', array['supply fans']),
    ('UNITARY_SPLIT', array['split system', 'unitary split']),
    ('UNIT_HEATER_ELECTRIC', array['electric unit heater']),
    ('UNIT_HEATER_GAS', array['gas unit heater', 'gas fired unit heater']),
    ('VRF_OUTDOOR', array['vrf outdoor unit', 'vrf condenser']),
    ('WSHP', array['water source heat pump', 'water to air heat pump']),
    ('WALK_IN_COOLER', array['walk in cooler', 'walk in refrigerator']),
    ('WALK_IN_FREEZER', array['walk in freezer']),
    ('WYE_STRAINER', array['y strainer', 'wye strainers'])
    ) as e(code, spellings)
  loop
    perform tests.ok('C2109 ' || r.code,
      (select tests.sd_set(k.synonyms) from private.catalog_asset_types k where k.pack = 'hvac' and k.code = r.code) = tests.sd_set(r.spellings),
      'the pack spellings of ' || r.code || ' differ from the base constant');
  end loop;

  perform tests.ok('C2109 types', (select count(*) from private.catalog_asset_types where pack = 'hvac') = 40, 'the hvac pack is not 40 types');
  perform tests.ok('C2109 with spellings', (select count(*) from private.catalog_asset_types where pack = 'hvac' and cardinality(synonyms) > 0) = 27,
    'not 27 hvac types hold spellings');
  select sum(cardinality(synonyms)) into total from private.catalog_asset_types where pack = 'hvac';
  perform tests.ok('C2109 total', total = 59, 'the hvac pack holds ' || total || ' spellings, not 59');

  foreach c in array array['ACID_NEUTRALIZER', 'AIR_SEPARATOR', 'BACKFLOW_PREVENTER', 'CASE_COOLER', 'CASE_FREEZER', 'CO_SENSOR',
    'EXPANSION_TANK', 'FIRE_DAMPER', 'HWT_MID_EFFICIENCY', 'HWT_HIGH_EFFICIENCY', 'INDIRECT_TANK', 'PRESSURE_REGULATING_VALVE',
    'SIDE_STREAM_FILTER'] loop
    perform tests.ok('C2109 empty ' || c,
      (select cardinality(k.synonyms) from private.catalog_asset_types k where k.pack = 'hvac' and k.code = c) = 0,
      c || ' holds spellings');
    n_empty := n_empty + 1;
  end loop;
  perform tests.ok('C2109 empty count', n_empty = 13, 'checked ' || n_empty || ' empty types');
end $$;

-- C2113 and C2118: the migration's backfill, run over fixture rows (before any pack is set on org A's types).
insert into public.asset_types (org_id, code, name, pack) values
  (tests.id('orgV'), 'RTU', 'Rooftop unit', 'hvac'),
  (tests.id('orgV'), 'MUA', 'Make-up air unit', 'hvac'),
  (tests.id('orgV'), 'SUMP_PUMP', 'Sump pump', null),
  (tests.id('orgU'), 'SUMP_PUMP', 'Sump pump', null);
select private.backfill_pack_synonyms();
do $$
declare
  v uuid := tests.id('orgV');
  rtu text[] := tests.sd_set(array['rooftop unit', 'rooftop', 'roof top unit', 'roof top', 'rooftop air conditioner', 'packaged rooftop unit']);
begin
  perform tests.ok('C2113 RTU', tests.sd_syn(v, 'RTU') = rtu, 'RTU holds ' || tests.sd_syn(v, 'RTU')::text);
  perform tests.ok('C2113 MUA', tests.sd_syn(v, 'MUA') = tests.sd_set(array['mau', 'make up air', 'make up air unit', 'makeup air unit', 'make up air handler']),
    'MUA holds ' || tests.sd_syn(v, 'MUA')::text);
  perform tests.ok('C2113 hand-made', tests.sd_syn(v, 'SUMP_PUMP') = '{}', 'a hand-made type gained spellings');

  perform private.backfill_pack_synonyms();
  perform tests.ok('C2113 again', tests.sd_syn(v, 'RTU') = rtu, 'a second backfill changed a value');

  perform tests.ok('C2118 hvac org', tests.sd_ctx(v) = 'HVAC and mechanical', 'org V context is ' || coalesce(tests.sd_ctx(v), 'null'));
  perform tests.ok('C2118 hand-made org', tests.sd_ctx(tests.id('orgU')) is null, 'org U gained a context');
  perform tests.ok('C2118 no types', tests.sd_ctx(tests.id('orgT')) is null, 'org T gained a context');
end $$;

-- C2114: the spelling rule on both tables. p_value is an SQL literal. A refused write must raise p_expect and change nothing;
-- an accepted one must read back.
create function tests.sd_try(p_label text, p_table text, p_where text, p_value text, p_expect text) returns void
language plpgsql as $$
declare
  v_before text;
  v_after text;
  v_same boolean;
begin
  execute format('select synonyms::text from %s where %s', p_table, p_where) into v_before;
  if p_expect = 'ok' then
    execute format('update %s set synonyms = %s where %s', p_table, p_value, p_where);
    execute format('select synonyms = %s from %s where %s', p_value, p_table, p_where) into v_same;
    if v_same is not true then
      raise exception '%: the accepted value did not read back', p_label;
    end if;
  else
    perform tests.expect_error(p_label, format('update %s set synonyms = %s where %s', p_table, p_value, p_where), p_expect);
    execute format('select synonyms::text from %s where %s', p_table, p_where) into v_after;
    if v_after is distinct from v_before then
      raise exception '%: a refused write changed the value from % to %', p_label, v_before, v_after;
    end if;
  end if;
end $$;
grant execute on function tests.sd_try(text, text, text, text, text) to anon, authenticated;

do $$
declare
  t record;
  bad text;
  good text;
begin
  for t in select * from (values
    ('catalog', 'private.catalog_asset_types', $w$pack = 'sd_electric' and code = 'PANEL'$w$),
    ('org', 'public.asset_types', format('id = %L', tests.id('typeA')))
  ) as x(name, tbl, cond)
  loop
    foreach bad in array array[
      $v$'{Rooftop}'$v$, $v$'{" rtu"}'$v$, $v$'{"rtu "}'$v$, $v$'{""}'$v$,
      format('array[%L]', repeat('a', 61)), $v$'{"--"}'$v$, $v$'{NULL}'$v$,
      -- a bad element after a good one: the rule reads every element, not the first
      $v$'{fine,Rooftop}'$v$, $v$'{fine,NULL}'$v$, $v$'{fine," rtu"}'$v$, $v$'{fine,"rtu "}'$v$, $v$'{fine,""}'$v$, $v$'{fine,"--"}'$v$,
      format('array[%L, %L]', 'fine', repeat('a', 61))] loop
      perform tests.sd_try('C2114 ' || t.name || ' ' || bad, t.tbl, t.cond, bad, '23514');
    end loop;
    -- NOT NULL is checked before the check constraint, so the whole-value NULL is a 23502 (see the Handoff).
    perform tests.sd_try('C2114 ' || t.name || ' whole null', t.tbl, t.cond, 'null', '23502');
    foreach good in array array[
      format('array[%L]', repeat('a', 60)), $v$'{a}'$v$, $v$'{2}'$v$, $v$'{"o''brien unit"}'$v$, $v$'{}'$v$] loop
      perform tests.sd_try('C2114 ' || t.name || ' ' || good, t.tbl, t.cond, good, 'ok');
    end loop;
  end loop;
end $$;

-- C2115: who reads and writes an org type's spellings.
do $$
declare u text;
begin
  foreach u in array array['uA', 'uAd'] loop
    perform tests.act_as(u);
    perform tests.expect_rows('C2115 ' || u || ' writes', format('update public.asset_types set synonyms = array[%L] where id = %L', 'by ' || lower(u), tests.id('typeA')), 1);
    perform tests.ok('C2115 ' || u || ' reads back', (select synonyms from public.asset_types where id = tests.id('typeA')) = array['by ' || lower(u)], 'value not read back');
    execute 'reset role';
  end loop;
  foreach u in array array['uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.expect_rows('C2115 ' || u || ' write refused', format('update public.asset_types set synonyms = %L where id = %L', '{nope}', tests.id('typeA')), 0);
    perform tests.ok('C2115 ' || u || ' reads', (select count(*) from public.asset_types where id = tests.id('typeA') and synonyms = array['by uad']) = 1, u || ' cannot read the spellings');
    execute 'reset role';
  end loop;
  perform tests.act_as('uB');
  perform tests.ok('C2115 other org reads', (select count(*) from public.asset_types where id = tests.id('typeA')) = 0, 'org B reads org A');
  perform tests.expect_rows('C2115 other org write', format('update public.asset_types set synonyms = %L where id = %L', '{nope}', tests.id('typeA')), 0);
  execute 'reset role';
end $$;
do $$
declare n bigint;
begin
  perform tests.act_as_anon();
  begin
    select count(*) into n from public.asset_types where id = tests.id('typeA');
  exception when insufficient_privilege then
    n := 0;
  end;
  perform tests.ok('C2115 anon reads', n = 0, 'anon reads the spellings');
  begin
    update public.asset_types set synonyms = '{nope}' where id = tests.id('typeA');
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    n := 0;
  end;
  perform tests.ok('C2115 anon writes', n = 0, 'anon updated the spellings');
  execute 'reset role';
  perform tests.ok('C2115 unchanged', tests.sd_syn(tests.id('orgA'), 'RTU') = array['by uad'], 'a refused write changed the value');
end $$;

-- C2110: the seed copies spellings and skips a type that already exists.
do $$
declare
  x uuid := tests.id('orgX');
  w uuid := tests.id('orgW');
  n integer;
begin
  n := private.seed_org_catalog(x, 'sd_plumb');
  perform tests.ok('C2110 return', n = 2, 'returned ' || n);
  perform tests.ok('C2110 SUMP', tests.sd_syn(x, 'SUMP') = tests.sd_set(array['pit pump', 'sump']), 'SUMP holds ' || coalesce(tests.sd_syn(x, 'SUMP')::text, 'null'));
  perform tests.ok('C2110 GREASE', tests.sd_syn(x, 'GREASE') = '{}', 'GREASE holds spellings');

  insert into public.asset_types (org_id, code, name, synonyms) values (w, 'SUMP', 'My sump', array['mine']);
  n := private.seed_org_catalog(w, 'sd_plumb');
  perform tests.ok('C2110 skipped return', n = 1, 'returned ' || n);
  perform tests.ok('C2110 kept', tests.sd_syn(w, 'SUMP') = array['mine'], 'a skipped type changed to ' || coalesce(tests.sd_syn(w, 'SUMP')::text, 'null'));
  perform tests.ok('C2110 inserted', tests.sd_syn(w, 'GREASE') = '{}', 'the other type was not inserted');
end $$;

-- C2111 and C2112: reset restores, remove leaves everything else alone. Org A gets the plumbing pack and RTU becomes an hvac type.
do $$
begin
  perform private.seed_org_catalog(tests.id('orgA'), 'sd_plumb');
  perform private.seed_org_catalog(tests.id('orgB'), 'sd_plumb');
  update public.asset_types set pack = 'hvac' where id = tests.id('typeA');
end $$;
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  six text[] := tests.sd_set(array['rooftop unit', 'rooftop', 'roof top unit', 'roof top', 'rooftop air conditioner', 'packaged rooftop unit']);
begin
  update public.asset_types set synonyms = '{custom}' where org_id = a and code = 'RTU';
  perform public.reset_task_library_type('RTU');
  perform tests.ok('C2111 restored', tests.sd_syn(a, 'RTU') = six, 'RTU holds ' || tests.sd_syn(a, 'RTU')::text);

  update public.asset_types set synonyms = '{custom}' where org_id = a and code = 'GREASE';
  perform public.reset_task_library_type('GREASE');
  perform tests.ok('C2111 empty pack list', tests.sd_syn(a, 'GREASE') = '{}', 'GREASE holds ' || tests.sd_syn(a, 'GREASE')::text);

  perform public.remove_task_library_type('SUMP');
  perform tests.ok('C2112 removed', tests.sd_syn(a, 'SUMP') is null, 'org A still has SUMP');
  perform tests.ok('C2112 other org', tests.sd_syn(tests.id('orgB'), 'SUMP') = tests.sd_set(array['pit pump', 'sump']), 'org B SUMP changed');
  perform tests.ok('C2112 pack', tests.sd_pack_syn('sd_plumb', 'SUMP') = tests.sd_set(array['pit pump', 'sump']),
    'the pack SUMP changed');
end $$;
reset role;

-- C2116: the registry.
do $$
begin
  perform tests.ok('C2116 hvac', (select trade_context from private.catalog_packs where pack = 'hvac') = 'HVAC and mechanical', 'the hvac phrase is wrong');
  perform tests.expect_error('C2116 unregistered', $q$insert into private.catalog_asset_types (pack, code, name, default_visit_months) values ('sd_nope', 'X', 'x', '{3}')$q$, '23503');
  perform tests.ok('C2116 every pack', not exists (
    select 1 from private.catalog_asset_types c where not exists (select 1 from private.catalog_packs p where p.pack = c.pack)), 'a template row names an unregistered pack');
end $$;

-- C2117: the seed appends the trade phrase once; an org with no settings row still seeds.
do $$
declare
  s uuid := tests.id('orgS');
  s2 uuid := tests.id('orgS2');
  n integer;
begin
  perform private.seed_org_catalog(s, 'hvac');
  perform tests.ok('C2117 first', tests.sd_ctx(s) = 'HVAC and mechanical', 'context is ' || coalesce(tests.sd_ctx(s), 'null'));
  perform private.seed_org_catalog(s, 'hvac');
  perform private.seed_org_catalog(s, 'hvac');
  perform tests.ok('C2117 three times', tests.sd_ctx(s) = 'HVAC and mechanical', 'context is ' || coalesce(tests.sd_ctx(s), 'null'));
  perform private.seed_org_catalog(s, 'sd_plumb');
  perform tests.ok('C2117 second pack', tests.sd_ctx(s) = 'HVAC and mechanical, plumbing', 'context is ' || coalesce(tests.sd_ctx(s), 'null'));
  perform private.seed_org_catalog(s, 'sd_plumb');
  perform tests.ok('C2117 second again', tests.sd_ctx(s) = 'HVAC and mechanical, plumbing', 'context is ' || coalesce(tests.sd_ctx(s), 'null'));

  n := private.seed_org_catalog(s2, 'sd_plumb');
  perform tests.ok('C2117 no settings row types', n = 2 and tests.sd_syn(s2, 'SUMP') is not null, 'the types did not seed, returned ' || n);
  perform tests.ok('C2117 no settings row', not exists (select 1 from public.org_settings where org_id = s2), 'a settings row appeared');
end $$;

-- C2119: the trade-context rule on org_settings, and the default.
create function tests.sd_try_ctx(p_label text, p_value text, p_expect text) returns void
language plpgsql as $$
declare
  v_before text := tests.sd_ctx(tests.id('orgA'));
begin
  if p_expect = 'ok' then
    update public.org_settings set trade_context = p_value where org_id = tests.id('orgA');
    if tests.sd_ctx(tests.id('orgA')) is distinct from p_value then
      raise exception '%: the value did not read back', p_label;
    end if;
  else
    perform tests.expect_error(p_label, format('update public.org_settings set trade_context = %L where org_id = %L', p_value, tests.id('orgA')), p_expect);
    if tests.sd_ctx(tests.id('orgA')) is distinct from v_before then
      raise exception '%: a refused write changed the value', p_label;
    end if;
  end if;
end $$;
grant execute on function tests.sd_try_ctx(text, text, text) to anon, authenticated;

do $$
begin
  insert into public.orgs (id, name) values (tests.id('orgD'), 'Org D');
  insert into public.org_settings (org_id, legal_name) values (tests.id('orgD'), 'D');
  perform tests.ok('C2119 default', tests.sd_ctx(tests.id('orgD')) is null, 'a new settings row did not read null');
  perform tests.sd_try_ctx('C2119 ok 200', repeat('a', 200), 'ok');
  perform tests.sd_try_ctx('C2119 ok symbols', 'HVAC & R/boiler-service, O''Brien', 'ok');
  perform tests.sd_try_ctx('C2119 empty', '', '23514');
  perform tests.sd_try_ctx('C2119 spaces', '   ', '23514');
  perform tests.sd_try_ctx('C2119 201', repeat('a', 201), '23514');
  perform tests.sd_try_ctx('C2119 semicolon', 'HVAC; boiler', '23514');
  perform tests.sd_try_ctx('C2119 angle', '<b>plumbing</b>', '23514');
  perform tests.sd_try_ctx('C2119 newline', E'HVAC\nboiler', '23514');
  update public.org_settings set trade_context = null where org_id = tests.id('orgA');
  perform tests.ok('C2119 null', tests.sd_ctx(tests.id('orgA')) is null, 'NULL was not accepted');
end $$;

-- C2126: the two replaced functions keep their shape and their grants.
do $$
begin
  perform tests.ok('C2126 seed shape', exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'seed_org_catalog' and p.prorettype = 'integer'::regtype and not p.prosecdef
      and p.proconfig @> array['search_path=""'] and pg_get_function_identity_arguments(p.oid) = 'p_org uuid, p_pack text'),
    'seed_org_catalog is not (uuid, text) integer, security invoker, search_path empty');
  perform tests.ok('C2126 seed grants', (select not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname = 'seed_org_catalog'), 'a client can execute seed_org_catalog');
  perform tests.ok('C2126 one argument', private.seed_org_catalog(tests.id('orgT')) = 40, 'the one-argument call did not seed 40 types');
  perform tests.ok('C2126 reset shape', exists (
    select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'reset_task_library_type'
      and p.prosecdef and p.proconfig @> array['search_path=""']),
    'reset_task_library_type is not security definer with an empty search_path');
  perform tests.ok('C2126 reset grants', (select has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'reset_task_library_type'), 'reset_task_library_type grants changed');
end $$;

-- C2127: the two reads the app's catalog adapter makes (asset_types with synonyms, and org_settings.trade_context), as a member.
do $$
declare
  a uuid := tests.id('orgA');
  digest_a text := tests.sd_digest(tests.id('orgA'));
  n bigint := (select count(*) from public.asset_types where org_id = tests.id('orgA'));
  ctx text;
begin
  update public.org_settings set trade_context = 'HVAC and mechanical' where org_id = a;

  perform tests.act_as('uA');
  perform tests.ok('C2127 owner reads every type', (select count(*) from public.asset_types) = n, 'the owner reads a different number of types than the org holds');
  perform tests.ok('C2127 owner reads the spellings',
    (select md5(string_agg(t.code || ':' || t.synonyms::text, ',' order by t.code)) from public.asset_types t) = digest_a, 'the spellings read differ from the stored ones');
  select s.trade_context into ctx from public.org_settings s limit 1;
  perform tests.ok('C2127 owner context', ctx = 'HVAC and mechanical', 'the owner reads ' || coalesce(ctx, 'null'));
  execute 'reset role';

  perform tests.act_as('uB');
  perform tests.ok('C2127 other org types', (select count(*) from public.asset_types where org_id = a) = 0, 'org B reads org A types');
  select s.trade_context into ctx from public.org_settings s limit 1;
  perform tests.ok('C2127 other org context', ctx is not distinct from tests.sd_ctx(tests.id('orgB')) and ctx is distinct from 'HVAC and mechanical',
    'org B reads ' || coalesce(ctx, 'null') || ', not its own context');
  execute 'reset role';
end $$;

rollback;
select 'synonyms_as_data: pass' as result;
