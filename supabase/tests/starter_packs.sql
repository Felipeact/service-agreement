-- starter-packs, database side, with the two packs released by 20261109171002_release_starter_packs.sql: C2201-C2221, C2223-C2224
-- (.specs/features/starter-packs/checks.md) and C2301-C2302 (.specs/features/pack-release/checks.md).
-- Run after fixture.sql in the same execute_sql call (npm run test:db starter_packs).
-- Fixture: org A owner uA, org B owner uB. Setup runs as the table owner with no signed-in user.
-- The shipped migrations release the two packs; nothing here releases anything. The gate is proven on two registered test
-- packs that stay unreleased.

reset role;
select set_config('request.jwt.claims', '', true);

-- The expected lists, copied from .specs/features/starter-packs/types-draft.md and never read back from the migration.
create table tests.sp_expected (pack text, code text, name text, months smallint[]);
insert into tests.sp_expected (pack, code, name, months) values
  ('plumbing', 'BACKFLOW_PREVENTER', 'Backflow preventer', '{10}'),
  ('plumbing', 'PRESSURE_REGULATING_VALVE', 'Pressure regulating valve', '{10}'),
  ('plumbing', 'EXPANSION_TANK', 'Expansion tank', '{10}'),
  ('plumbing', 'WATER_HEATER_COMMERCIAL', 'Water heater (commercial)', '{4,10}'),
  ('plumbing', 'TANKLESS_WATER_HEATER', 'Tankless water heater', '{10}'),
  ('plumbing', 'MIXING_VALVE', 'Thermostatic mixing valve', '{10}'),
  ('plumbing', 'RECIRCULATION_PUMP', 'Recirculation pump', '{4,10}'),
  ('plumbing', 'BOOSTER_PUMP', 'Domestic booster pump', '{4,10}'),
  ('plumbing', 'SUMP_PUMP', 'Sump pump', '{4,10}'),
  ('plumbing', 'SEWAGE_EJECTOR_PUMP', 'Sewage ejector pump', '{4,10}'),
  ('plumbing', 'GREASE_INTERCEPTOR', 'Grease interceptor', '{3,6,9,12}'),
  ('plumbing', 'OIL_INTERCEPTOR', 'Sand and oil interceptor', '{4,10}'),
  ('plumbing', 'FLOOR_DRAIN', 'Floor drain and trap primer', '{4,10}'),
  ('plumbing', 'BACKWATER_VALVE', 'Backwater valve', '{4,10}'),
  ('plumbing', 'ROOF_DRAIN', 'Roof drain', '{4,10}'),
  ('plumbing', 'WATER_SOFTENER', 'Water softener', '{4,10}'),
  ('plumbing', 'WATER_FILTRATION', 'Water filtration system', '{4,10}'),
  ('plumbing', 'DRINKING_FOUNTAIN', 'Drinking fountain', '{4,10}'),
  ('plumbing', 'EYEWASH_STATION', 'Emergency eyewash and shower', '{10}'),
  ('plumbing', 'FLUSH_VALVE', 'Flush valve and fixture', '{4,10}'),
  ('electrical', 'SWITCHGEAR', 'Switchgear', '{10}'),
  ('electrical', 'SWITCHBOARD', 'Switchboard', '{10}'),
  ('electrical', 'DISTRIBUTION_PANEL', 'Distribution panel', '{10}'),
  ('electrical', 'BRANCH_PANEL', 'Branch circuit panel', '{10}'),
  ('electrical', 'MOTOR_CONTROL_CENTER', 'Motor control center', '{10}'),
  ('electrical', 'DRY_TRANSFORMER', 'Dry-type transformer', '{10}'),
  ('electrical', 'DISCONNECT_SWITCH', 'Disconnect switch', '{10}'),
  ('electrical', 'VFD', 'Variable frequency drive', '{10}'),
  ('electrical', 'GENERATOR', 'Standby generator', '{4,10}'),
  ('electrical', 'TRANSFER_SWITCH', 'Automatic transfer switch', '{10}'),
  ('electrical', 'UPS', 'UPS (uninterruptible power supply)', '{4,10}'),
  ('electrical', 'BATTERY_SYSTEM', 'Battery system', '{4,10}'),
  ('electrical', 'EMERGENCY_LIGHTING', 'Emergency lighting unit', '{10}'),
  ('electrical', 'EXIT_SIGN', 'Exit sign', '{10}'),
  ('electrical', 'LIGHTING_CONTROL_PANEL', 'Lighting control panel', '{10}'),
  ('electrical', 'SITE_LIGHTING', 'Site and parking lot lighting', '{4,10}'),
  ('electrical', 'GFCI_DEVICE', 'Ground-fault protection device', '{10}'),
  ('electrical', 'SURGE_PROTECTOR', 'Surge protective device', '{10}'),
  ('electrical', 'EV_CHARGER', 'EV charger', '{4,10}'),
  ('electrical', 'GROUNDING_SYSTEM', 'Grounding and lightning protection', '{10}');

