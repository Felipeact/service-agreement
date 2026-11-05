-- global-search, database side: C1552-C1569 (.specs/features/global-search/checks.md). Run after fixture.sql in the same
-- execute_sql call (npm run test:db search). Fixture: org A owner uA, estimator uE, viewer uV (an admin, uAdm, is added
-- here); org B owner uB; uX belongs to no org. Org A holds custA, cust2A, siteA (unit RTU-1 of type "Rooftop unit").

reset role;
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values (tests.id('uAdm'), 'uAdm@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('uAdm'), 'admin');

-- The titles of the p_kind hits for p_query, in the order the function returned them, joined with '|'.
create function tests.sr_titles(p_query text, p_kind text, p_limit integer default 50) returns text
language sql as $$
  select string_agg(r.title, '|' order by r.n)
  from public.search_records(p_query, p_limit) with ordinality as r(kind, id, title, customer_name, site_id, site_name, address, type_name, n)
  where r.kind = p_kind
$$;

create function tests.sr_count(p_query text, p_kind text, p_limit integer default 50) returns bigint
language sql as $$
  select count(*) from public.search_records(p_query, p_limit) r where r.kind = p_kind
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Records of org A for the cases below, written as the table owner.
insert into public.customers (id, org_id, name) values
  (tests.id('sr:hv'), tests.id('orgA'), 'Harbourview Strata'),
  (tests.id('sr:anchor'), tests.id('orgA'), 'Anchor Co'),
  (tests.id('sr:banner'), tests.id('orgA'), 'Banner Co'),
  (tests.id('sr:canal'), tests.id('orgA'), 'Canal Co'),
  (tests.id('sr:ab'), tests.id('orgA'), 'Ab Xylo'),
  (tests.id('sr:xylo'), tests.id('orgA'), 'Xylophone'),
  (tests.id('dup1'), tests.id('orgA'), 'Dup Twin'),
  (tests.id('dup2'), tests.id('orgA'), 'Dup Twin');
insert into public.sites (id, org_id, customer_id, name, address) values
  (tests.id('sr:tower'), tests.id('orgA'), tests.id('sr:hv'), 'North Tower', '12 Main St'),
  (tests.id('sr:plain'), tests.id('orgA'), tests.id('sr:hv'), 'Plain Site', null);
insert into public.assets (id, org_id, site_id, asset_type_id, unit_no) values
  (tests.id('sr:rtu3'), tests.id('orgA'), tests.id('sr:tower'), tests.id('typeA'), 'RTU-3'),
  (tests.id('sr:nounit'), tests.id('orgA'), tests.id('sr:tower'), tests.id('typeA'), null);

-- Literal characters (C1560): one customer per character, and a decoy that a wildcard reading would also match.
insert into public.customers (org_id, name) values
  (tests.id('orgA'), 'Lit A%B'), (tests.id('orgA'), 'Lit A_B'), (tests.id('orgA'), 'Lit A\B'), (tests.id('orgA'), 'Lit AxB');

-- The limit (C1562): three matching customers, sites and units. The bounds (C1563): 101 matching customers.
insert into public.customers (id, org_id, name) select tests.id('trio:c' || i), tests.id('orgA'), 'Trio C' || i from generate_series(1, 3) i;
insert into public.sites (id, org_id, customer_id, name) select tests.id('trio:s' || i), tests.id('orgA'), tests.id('custA'), 'Trio S' || i from generate_series(1, 3) i;
insert into public.assets (org_id, site_id, asset_type_id, unit_no) select tests.id('orgA'), tests.id('siteA'), tests.id('typeA'), 'TRIO-' || i from generate_series(1, 3) i;
insert into public.customers (org_id, name) select tests.id('orgA'), 'Bulk ' || lpad(i::text, 3, '0') from generate_series(1, 101) i;

-- Inactive records (C1566). "Ghost" matches every row below; the *On rows are the active siblings.
insert into public.customers (id, org_id, name, deactivated_at, deactivated_by) values
  (tests.id('gh:custoff'), tests.id('orgA'), 'Ghost Cust Off', now(), tests.id('uA')),
  (tests.id('gh:parent'), tests.id('orgA'), 'Ghost Parent', now(), tests.id('uA'));
insert into public.customers (id, org_id, name) values (tests.id('gh:custon'), tests.id('orgA'), 'Ghost Cust On');
insert into public.sites (id, org_id, customer_id, name, deactivated_at, deactivated_by) values
  (tests.id('gh:siteoff'), tests.id('orgA'), tests.id('custA'), 'Ghost Site Off', now(), tests.id('uA'));
insert into public.sites (id, org_id, customer_id, name) values
  (tests.id('gh:siteon'), tests.id('orgA'), tests.id('custA'), 'Ghost Site On'),
  (tests.id('gh:child'), tests.id('orgA'), tests.id('gh:parent'), 'Ghost Child Site');
insert into public.assets (org_id, site_id, asset_type_id, unit_no, deactivated_at, deactivated_by) values
  (tests.id('orgA'), tests.id('gh:siteon'), tests.id('typeA'), 'GHOST-OFF', now(), tests.id('uA'));
insert into public.assets (org_id, site_id, asset_type_id, unit_no) values
  (tests.id('orgA'), tests.id('gh:siteon'), tests.id('typeA'), 'GHOST-ON'),
  (tests.id('orgA'), tests.id('gh:siteoff'), tests.id('typeA'), 'GHOST-AT-OFFSITE'),
  (tests.id('orgA'), tests.id('gh:child'), tests.id('typeA'), 'GHOST-AT-OFFCUST');

-- C1552: the function's declaration, read from the catalog.
do $$
declare
  f oid := 'public.search_records(text, integer)'::regprocedure;
begin
  perform tests.ok('C1552 invoker', (select not prosecdef from pg_proc where oid = f), 'the function is security definer');
  perform tests.ok('C1552 stable', (select provolatile = 's' from pg_proc where oid = f), 'the function is not stable');
  perform tests.ok('C1552 search_path', (select proconfig = array['search_path=""'] from pg_proc where oid = f),
    'search_path is not the empty string');
  perform tests.ok('C1552 columns', pg_get_function_result(f) =
    'TABLE(kind text, id uuid, title text, customer_name text, site_id uuid, site_name text, address text, type_name text)',
    'the eight columns differ: ' || pg_get_function_result(f));
  perform tests.ok('C1552 authenticated', has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot execute');
end $$;

select tests.act_as('uA');

-- C1553: customer name, any case.
do $$
begin
  perform tests.ok('C1553 lower', tests.sr_titles('harb', 'customer') = 'Harbourview Strata', 'harb: ' || coalesce(tests.sr_titles('harb', 'customer'), 'none'));
  perform tests.ok('C1553 upper', tests.sr_titles('HARB', 'customer') = 'Harbourview Strata', 'HARB: ' || coalesce(tests.sr_titles('HARB', 'customer'), 'none'));
end $$;

-- C1554: site name.
do $$
begin
  perform tests.ok('C1554 site name', tests.sr_titles('tower', 'site') = 'North Tower', 'tower: ' || coalesce(tests.sr_titles('tower', 'site'), 'none'));
end $$;

-- C1555: site address; a site with no address is not an error and is still found by name.
do $$
begin
  perform tests.ok('C1555 address', tests.sr_titles('main st', 'site') = 'North Tower', 'main st: ' || coalesce(tests.sr_titles('main st', 'site'), 'none'));
  perform tests.ok('C1555 null address by name', tests.sr_titles('plain', 'site') = 'Plain Site', 'plain: ' || coalesce(tests.sr_titles('plain', 'site'), 'none'));
end $$;

-- C1556: unit number; a unit with no number is never a hit.
do $$
begin
  perform tests.ok('C1556 unit', tests.sr_titles('rtu-3', 'asset') = 'RTU-3', 'rtu-3: ' || coalesce(tests.sr_titles('rtu-3', 'asset'), 'none'));
  perform tests.ok('C1556 no null title', (select count(*) from public.search_records('rtu', 50) r where r.title is null) = 0,
    'a hit has a null title');
  perform tests.ok('C1556 kind', (select min(r.kind) from public.search_records('rtu-3', 50) r) = 'asset', 'the kind is not asset');
end $$;

-- C1557: a customer hit.
do $$
declare r record;
begin
  select * into r from public.search_records('harbourview', 50) h where h.kind = 'customer';
  perform tests.ok('C1557 title', r.title = 'Harbourview Strata' and r.customer_name = 'Harbourview Strata', 'title or customer_name');
  perform tests.ok('C1557 nulls', r.site_id is null and r.site_name is null and r.address is null and r.type_name is null, 'a column is not null');
end $$;

-- C1558: a site hit.
do $$
declare r record;
begin
  select * into r from public.search_records('north tower', 50) h where h.kind = 'site';
  perform tests.ok('C1558 names', r.title = 'North Tower' and r.site_name = 'North Tower' and r.customer_name = 'Harbourview Strata', 'title, site_name or customer_name');
  perform tests.ok('C1558 id and address', r.site_id = tests.id('sr:tower') and r.id = tests.id('sr:tower') and r.address = '12 Main St', 'site_id or address');
  perform tests.ok('C1558 type', r.type_name is null, 'type_name is not null');
end $$;

-- C1559: an asset hit.
do $$
declare r record;
begin
  select * into r from public.search_records('rtu-3', 50) h where h.kind = 'asset';
  perform tests.ok('C1559 title', r.title = 'RTU-3' and r.type_name = 'Rooftop unit', 'title or type_name');
  perform tests.ok('C1559 site', r.site_id = tests.id('sr:tower') and r.site_name = 'North Tower' and r.customer_name = 'Harbourview Strata', 'site_id, site_name or customer_name');
  perform tests.ok('C1559 id and address', r.id = tests.id('sr:rtu3') and r.address is null, 'id or address');
end $$;

-- C1560: %, _ and \ match themselves and nothing else.
do $$
begin
  perform tests.ok('C1560 percent', tests.sr_titles('%', 'customer') = 'Lit A%B', '%: ' || coalesce(tests.sr_titles('%', 'customer'), 'none'));
  perform tests.ok('C1560 underscore', tests.sr_titles('_', 'customer') = 'Lit A_B', '_: ' || coalesce(tests.sr_titles('_', 'customer'), 'none'));
  perform tests.ok('C1560 backslash', tests.sr_titles('\', 'customer') = 'Lit A\B', '\: ' || coalesce(tests.sr_titles('\', 'customer'), 'none'));
end $$;

-- C1561: names that start with the text first, then title, then id.
do $$
declare
  first_dup uuid := least(tests.id('dup1'), tests.id('dup2'));
begin
  perform tests.ok('C1561 an', tests.sr_titles('an', 'customer') = 'Anchor Co|Banner Co|Canal Co',
    'an: ' || coalesce(tests.sr_titles('an', 'customer'), 'none'));
  perform tests.ok('C1561 prefix first', tests.sr_titles('xylo', 'customer') = 'Xylophone|Ab Xylo',
    'xylo: ' || coalesce(tests.sr_titles('xylo', 'customer'), 'none'));
  perform tests.ok('C1561 id', (select string_agg(r.id::text, '|' order by r.n)
         from public.search_records('dup twin', 50) with ordinality as r(kind, id, title, customer_name, site_id, site_name, address, type_name, n)
         where r.kind = 'customer') = first_dup::text || '|' || greatest(tests.id('dup1'), tests.id('dup2'))::text,
    'equal titles are not ordered by id');
end $$;

-- C1562: p_limit caps each kind separately.
do $$
begin
  perform tests.ok('C1562 customers', tests.sr_count('trio', 'customer', 2) = 2, 'customers');
  perform tests.ok('C1562 sites', tests.sr_count('trio', 'site', 2) = 2, 'sites');
  perform tests.ok('C1562 assets', tests.sr_count('trio', 'asset', 2) = 2, 'assets');
  perform tests.ok('C1562 total', (select count(*) from public.search_records('trio', 2)) = 6, 'six rows');
end $$;

-- C1563: p_limit is clamped to 1 through 100.
do $$
begin
  perform tests.ok('C1563 lower', tests.sr_count('bulk ', 'customer', 0) = 1, 'p_limit 0 is not 1');
  perform tests.ok('C1563 negative', tests.sr_count('bulk ', 'customer', -5) = 1, 'p_limit -5 is not 1');
  perform tests.ok('C1563 upper', tests.sr_count('bulk ', 'customer', 1000) = 100, 'p_limit 1000 is not 100 of 101');
end $$;

-- C1564: a blank query returns nothing and does not fail.
do $$
begin
  perform tests.ok('C1564 null', (select count(*) from public.search_records(null, 50)) = 0, 'null');
  perform tests.ok('C1564 empty', (select count(*) from public.search_records('', 50)) = 0, 'empty');
  perform tests.ok('C1564 spaces', (select count(*) from public.search_records('   ', 50)) = 0, 'spaces');
  perform tests.ok('C1564 tab and newline', (select count(*) from public.search_records(E' \t\n ', 50)) = 0, 'tab and newline');
end $$;

-- C1565: the text is trimmed.
do $$
begin
  perform tests.ok('C1565 trimmed', tests.sr_titles('  harb  ', 'customer') = tests.sr_titles('harb', 'customer')
    and tests.sr_titles('  harb  ', 'customer') = 'Harbourview Strata', 'the padded text found something else');
end $$;

-- C1566: inactive records, and records under an inactive parent, are not returned; their active siblings are.
do $$
declare
  customers text := tests.sr_titles('ghost', 'customer');
  sites text := tests.sr_titles('ghost', 'site');
  assets text := tests.sr_titles('ghost', 'asset');
begin
  perform tests.ok('C1566 active customer', customers = 'Ghost Cust On', 'customers: ' || coalesce(customers, 'none'));
  perform tests.ok('C1566 inactive customer', customers not like '%Cust Off%', 'a deactivated customer is returned');
  perform tests.ok('C1566 inactive site', sites = 'Ghost Site On', 'sites: ' || coalesce(sites, 'none'));
  perform tests.ok('C1566 site of inactive customer', sites not like '%Child%', 'a site of a deactivated customer is returned');
  perform tests.ok('C1566 active unit', assets = 'GHOST-ON', 'assets: ' || coalesce(assets, 'none'));
  perform tests.ok('C1566 inactive unit', assets not like '%GHOST-OFF%', 'a deactivated unit is returned');
  perform tests.ok('C1566 unit at inactive site', assets not like '%OFFSITE%', 'a unit at a deactivated site is returned');
  perform tests.ok('C1566 unit of inactive customer', assets not like '%OFFCUST%', 'a unit of a deactivated customer is returned');
end $$;

-- C1568: every role of the org gets the same non-empty result.
do $$
declare
  u text;
  expected text := tests.sr_titles('harb', 'customer');
begin
  foreach u in array array['uA', 'uAdm', 'uE', 'uV'] loop
    perform tests.act_as(u);
    perform tests.ok('C1568 ' || u, tests.sr_titles('harb', 'customer') = 'Harbourview Strata' and tests.sr_titles('harb', 'customer') = expected,
      u || ' got ' || coalesce(tests.sr_titles('harb', 'customer'), 'none'));
  end loop;
end $$;

-- C1567: another org, and a user with no org, see none of org A's records.
select tests.act_as('uB');
do $$
begin
  perform tests.ok('C1567 org B', (select count(*) from public.search_records('harb', 50)) = 0, 'org B found org A customers');
  perform tests.ok('C1567 org B units', (select count(*) from public.search_records('rtu-3', 50)) = 0, 'org B found org A units');
  perform tests.ok('C1567 org B own', (select count(*) from public.search_records('customer', 50)) > 0, 'org B found nothing of its own');
end $$;
select tests.act_as('uX');
do $$
begin
  perform tests.ok('C1567 no membership', (select count(*) from public.search_records('customer', 50)) = 0, 'a user with no org found records');
end $$;

-- C1569: anon cannot execute it, and neither can public.
select tests.act_as_anon();
do $$
begin
  perform tests.expect_error('C1569 anon', 'select * from public.search_records(''harb'', 5)', '42501');
end $$;
reset role;
do $$
begin
  perform tests.ok('C1569 public', not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.search_records(text, integer)'::regprocedure and a.grantee = 0), 'public holds execute');
end $$;

rollback;
select 'search: pass' as result;
