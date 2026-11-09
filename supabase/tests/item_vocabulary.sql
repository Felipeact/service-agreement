-- item-vocabulary, database side: C2002, C2004, C2006, C2007, C2028-C2030
-- (.specs/features/item-vocabulary/checks.md). Run after fixture.sql and the seed body in the same execute_sql call
-- (npm run test:db item_vocabulary). Fixture: org A owner uA, estimator uE, viewer uV; org B owner uB. An admin of org A
-- is added below. Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAd'), 'uAd@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAd'), 'admin');

create function tests.iv_words(p_org text) returns text
language sql security definer as $$
  select item_singular || '/' || item_plural from public.org_settings where org_id = tests.id(p_org)
$$;
grant execute on function tests.iv_words(text) to anon, authenticated;

-- C2007: rows inserted without the words (the fixture's, and the seeded demo org's) read equipment.
do $$ begin
  perform tests.ok('C2007 fixture org A', tests.iv_words('orgA') = 'equipment/equipment', 'org A does not read equipment/equipment');
  perform tests.ok('C2007 fixture org B', tests.iv_words('orgB') = 'equipment/equipment', 'org B does not read equipment/equipment');
  perform tests.ok('C2007 demo org', (
      select s.item_singular || '/' || s.item_plural from public.org_settings s join public.orgs o on o.id = s.org_id
      where o.name = 'Kettle Ridge Mechanical Ltd.') = 'equipment/equipment', 'the demo org does not read equipment/equipment');
  perform tests.ok('C2007 columns not null',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'org_settings'
       and column_name in ('item_singular', 'item_plural') and is_nullable = 'NO' and column_default like '%equipment%') = 2,
    'item_singular and item_plural are not both not null with the default equipment');
end $$;

-- C2002: an owner and an admin each set the words.
select tests.act_as('uA');
do $$
declare n bigint;
begin
  update public.org_settings set item_singular = 'station', item_plural = 'stations' where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2002 owner rows', n = 1, 'the owner updated ' || n || ' rows');
  perform tests.ok('C2002 owner values', tests.iv_words('orgA') = 'station/stations', 'org A reads ' || tests.iv_words('orgA'));
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
update public.org_settings set item_singular = 'equipment', item_plural = 'equipment' where org_id = tests.id('orgA');
select tests.act_as('uAd');
do $$
declare n bigint;
begin
  update public.org_settings set item_singular = 'area', item_plural = 'areas' where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2002 admin rows', n = 1, 'the admin updated ' || n || ' rows');
  perform tests.ok('C2002 admin values', tests.iv_words('orgA') = 'area/areas', 'org A reads ' || tests.iv_words('orgA'));
end $$;

-- C2006: an estimator and a viewer change nothing.
do $$
declare n bigint;
begin
  perform tests.act_as('uE');
  update public.org_settings set item_singular = 'unit', item_plural = 'units' where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2006 estimator rows', n = 0, 'the estimator updated ' || n || ' rows');
  perform tests.act_as('uV');
  update public.org_settings set item_singular = 'unit', item_plural = 'units' where org_id = tests.id('orgA');
  get diagnostics n = row_count;
  perform tests.ok('C2006 viewer rows', n = 0, 'the viewer updated ' || n || ' rows');
  perform tests.ok('C2006 unchanged', tests.iv_words('orgA') = 'area/areas', 'org A reads ' || tests.iv_words('orgA'));
end $$;

-- C2004: the column checks refuse what cannot be printed, below the app.
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare v text;
begin
  foreach v in array array['Station', '', repeat('a', 31), '1station'] loop
    perform tests.expect_error('C2004 singular ' || v,
      format('update public.org_settings set item_singular = %L where org_id = %L', v, tests.id('orgA')), '23514');
    perform tests.expect_error('C2004 plural ' || v,
      format('update public.org_settings set item_plural = %L where org_id = %L', v, tests.id('orgA')), '23514');
  end loop;
  perform tests.ok('C2004 unchanged', tests.iv_words('orgA') = 'area/areas', 'org A reads ' || tests.iv_words('orgA'));
end $$;

-- A sent-looking version with a live link, built directly: portal_view reads rows, not how they got there.
create function tests.iv_hash(p_token text) returns text
language sql immutable as $$ select encode(sha256(convert_to(p_token, 'UTF8')), 'hex') $$;
grant execute on function tests.iv_hash(text) to anon, authenticated;

insert into public.sites (id, org_id, customer_id, name) values (tests.id('iv:site'), tests.id('orgA'), tests.id('custA'), 'Site iv');
insert into public.agreements (id, org_id, site_id, status, number) values (tests.id('iv'), tests.id('orgA'), tests.id('iv:site'), 'sent', 'iv');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, term_start)
values (tests.id('iv:v1'), tests.id('orgA'), tests.id('iv'), 1, '2027-01-01');
insert into public.portal_links (org_id, agreement_version_id, token_hash) values (tests.id('orgA'), tests.id('iv:v1'), tests.iv_hash('iv-token'));

-- C2028, C2029, C2030: the customer's read, signed in as nobody.
select tests.act_as_anon();
do $$
declare v jsonb;
begin
  v := public.portal_view(tests.iv_hash('iv-token'));
  perform tests.ok('C2028 singular', v -> 'tenant' ->> 'itemSingular' = 'area', 'itemSingular is ' || coalesce(v -> 'tenant' ->> 'itemSingular', 'null'));
  perform tests.ok('C2028 plural', v -> 'tenant' ->> 'itemPlural' = 'areas', 'itemPlural is ' || coalesce(v -> 'tenant' ->> 'itemPlural', 'null'));
  perform tests.ok('C2028 branding kept', v -> 'tenant' ->> 'name' = 'Legal A' and v -> 'tenant' ? 'address'
    and v -> 'tenant' ? 'phone' and v -> 'tenant' ? 'accent', 'tenant lost name, address, phone or accent: ' || (v -> 'tenant')::text);
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
update public.org_settings set item_singular = 'equipment', item_plural = 'equipment' where org_id = tests.id('orgA');
select tests.act_as_anon();
do $$
declare v jsonb;
begin
  v := public.portal_view(tests.iv_hash('iv-token'));
  perform tests.ok('C2029 default', v -> 'tenant' ->> 'itemSingular' = 'equipment' and v -> 'tenant' ->> 'itemPlural' = 'equipment',
    'the default org reads ' || (v -> 'tenant')::text);
  perform tests.ok('C2030 unknown token', public.portal_view(tests.iv_hash('no-such-token')) is null, 'an unknown token did not return null');
end $$;

reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C2030 signature', (
      select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'portal_view' and p.prorettype = 'jsonb'::regtype
        and pg_get_function_identity_arguments(p.oid) = 'p_token_hash text') = 1, 'portal_view(text) returning jsonb is not the one overload');
  perform tests.ok('C2030 overloads', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'portal_view') = 1, 'portal_view has a second overload');
  perform tests.ok('C2030 anon grant', has_function_privilege('anon', 'public.portal_view(text)', 'execute'), 'anon cannot execute portal_view');
end $$;

rollback;
select 'item_vocabulary: pass' as result;