create function tests.sp_norm(p text) returns text
language sql immutable as $$ select btrim(regexp_replace(lower(p), '[^[:alnum:]]+', ' ', 'g')) $$;

create function tests.sp_new_org(p_name text, p_ctx text default null) returns uuid
language plpgsql as $$
declare v uuid := tests.id(p_name);
begin
  insert into public.orgs (id, name) values (v, p_name);
  insert into public.org_settings (org_id, legal_name, trade_context) values (v, p_name, p_ctx);
  return v;
end $$;

-- Reads past RLS so a check can also run while signed in.
create function tests.sp_ctx(p_org uuid) returns text
language sql security definer as $$ select trade_context from public.org_settings where org_id = p_org $$;

create function tests.sp_count(p_org uuid, p_pack text default null) returns bigint
language sql security definer as $$
  select count(*) from public.asset_types where org_id = p_org and (p_pack is null or pack = p_pack)
$$;

create function tests.sp_task_count(p_org uuid) returns bigint
language sql security definer as $$
  select count(*) from public.asset_type_tasks where org_id = p_org
$$;

-- True when the org's types stamped p_pack (optionally only p_codes) and their tasks equal the template's, in both
-- directions. False when the template side is empty, so an empty comparison cannot pass.
create function tests.sp_same_catalog(p_org uuid, p_pack text, p_codes text[] default null) returns boolean
language plpgsql security definer as $$
declare
  n1 bigint; n2 bigint; n3 bigint; n4 bigint; n_t bigint;
begin
  select count(*) into n_t from private.catalog_asset_types where pack = p_pack and (p_codes is null or code = any (p_codes));
  select count(*) into n1 from (
    select x.code, x.name, x.default_visit_months, x.synonyms from public.asset_types x
    where x.org_id = p_org and x.pack = p_pack and (p_codes is null or x.code = any (p_codes))
    except
    select c.code, c.name, c.default_visit_months, c.synonyms from private.catalog_asset_types c
    where c.pack = p_pack and (p_codes is null or c.code = any (p_codes))) q;
  select count(*) into n2 from (
    select c.code, c.name, c.default_visit_months, c.synonyms from private.catalog_asset_types c
    where c.pack = p_pack and (p_codes is null or c.code = any (p_codes))
    except
    select x.code, x.name, x.default_visit_months, x.synonyms from public.asset_types x
    where x.org_id = p_org and x.pack = p_pack and (p_codes is null or x.code = any (p_codes))) q;
  select count(*) into n3 from (
    select x.code, k.position, k.description from public.asset_type_tasks k join public.asset_types x on x.id = k.asset_type_id
    where x.org_id = p_org and x.pack = p_pack and (p_codes is null or x.code = any (p_codes))
    except
    select k.code, k.position, k.description from private.catalog_asset_type_tasks k
    where k.pack = p_pack and (p_codes is null or k.code = any (p_codes))) q;
  select count(*) into n4 from (
    select k.code, k.position, k.description from private.catalog_asset_type_tasks k
    where k.pack = p_pack and (p_codes is null or k.code = any (p_codes))
    except
    select x.code, k.position, k.description from public.asset_type_tasks k join public.asset_types x on x.id = k.asset_type_id
    where x.org_id = p_org and x.pack = p_pack and (p_codes is null or x.code = any (p_codes))) q;
  return n_t > 0 and n1 = 0 and n2 = 0 and n3 = 0 and n4 = 0;
end $$;

-- One value for an org's types, tasks and trade context, so "nothing changed" is one comparison.
create function tests.sp_digest(p_org uuid) returns text
language sql security definer as $$
  select md5(
    coalesce((select string_agg(t.code || '|' || t.name || '|' || t.default_visit_months::text || '|' || t.synonyms::text || '|' || coalesce(t.pack, ''), ',' order by t.code)
              from public.asset_types t where t.org_id = p_org), '')
    || '#' ||
    coalesce((select string_agg(t.code || ':' || k.position || ':' || k.description, ',' order by t.code, k.position)
              from public.asset_types t join public.asset_type_tasks k on k.asset_type_id = t.id where t.org_id = p_org), '')
    || '#' ||
    coalesce((select s.trade_context from public.org_settings s where s.org_id = p_org), '-'))
$$;

grant execute on function tests.sp_ctx(uuid), tests.sp_count(uuid, text), tests.sp_task_count(uuid),
  tests.sp_same_catalog(uuid, text, text[]), tests.sp_digest(uuid) to anon, authenticated;

-- C2201 and C2202: the two lists, member by member, and nothing else in the pack.
do $$
declare
  r record;
begin
  perform tests.ok('C2201 list size', (select count(*) from tests.sp_expected where pack = 'plumbing') = 20, 'the expected plumbing list is not 20');
  perform tests.ok('C2202 list size', (select count(*) from tests.sp_expected where pack = 'electrical') = 20, 'the expected electrical list is not 20');
  for r in select * from tests.sp_expected loop
    perform tests.ok(case r.pack when 'plumbing' then 'C2201 ' else 'C2202 ' end || r.code,
      exists (select 1 from private.catalog_asset_types c
              where c.pack = r.pack and c.code = r.code and c.name = r.name and c.default_visit_months = r.months),
      r.pack || ' ' || r.code || ' is missing or differs from the list');
  end loop;
  perform tests.ok('C2201 count', (select count(*) from private.catalog_asset_types where pack = 'plumbing') = 20, 'the plumbing pack does not hold 20 types');
  perform tests.ok('C2202 count', (select count(*) from private.catalog_asset_types where pack = 'electrical') = 20, 'the electrical pack does not hold 20 types');
end $$;

-- C2203: the two registered packs and their phrases.
do $$
begin
  perform tests.ok('C2203 plumbing', (select trade_context from private.catalog_packs where pack = 'plumbing') = 'plumbing', 'the plumbing row is missing or its phrase is not plumbing');
  perform tests.ok('C2203 electrical', (select trade_context from private.catalog_packs where pack = 'electrical') = 'electrical', 'the electrical row is missing or its phrase is not electrical');
  perform tests.ok('C2203 rule', not exists (
    select 1 from private.catalog_packs where pack in ('plumbing', 'electrical')
      and (trade_context !~ '^[A-Za-z0-9 ,&/''-]{1,200}$' or trade_context !~ '[A-Za-z0-9]')), 'a phrase breaks the phrase rule');
end $$;

-- C2204: tasks per type, positions, description length.
do $$
declare
  r record;
  v_types integer := 0;
begin
  for r in select pack, code from private.catalog_asset_types where pack in ('plumbing', 'electrical') loop
    v_types := v_types + 1;
    perform tests.ok('C2204 ' || r.code, (
      select count(*) between 1 and 8 and min(position) = 1 and max(position) = count(*) and count(distinct position) = count(*)
             and bool_and(char_length(btrim(description)) between 1 and 120)
      from private.catalog_asset_type_tasks where pack = r.pack and code = r.code),
      r.pack || ' ' || r.code || ' breaks the task rules');
  end loop;
  perform tests.ok('C2204 types', v_types = 40, v_types || ' types were checked, not 40');
end $$;

-- C2205: the codes both hvac and a new pack hold.
do $$
begin
  perform tests.ok('C2205 codes', (
    select array_agg(n.code order by n.code)
    from private.catalog_asset_types n join private.catalog_asset_types h on h.pack = 'hvac' and h.code = n.code
    where n.pack <> 'hvac') = array['BACKFLOW_PREVENTER', 'EXPANSION_TANK', 'PRESSURE_REGULATING_VALVE'],
    'the shared codes are not exactly the three');
  perform tests.ok('C2205 names', (
    select count(*) from private.catalog_asset_types n join private.catalog_asset_types h on h.pack = 'hvac' and h.code = n.code
    where n.pack = 'plumbing' and (n.code, n.name) in (
      ('BACKFLOW_PREVENTER', 'Backflow preventer'), ('PRESSURE_REGULATING_VALVE', 'Pressure regulating valve'), ('EXPANSION_TANK', 'Expansion tank'))
      and h.name = n.name) = 3, 'a shared code does not carry the hvac name');
end $$;

-- C2206: one name, one code, across the three packs.
do $$
begin
  perform tests.ok('C2206 names', not exists (
    select 1 from private.catalog_asset_types a join private.catalog_asset_types b on lower(a.name) = lower(b.name) and a.code <> b.code),
    'two types with the same name hold different codes');
end $$;

-- C2207 and C2208: every spelling is its own type's alone.
create table tests.sp_terms as
  select c.pack, c.code, 'name'::text as kind, tests.sp_norm(c.name) as term from private.catalog_asset_types c
  union all
  select c.pack, c.code, 'code', tests.sp_norm(c.code) from private.catalog_asset_types c
  union all
  select c.pack, c.code, 'spelling', tests.sp_norm(s.v) from private.catalog_asset_types c, unnest(c.synonyms) as s(v);

do $$
declare
  r record;
begin
  perform tests.ok('C2207 sample', (select count(*) from tests.sp_terms where kind = 'spelling' and pack in ('plumbing', 'electrical')) >= 40,
    'the spelling table is nearly empty');
  perform tests.ok('C2207 spellings', not exists (
    select 1 from tests.sp_terms a join tests.sp_terms b on a.term = b.term and a.code <> b.code where a.kind = 'spelling'),
    'a spelling equals the name, code or spelling of a type with another code');
  for r in select pack, code, synonyms from private.catalog_asset_types where pack in ('plumbing', 'electrical') loop
    perform tests.ok('C2208 ' || r.code, cardinality(r.synonyms) >= 1, r.code || ' has no spelling');
    perform tests.ok('C2208 repeat ' || r.code,
      (select count(distinct tests.sp_norm(s.v)) from unnest(r.synonyms) as s(v)) = cardinality(r.synonyms), r.code || ' repeats a spelling');
  end loop;
end $$;

-- C2209: who is released after the migration, and what a new pack starts as.
do $$
declare
  o uuid := tests.sp_new_org('spN');
begin
  perform tests.ok('C2209 hvac', (select released_at from private.catalog_packs where pack = 'hvac') is not null, 'hvac is not released');
  perform tests.ok('C2301 plumbing', (select released_at from private.catalog_packs where pack = 'plumbing') <= now(), 'plumbing is not released');
  perform tests.ok('C2301 electrical', (select released_at from private.catalog_packs where pack = 'electrical') <= now(), 'electrical is not released');
  perform tests.ok('C2209 column', exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'catalog_packs' and column_name = 'released_at'
      and data_type = 'timestamp with time zone' and column_default is null and is_nullable = 'YES'), 'released_at is not a nullable timestamptz with no default');

  insert into private.catalog_packs (pack, trade_context) values ('sp_new', 'test trade');
  perform tests.ok('C2209 new pack', (select released_at from private.catalog_packs where pack = 'sp_new') is null, 'a new pack starts released');
  insert into private.catalog_asset_types (pack, code, name, default_visit_months) values ('sp_new', 'SPX', 'Sp x', '{3}');
  perform tests.expect_error('C2209 new pack seed', format('select private.seed_org_catalog(%L, %L)', o, 'sp_new'), '55000');

  -- a second registered pack that stays unreleased, so the refusal is proven for two members
  insert into private.catalog_packs (pack, trade_context) values ('sp_new2', 'test trade two');
  insert into private.catalog_asset_types (pack, code, name, default_visit_months) values ('sp_new2', 'SPY', 'Sp y', '{3}');
end $$;

-- C2210: an unreleased pack raises 55000 and changes nothing, for a null context and for a held one.
do $$
declare
  n uuid := tests.id('spN');
  h uuid := tests.sp_new_org('spH', null);
  d_n text := tests.sp_digest(tests.id('spN'));
  d_h text;
  p text;
begin
  perform private.seed_org_catalog(h, 'hvac');
  d_h := tests.sp_digest(h);
  foreach p in array array['sp_new', 'sp_new2'] loop
    perform tests.expect_error('C2210 ' || p || ' null context', format('select private.seed_org_catalog(%L, %L)', n, p), '55000');
    perform tests.ok('C2210 ' || p || ' null unchanged', tests.sp_digest(n) = d_n and tests.sp_count(n) = 0 and tests.sp_ctx(n) is null,
      'the org changed after a refused seed');
    perform tests.expect_error('C2210 ' || p || ' held context', format('select private.seed_org_catalog(%L, %L)', h, p), '55000');
    perform tests.ok('C2210 ' || p || ' held unchanged', tests.sp_digest(h) = d_h and tests.sp_ctx(h) = 'HVAC and mechanical',
      'the org changed after a refused seed');
  end loop;
end $$;

-- C2302: both shipped packs carry a release time that is not in the future, and the two test packs do not.
do $$
begin
  perform tests.ok('C2302 shipped', (select count(*) from private.catalog_packs where pack in ('hvac', 'plumbing', 'electrical') and released_at is not null and released_at <= now()) = 3,
    'a shipped pack has no release time');
  perform tests.ok('C2302 test packs', (select count(*) from private.catalog_packs where pack in ('sp_new', 'sp_new2') and released_at is null) = 2,
    'a test pack is released');
end $$;

-- C2211: an unregistered pack.
do $$
declare
  n uuid := tests.id('spN');
begin
  perform tests.expect_error('C2211 unregistered', format('select private.seed_org_catalog(%L, %L)', n, 'nope'), '22023');
  perform tests.ok('C2211 untouched', tests.sp_count(n) = 0 and tests.sp_ctx(n) is null, 'the org changed after a refused seed');
end $$;

-- C2212: no pack argument seeds hvac (org spH was seeded in C2210, so seed a new org here with no pack argument).
do $$
declare
  d uuid := tests.sp_new_org('spD', null);
  n integer;
begin
  n := private.seed_org_catalog(d);
  perform tests.ok('C2212 return', n = 40, 'returned ' || n);
  perform tests.ok('C2212 stamp', tests.sp_count(d, 'hvac') = 40 and tests.sp_count(d) = 40, 'the 40 types are not all stamped hvac');
  perform tests.ok('C2212 tasks', tests.sp_task_count(d) = (select count(*) from private.catalog_asset_type_tasks where pack = 'hvac'), 'the task count differs from the hvac pack');
  perform tests.ok('C2212 context', tests.sp_ctx(d) = 'HVAC and mechanical', 'the context is not the hvac phrase');
end $$;

-- C2213: the gate, the seed and the sheet are closed to the API roles.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    -- the grants themselves: both functions are invoker, so a call would also fail at the closed tables
    perform tests.ok('C2213 ' || r || ' seed grant', not has_function_privilege(r, 'private.seed_org_catalog(uuid, text)', 'execute'), r || ' can execute seed_org_catalog');
    perform tests.ok('C2213 ' || r || ' sheet grant', not has_function_privilege(r, 'private.pack_review_sheet(text)', 'execute'), r || ' can execute pack_review_sheet');
    perform tests.ok('C2213 ' || r || ' column grant', not has_column_privilege(r, 'private.catalog_packs', 'released_at', 'select')
      and not has_column_privilege(r, 'private.catalog_packs', 'released_at', 'update'), r || ' holds a privilege on released_at');
    if r = 'anon' then perform tests.act_as_anon(); else perform tests.act_as('uA'); end if;
    perform tests.expect_error('C2213 ' || r || ' read', 'select released_at from private.catalog_packs', '42501');
    perform tests.expect_error('C2213 ' || r || ' update', $q$update private.catalog_packs set released_at = now() where pack = 'plumbing'$q$, '42501');
    perform tests.expect_error('C2213 ' || r || ' seed', format('select private.seed_org_catalog(%L, %L)', tests.id('spN'), 'plumbing'), '42501');
    perform tests.expect_error('C2213 ' || r || ' sheet', $q$select * from private.pack_review_sheet('plumbing')$q$, '42501');
    execute 'reset role';
  end loop;
end $$;

-- C2223 and C2224: the reviewer's sheet.
do $$
declare
  r record;
  p text;
begin
  -- the columns by their names, then the first row by function order
  perform s.pack, s.code, s.name, s.default_visit_months, s.synonyms, s.task_position, s.task from private.pack_review_sheet('plumbing') s limit 1;
  select o.pack, o.code, o.name, o.default_visit_months, o.synonyms, o.task_position, o.task into r
  from private.pack_review_sheet('plumbing') with ordinality as o(pack, code, name, default_visit_months, synonyms, task_position, task, ord)
  order by o.ord limit 1;
  perform tests.ok('C2223 first row', r.pack = 'plumbing' and r.code = 'BACKFLOW_PREVENTER' and r.name = 'Backflow preventer'
    and r.default_visit_months = '{10}' and r.task_position = 1
    and r.synonyms = (select synonyms from private.catalog_asset_types where pack = 'plumbing' and code = 'BACKFLOW_PREVENTER')
    and r.task = (select description from private.catalog_asset_type_tasks where pack = 'plumbing' and code = 'BACKFLOW_PREVENTER' and position = 1),
    'the first sheet row is not the first backflow task');
  foreach p in array array['plumbing', 'electrical'] loop
    perform tests.ok('C2223 order ' || p, (
      with s as (select code, pos, o from private.pack_review_sheet(p) with ordinality as x(pk, code, nm, mo, sy, pos, tk, o))
      select (select array_agg(code || '/' || pos order by o) from s) = (select array_agg(code || '/' || pos order by code, pos) from s)),
      'the ' || p || ' sheet is not ordered by code then position');
    perform tests.ok('C2224 ' || p, (select count(*) from private.pack_review_sheet(p))
      = (select count(*) from private.catalog_asset_type_tasks where pack = p) and (select count(*) from private.pack_review_sheet(p)) > 0,
      'the ' || p || ' sheet has a different number of rows than the pack has tasks');
  end loop;
  perform tests.ok('C2224 unregistered', (select count(*) from private.pack_review_sheet('nope')) = 0, 'an unregistered pack returned rows');
end $$;

-- ---- the two shipped packs are released by the migration, so S3 seeds them as they are.

-- C2214, C2215: plumbing seeds into a fresh org.
do $$
declare
  p uuid := tests.sp_new_org('spP', null);
  n integer;
begin
  n := private.seed_org_catalog(p, 'plumbing');
  perform tests.ok('C2214 plumbing', n = 20, 'returned ' || n);
  perform tests.ok('C2215 types', tests.sp_count(p) = 20 and tests.sp_count(p, 'plumbing') = 20, 'the org does not hold 20 plumbing types');
  perform tests.ok('C2215 template', tests.sp_same_catalog(p, 'plumbing'), 'the org copy differs from the plumbing template');
  perform tests.ok('C2215 context', tests.sp_ctx(p) = 'plumbing', 'the context is ' || coalesce(tests.sp_ctx(p), 'null'));
end $$;

-- C2214, C2216: electrical seeds into a fresh org.
do $$
declare
  q uuid := tests.sp_new_org('spQ', null);
  n integer;
begin
  n := private.seed_org_catalog(q, 'electrical');
  perform tests.ok('C2214 electrical', n = 20, 'returned ' || n);
  perform tests.ok('C2216 types', tests.sp_count(q) = 20 and tests.sp_count(q, 'electrical') = 20, 'the org does not hold 20 electrical types');
  perform tests.ok('C2216 template', tests.sp_same_catalog(q, 'electrical'), 'the org copy differs from the electrical template');
  perform tests.ok('C2216 context', tests.sp_ctx(q) = 'electrical', 'the context is ' || coalesce(tests.sp_ctx(q), 'null'));
end $$;

-- C2217: hvac first, then plumbing.
do $$
declare
  o uuid := tests.sp_new_org('spHP', null);
  shared text[] := array['BACKFLOW_PREVENTER', 'PRESSURE_REGULATING_VALVE', 'EXPANSION_TANK'];
  rest text[];
  n integer;
begin
  select array_agg(code) into rest from private.catalog_asset_types where pack = 'plumbing' and code <> all (shared);
  perform tests.ok('C2217 differs', (select count(*) from private.catalog_asset_type_tasks where pack = 'hvac' and code = 'BACKFLOW_PREVENTER')
    <> (select count(*) from private.catalog_asset_type_tasks where pack = 'plumbing' and code = 'BACKFLOW_PREVENTER'), 'the two backflow checklists are the same, so the check proves nothing');
  perform private.seed_org_catalog(o, 'hvac');
  n := private.seed_org_catalog(o, 'plumbing');
  perform tests.ok('C2217 return', n = 17, 'returned ' || n);
  perform tests.ok('C2217 shared stay hvac', tests.sp_same_catalog(o, 'hvac', shared), 'a shared type lost the hvac checklist');
  perform tests.ok('C2217 hvac count', tests.sp_count(o, 'hvac') = 40 and tests.sp_count(o, 'plumbing') = 17, 'the stamps are not 40 hvac and 17 plumbing');
  perform tests.ok('C2217 rest', tests.sp_same_catalog(o, 'plumbing', rest), 'the 17 other plumbing types differ from the template');
  perform tests.ok('C2217 context', tests.sp_ctx(o) = 'HVAC and mechanical, plumbing', 'the context is ' || coalesce(tests.sp_ctx(o), 'null'));
end $$;

-- C2218: plumbing first, then hvac.
do $$
declare
  o uuid := tests.sp_new_org('spPH', null);
  shared text[] := array['BACKFLOW_PREVENTER', 'PRESSURE_REGULATING_VALVE', 'EXPANSION_TANK'];
  rest text[];
  n integer;
begin
  select array_agg(code) into rest from private.catalog_asset_types where pack = 'hvac' and code <> all (shared);
  perform private.seed_org_catalog(o, 'plumbing');
  n := private.seed_org_catalog(o, 'hvac');
  perform tests.ok('C2218 return', n = 37, 'returned ' || n);
  perform tests.ok('C2218 shared stay plumbing', tests.sp_same_catalog(o, 'plumbing', shared), 'a shared type lost the plumbing checklist');
  perform tests.ok('C2218 plumbing all', tests.sp_same_catalog(o, 'plumbing'), 'the 20 plumbing types differ from the template');
  perform tests.ok('C2218 counts', tests.sp_count(o, 'plumbing') = 20 and tests.sp_count(o, 'hvac') = 37, 'the stamps are not 20 plumbing and 37 hvac');
  perform tests.ok('C2218 rest', tests.sp_same_catalog(o, 'hvac', rest), 'the 37 hvac types differ from the template');
  perform tests.ok('C2218 context', tests.sp_ctx(o) = 'plumbing, HVAC and mechanical', 'the context is ' || coalesce(tests.sp_ctx(o), 'null'));
end $$;

-- C2219: all three packs, then each again.
do $$
declare
  o uuid := tests.sp_new_org('spAll', null);
  d text;
  p text;
  n integer;
begin
  perform private.seed_org_catalog(o, 'hvac');
  perform private.seed_org_catalog(o, 'plumbing');
  perform private.seed_org_catalog(o, 'electrical');
  perform tests.ok('C2219 types', tests.sp_count(o) = 77, 'the org holds ' || tests.sp_count(o) || ' types, not 77');
  perform tests.ok('C2219 context', tests.sp_ctx(o) = 'HVAC and mechanical, plumbing, electrical', 'the context is ' || coalesce(tests.sp_ctx(o), 'null'));
  d := tests.sp_digest(o);
  foreach p in array array['hvac', 'plumbing', 'electrical'] loop
    n := private.seed_org_catalog(o, p);
    perform tests.ok('C2219 again ' || p, n = 0, p || ' seeded again returned ' || n);
    perform tests.ok('C2219 unchanged ' || p, tests.sp_digest(o) = d, 'a repeat seed of ' || p || ' changed the org');
  end loop;
end $$;

-- C2220 and C2221 setup: org A takes plumbing then electrical, org B takes hvac then plumbing.
do $$
begin
  perform private.seed_org_catalog(tests.id('orgA'), 'plumbing');
  perform private.seed_org_catalog(tests.id('orgA'), 'electrical');
  perform private.seed_org_catalog(tests.id('orgB'), 'hvac');
  perform private.seed_org_catalog(tests.id('orgB'), 'plumbing');
end $$;

-- C2220: reset restores a plumbing type and an electrical type to their own pack after an edit; C2221 for org A's shared code.
select tests.act_as('uA');
do $$
declare
  a uuid := tests.id('orgA');
  v_pair text[];
begin
  foreach v_pair slice 1 in array array[array['SUMP_PUMP', 'plumbing'], array['GENERATOR', 'electrical'], array['BACKFLOW_PREVENTER', 'plumbing']] loop
    update public.asset_types set name = 'Zed ' || v_pair[1], default_visit_months = '{1}', synonyms = '{custom}'
    where org_id = a and code = v_pair[1];
    update public.asset_type_tasks set description = 'edited'
    where asset_type_id = (select id from public.asset_types where org_id = a and code = v_pair[1]);
    perform tests.ok('C2220 edited ' || v_pair[1], not tests.sp_same_catalog(a, v_pair[2], array[v_pair[1]]), 'the edit changed nothing');
    perform public.reset_task_library_type(v_pair[1]);
    perform tests.ok(case v_pair[1] when 'BACKFLOW_PREVENTER' then 'C2221 plumbing org ' else 'C2220 ' end || v_pair[1],
      tests.sp_same_catalog(a, v_pair[2], array[v_pair[1]]), v_pair[1] || ' was not restored to the ' || v_pair[2] || ' pack');
  end loop;
end $$;
reset role;

-- C2221: the same code in an org seeded hvac first is restored to the hvac pack.
select tests.act_as('uB');
do $$
declare
  b uuid := tests.id('orgB');
begin
  update public.asset_types set name = 'Zed backflow', default_visit_months = '{1}', synonyms = '{custom}'
  where org_id = b and code = 'BACKFLOW_PREVENTER';
  update public.asset_type_tasks set description = 'edited'
  where asset_type_id = (select id from public.asset_types where org_id = b and code = 'BACKFLOW_PREVENTER');
  perform tests.ok('C2221 edited hvac org', not tests.sp_same_catalog(b, 'hvac', array['BACKFLOW_PREVENTER']), 'the edit changed nothing');
  perform public.reset_task_library_type('BACKFLOW_PREVENTER');
  perform tests.ok('C2221 hvac org', tests.sp_same_catalog(b, 'hvac', array['BACKFLOW_PREVENTER']), 'BACKFLOW_PREVENTER was not restored to the hvac pack');
  perform tests.ok('C2221 hvac stamp', (select pack from public.asset_types where org_id = b and code = 'BACKFLOW_PREVENTER') = 'hvac', 'the stamp changed');
end $$;
reset role;

-- pricing-page C2425 (.specs/features/pricing-page/checks.md): the trade codes the pricing page offers are the released packs.
-- The expected list is copied from that plan (door 2: hvac, plumbing, electrical), never read back from web/domain/billing.
select tests.ok(
  'C2425 released packs',
  (select array_agg(pack order by pack) from private.catalog_packs where released_at is not null) = array['electrical', 'hvac', 'plumbing'],
  'the released packs are not exactly electrical, hvac and plumbing'
);
select tests.ok(
  'C2425 other is not a pack',
  not exists (select 1 from private.catalog_packs where pack = 'other'),
  'other must not be a registered pack: it is a trade with no starter catalog'
);

rollback;
select 'starter_packs: pass' as result;
