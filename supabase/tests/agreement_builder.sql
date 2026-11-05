-- agreement-builder: C704, C706-C709, C712, C717, C730, C735, C736, C738, C742, C751; term-dates C1136-C1140, C1144; versioning C1319-C1321, C1324, C1325, C1327, C1345. Run after fixture.sql in the same
-- execute_sql call (npm run test:db agreement_builder). Fixture: agrA (draft, versions 1 and 2) on siteA, agrB on siteB.
-- Setup runs as the table owner with no signed-in user, so the line trigger stands aside (door 4).

reset role;
select set_config('request.jwt.claims', '', true);

-- A site of its own for each agreement, so door 2's index never decides a setup insert.
create function tests.ab_site(p_name text, p_org text default 'A') returns uuid
language sql as $$
  insert into public.sites (id, org_id, customer_id, name)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id('cust' || p_org), p_name)
  returning id
$$;

-- An agreement <name> with version 1 (<name>:v1) on its own site <name>:site.
create function tests.ab_agr(p_name text, p_status text, p_number text default null, p_org text default 'A') returns uuid
language plpgsql as $$
begin
  perform tests.ab_site(p_name || ':site', p_org);
  insert into public.agreements (id, org_id, site_id, number, status)
  values (tests.id(p_name), tests.id('org' || p_org), tests.id(p_name || ':site'), p_number, p_status);
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  values (tests.id(p_name || ':v1'), tests.id('org' || p_org), tests.id(p_name), 1);
  return tests.id(p_name);
end $$;

create function tests.ab_version(p_agr text, p_no integer) returns uuid
language sql as $$
  insert into public.agreement_versions (id, org_id, agreement_id, version_no)
  select tests.id(p_agr || ':v' || p_no), a.org_id, a.id, p_no from public.agreements a where a.id = tests.id(p_agr)
  returning id
$$;

-- A line at p_position on version <version>, with id <version>:l<position>.
create function tests.ab_line(p_version text, p_position integer, p_description text default 'Quarterly PM',
                              p_visits integer default 4, p_cost bigint default 89250) returns uuid
language sql as $$
  insert into public.service_lines (id, org_id, agreement_version_id, position, description, visit_months, visits_per_year, cost_per_visit_cents)
  select tests.id(p_version || ':l' || p_position), v.org_id, v.id, p_position, p_description,
         (select array_agg(m::smallint order by m) from generate_series(1, p_visits) m), p_visits, p_cost
  from public.agreement_versions v where v.id = tests.id(p_version)
  returning id
$$;

create function tests.ab_line_sql(p_op text, p_version text, p_line uuid) returns text
language sql as $$
  select case p_op
    when 'insert' then format(
      'insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'select org_id, id, ''New line'', ''{4,10}'', 2, 15000 from public.agreement_versions where id = %L', tests.id(p_version))
    when 'update' then format('update public.service_lines set description = ''Changed'' where id = %L', p_line)
    when 'delete' then format('delete from public.service_lines where id = %L', p_line)
  end
$$;

create function tests.ab_count_on_site(p_site uuid) returns bigint
language sql security definer as $$ select count(*) from public.agreements where site_id = p_site $$;

select tests.ab_site('s706a');
select tests.ab_site('s706b');
select tests.ab_site('s706c');
select tests.ab_site('s706d');
select tests.ab_site('s738');
grant execute on all functions in schema tests to anon, authenticated;

-- C706 (first part): org A has no numbered agreement (agrA's number is null), so the first create is AG-1001.
select tests.act_as('uE');
do $$
declare v uuid;
begin
  v := public.create_agreement(tests.id('s706a'));
  perform tests.ok('C706 empty org', (select number from public.agreements where id = v) = 'AG-1001',
    'first number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  perform set_config('tests.first', v::text, true);
end $$;

-- C704: the create wrote a draft on the site with version 1, an empty snapshot, no lines and no event.
do $$
declare v uuid := current_setting('tests.first')::uuid;
begin
  perform tests.ok('C704 agreement', (select status = 'draft' and site_id = tests.id('s706a') and org_id = tests.id('orgA')
    from public.agreements where id = v), 'agreement is not a draft of org A on the site');
  perform tests.ok('C704 one version', (select count(*) = 1 and min(version_no) = 1 and bool_and(snapshot = '{}'::jsonb)
    from public.agreement_versions where agreement_id = v), 'not exactly version 1 with an empty snapshot');
  perform tests.ok('C704 no lines', (select count(*) from public.service_lines l join public.agreement_versions w
    on w.id = l.agreement_version_id where w.agreement_id = v) = 0, 'the new version has lines');
  perform tests.ok('C704 no event', (select count(*) from public.events where entity_id = v) = 0, 'an event was written');
end $$;

-- C706 (rest): the next number follows the highest AG-<digits> of the org only.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('n1048', 'accepted', 'AG-1048');
select tests.ab_agr('n1051', 'refused', 'AG-1051');
select tests.ab_agr('nX9', 'expired', 'X-9');
select tests.ab_agr('nNull', 'withdrawn', null);
select tests.ab_agr('nB5000', 'accepted', 'AG-5000', 'B');
select tests.act_as('uE');
do $$
declare v uuid;
begin
  v := public.create_agreement(tests.id('s706b'));
  perform tests.ok('C706 after highest', (select number from public.agreements where id = v) = 'AG-1052',
    'next number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  v := public.create_agreement(tests.id('s706c'));
  perform tests.ok('C706 second call', (select number from public.agreements where id = v) = 'AG-1053',
    'second number is ' || coalesce((select number from public.agreements where id = v), 'null'));
  v := public.create_agreement(tests.id('s706d'));
  perform tests.ok('C706 other org ignored', (select number from public.agreements where id = v) = 'AG-1054',
    'org B''s AG-5000 changed org A''s next number: ' || coalesce((select number from public.agreements where id = v), 'null'));
end $$;

-- C707: a number is unique in its org; another org and nulls are free.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_site('s707a');
select tests.ab_site('s707b', 'B');
select tests.ab_site('s707c');
select tests.ab_site('s707d');
do $$ begin
  perform tests.expect_error('C707 duplicate in org A',
    format('insert into public.agreements (org_id, site_id, number, status) values (%L, %L, ''AG-1048'', ''refused'')',
      tests.id('orgA'), tests.id('s707a')), '23505');
  perform tests.expect_rows('C707 same number in org B',
    format('insert into public.agreements (org_id, site_id, number, status) values (%L, %L, ''AG-1048'', ''refused'')',
      tests.id('orgB'), tests.id('s707b')), 1);
  perform tests.expect_rows('C707 null number',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''refused'')', tests.id('orgA'), tests.id('s707c')), 1);
  perform tests.expect_rows('C707 second null number',
    format('insert into public.agreements (org_id, site_id, status) values (%L, %L, ''refused'')', tests.id('orgA'), tests.id('s707d')), 1);
  perform tests.ok('C707 constraint', exists (select 1 from pg_constraint where conname = 'agreements_org_id_number_key'
    and conrelid = 'public.agreements'::regclass and contype = 'u'), 'agreements_org_id_number_key is missing');
end $$;

-- C708: the number is read under the org's advisory lock.
do $$
declare d text := pg_get_functiondef('public.create_agreement(uuid)'::regprocedure);
begin
  perform tests.ok('C708 lock', position('pg_advisory_xact_lock(hashtextextended(''agreement_number:'' ||' in d) > 0,
    'create_agreement takes no advisory lock on the org''s numbers');
  perform tests.ok('C708 lock first', position('pg_advisory_xact_lock' in d) < position('max(' in d),
    'the lock is taken after the highest number is read');
end $$;

-- C709: a site with a live agreement refuses a second one; the other four statuses free it.
do $$
declare s text;
begin
  foreach s in array array['draft','sent','accepted','refused','changes_requested','expired','withdrawn'] loop
    perform tests.ab_agr('live:' || s, s);
  end loop;
end $$;
select tests.act_as('uE');
do $$
declare s text; before bigint; site uuid;
begin
  foreach s in array array['draft','sent','changes_requested'] loop
    site := tests.id('live:' || s || ':site');
    before := tests.ab_count_on_site(site);
    perform tests.expect_error('C709 ' || s, format('select public.create_agreement(%L)', site), '23505');
    perform tests.ok('C709 ' || s || ' adds nothing', tests.ab_count_on_site(site) = before, 'an agreement was added');
  end loop;
  foreach s in array array['accepted','refused','expired','withdrawn'] loop
    site := tests.id('live:' || s || ':site');
    before := tests.ab_count_on_site(site);
    perform public.create_agreement(site);
    perform tests.ok('C709 ' || s, tests.ab_count_on_site(site) = before + 1, 'no agreement was added');
  end loop;
end $$;

-- C712: a missing site and another org's site are not found, and nothing is added.
do $$
declare before bigint := (select count(*) from public.agreements);
begin
  perform tests.expect_error('C712 missing site', format('select public.create_agreement(%L)', tests.id('no such site')), 'P0002');
  perform tests.expect_error('C712 org B site', format('select public.create_agreement(%L)', tests.id('siteB')), 'P0002');
  perform tests.ok('C712 nothing added', (select count(*) from public.agreements) = before, 'an agreement was added');
  perform tests.ok('C712 org B unchanged', tests.ab_count_on_site(tests.id('siteB')) = 1, 'org B''s site gained an agreement');
end $$;

-- C717: on the current version of a draft, a writer inserts, updates and deletes a line.
do $$
declare v uuid := current_setting('tests.first')::uuid; ver uuid; line uuid;
begin
  ver := (select id from public.agreement_versions where agreement_id = v and version_no = 1);
  perform tests.expect_rows('C717 insert',
    format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'values (%L, %L, ''Filter changes'', ''{4,10}'', 2, 15000)', tests.id('orgA'), ver), 1);
  line := (select id from public.service_lines where agreement_version_id = ver);
  perform tests.expect_rows('C717 update', format('update public.service_lines set description = ''Filters'' where id = %L', line), 1);
  perform tests.expect_rows('C717 delete', format('delete from public.service_lines where id = %L', line), 1);
end $$;

-- C730: a revise copies version n's lines into version n + 1 and leaves version n as it was.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('rev', 'changes_requested');
select tests.ab_line('rev:v1', 0, 'Preventive maintenance visit', 4, 89250);
select tests.ab_line('rev:v1', 1, 'Filter changes', 2, 15000);
create table tests.ab_rev_v1 as
  select id, position, description, visits_per_year, cost_per_visit_cents from public.service_lines
  where agreement_version_id = tests.id('rev:v1');
grant select on tests.ab_rev_v1 to authenticated;
select tests.act_as('uE');
do $$
declare v2 uuid;
begin
  perform public.apply_agreement_transition(tests.id('rev'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":2}');
  perform tests.ok('C730 status', (select status from public.agreements where id = tests.id('rev')) = 'draft', 'not draft');
  v2 := (select id from public.agreement_versions where agreement_id = tests.id('rev') and version_no = 2);
  perform tests.ok('C730 version 2', v2 is not null, 'no version 2');
  perform tests.ok('C730 copied lines',
    (select array_agg((position, description, visits_per_year, cost_per_visit_cents)::text order by position)
     from public.service_lines where agreement_version_id = v2)
    = (select array_agg((position, description, visits_per_year, cost_per_visit_cents)::text order by position) from tests.ab_rev_v1),
    'version 2''s lines differ from version 1''s');
  perform tests.ok('C730 new ids', not exists (select 1 from public.service_lines where agreement_version_id = v2
    and id in (select id from tests.ab_rev_v1)), 'a copied line kept its id');
  perform tests.ok('C730 version 1 kept',
    (select array_agg((id, position, description, visits_per_year, cost_per_visit_cents)::text order by position)
     from public.service_lines where agreement_version_id = tests.id('rev:v1'))
    = (select array_agg((id, position, description, visits_per_year, cost_per_visit_cents)::text order by position) from tests.ab_rev_v1),
    'version 1''s lines changed');
end $$;

-- C735: a member cannot change a past version of a draft, nor any version of an agreement that is not a draft.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('frz:draft', 'draft');
select tests.ab_line('frz:draft:v1', 0);
select tests.ab_version('frz:draft', 2);
do $$
declare s text;
begin
  foreach s in array array['sent','accepted','refused','changes_requested','expired','withdrawn'] loop
    perform tests.ab_agr('frz:' || s, s);
    perform tests.ab_line('frz:' || s || ':v1', 0);
  end loop;
end $$;
select tests.act_as('uE');
do $$
declare s text; op text;
begin
  foreach op in array array['insert','update','delete'] loop
    perform tests.expect_error('C735 older version ' || op,
      tests.ab_line_sql(op, 'frz:draft:v1', tests.id('frz:draft:v1:l0')), '55000');
    foreach s in array array['sent','accepted','refused','changes_requested','expired','withdrawn'] loop
      perform tests.expect_error('C735 ' || s || ' ' || op,
        tests.ab_line_sql(op, 'frz:' || s || ':v1', tests.id('frz:' || s || ':v1:l0')), '55000');
    end loop;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.expect_rows('C735 table owner on sent', tests.ab_line_sql('insert', 'frz:sent:v1', null), 1);
end $$;

-- C736: the trigger follows a status change made earlier in the same session.
select tests.ab_agr('wd', 'draft');
select tests.ab_line('wd:v1', 0);
select tests.ab_agr('rv', 'changes_requested');
select tests.ab_line('rv:v1', 0);
select tests.act_as('uE');
do $$ begin
  perform public.apply_agreement_transition(tests.id('wd'), 'draft', 'withdrawn', 'agreement.withdrawn', '{"from":"draft","to":"withdrawn"}');
  perform tests.expect_error('C736 after withdraw', tests.ab_line_sql('update', 'wd:v1', tests.id('wd:v1:l0')), '55000');
  perform public.apply_agreement_transition(tests.id('rv'), 'changes_requested', 'draft', 'agreement.revised',
    '{"from":"changes_requested","to":"draft","versionNo":2}');
  perform tests.expect_error('C736 version n after revise', tests.ab_line_sql('update', 'rv:v1', tests.id('rv:v1:l0')), '55000');
  perform tests.expect_rows('C736 version n + 1 after revise',
    format('update public.service_lines set description = ''Changed'' where agreement_version_id = %L',
      (select id from public.agreement_versions where agreement_id = tests.id('rv') and version_no = 2)), 1);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare f oid := 'private.service_lines_frozen()'::regprocedure;
begin
  perform tests.ok('C736 for share', position('for share' in lower(pg_get_functiondef(f))) > 0,
    'the trigger does not read the agreement for share');
  perform tests.ok('C736 definer', (select prosecdef from pg_proc where oid = f), 'the trigger function is not security definer');
  perform tests.ok('C736 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;

-- C738: a viewer creates nothing and changes no line of org A's current draft.
select tests.ab_agr('vw', 'draft');
select tests.ab_line('vw:v1', 0);
select tests.act_as('uV');
do $$
declare before bigint := tests.ab_count_on_site(tests.id('s738'));
begin
  perform tests.expect_error('C738 create', format('select public.create_agreement(%L)', tests.id('s738')), '42501');
  perform tests.ok('C738 nothing added', tests.ab_count_on_site(tests.id('s738')) = before, 'an agreement was added');
  perform tests.expect_error('C738 insert', tests.ab_line_sql('insert', 'vw:v1', null), '42501');
  perform tests.expect_rows('C738 update', tests.ab_line_sql('update', 'vw:v1', tests.id('vw:v1:l0')), 0);
  perform tests.expect_rows('C738 delete', tests.ab_line_sql('delete', 'vw:v1', tests.id('vw:v1:l0')), 0);
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C738 line kept', (select description = 'Quarterly PM' from public.service_lines where id = tests.id('vw:v1:l0')),
    'the viewer changed or deleted the line');
end $$;

-- C742: org A's estimator reaches nothing of org B's agreement.
select tests.act_as('uE');
do $$ begin
  perform tests.ok('C742 agreement', (select count(*) from public.agreements where id = tests.id('agrB')) = 0, 'org B''s agreement is visible');
  perform tests.ok('C742 versions', (select count(*) from public.agreement_versions where agreement_id = tests.id('agrB')) = 0,
    'org B''s versions are visible');
  perform tests.ok('C742 lines', (select count(*) from public.service_lines where org_id = tests.id('orgB')) = 0, 'org B''s lines are visible');
  perform tests.expect_rows('C742 update', format('update public.service_lines set description = ''A'' where id = %L', tests.id('lineB')), 0);
  perform tests.expect_rows('C742 delete', format('delete from public.service_lines where id = %L', tests.id('lineB')), 0);
  begin
    execute format('insert into public.service_lines (org_id, agreement_version_id, description, visit_months, visits_per_year, cost_per_visit_cents) '
      || 'values (%L, %L, ''x'', ''{1}'', 1, 0)', tests.id('orgB'), tests.id('ver2B'));
    raise exception 'C742 insert: statement succeeded';
  exception when others then
    if sqlstate not in ('42501', '23503') then
      raise exception 'C742 insert: expected 42501 or 23503, got % (%)', sqlstate, sqlerrm;
    end if;
  end;
  perform tests.expect_error('C742 revise', format('select public.apply_agreement_transition(%L, ''changes_requested'', ''draft'', '
    || '''agreement.revised'', ''{}'')', tests.id('agrB')), 'P0002');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C742 org B line kept', (select description = 'Quarterly PM' from public.service_lines where id = tests.id('lineB')),
    'org B''s line changed');
end $$;

-- C751: both RPCs are closed to anon and open to authenticated.
select tests.act_as_anon();
do $$ begin
  perform tests.expect_error('C751 anon revise', format('select public.apply_agreement_transition(%L, ''changes_requested'', ''draft'', '
    || '''agreement.revised'', ''{}'')', tests.id('agrA')), '42501');
  perform tests.expect_error('C751 anon create', format('select public.create_agreement(%L)', tests.id('siteA')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare f oid := 'public.create_agreement(uuid)'::regprocedure;
begin
  perform tests.ok('C751 authenticated create', has_function_privilege('authenticated', 'public.create_agreement(uuid)', 'execute'),
    'authenticated cannot execute create_agreement');
  perform tests.ok('C751 authenticated revise',
    has_function_privilege('authenticated', 'public.apply_agreement_transition(uuid, text, text, text, jsonb)', 'execute'),
    'authenticated cannot execute apply_agreement_transition');
  perform tests.ok('C751 invoker', not (select prosecdef from pg_proc where oid = f), 'create_agreement is security definer');
  perform tests.ok('C751 search_path', (select proconfig @> array['search_path=""'] from pg_proc where oid = f), 'search_path is not empty');
end $$;

-- term-dates C1136-C1140, C1144: the term on a version (doors 1, 3 and 6).
-- C1136: version 1 takes the org's default term months; an org with no settings row gets 12.
update public.org_settings set default_term_months = 24 where org_id = tests.id('orgA');
insert into public.orgs (id, name) values (tests.id('orgC'), 'No settings (test)');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgC'), tests.id('uE'), 'estimator');
insert into public.customers (id, org_id, name) values (tests.id('custC'), tests.id('orgC'), 'Customer C');
insert into public.sites (id, org_id, customer_id, name) values (tests.id('siteC1136'), tests.id('orgC'), tests.id('custC'), 'Site C');
select tests.ab_site('s1136');
create table tests.t1136 (a uuid, c uuid);
grant all on tests.t1136 to authenticated;
select tests.act_as('uE');
insert into tests.t1136 select public.create_agreement(tests.id('s1136')), public.create_agreement(tests.id('siteC1136'));
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1136 default term', (select v.term_months = 24 and v.term_start is null from public.agreement_versions v
    where v.agreement_id = (select a from tests.t1136) and v.version_no = 1), 'version 1 did not take the org default of 24');
  perform tests.ok('C1136 no settings row', (select v.term_months = 12 and v.term_start is null from public.agreement_versions v
    where v.agreement_id = (select c from tests.t1136) and v.version_no = 1), 'version 1 without a settings row is not 12 months');
end $$;
update public.org_settings set default_term_months = 12 where org_id = tests.id('orgA');

-- C1137: term_end is start + months - 1 day, null without a start, and cannot be written.
select tests.ab_agr('a1137', 'draft');
create table tests.t1137 (s date, e date);
grant all on tests.t1137 to authenticated;
select tests.act_as('uE');
do $$
declare
  c record;
begin
  for c in select * from (values ('2027-01-01'::date, 12::smallint, '2027-12-31'::date), ('2027-03-15', 6, '2027-09-14'),
                                 ('2027-01-31', 1, '2027-02-27'), ('2028-02-29', 12, '2029-02-27')) as x(s, m, e) loop
    perform public.save_agreement_term(tests.id('a1137'), c.s, c.m::smallint);
    insert into tests.t1137 select c.e, v.term_end from public.agreement_versions v where v.id = tests.id('a1137:v1');
  end loop;
  perform public.save_agreement_term(tests.id('a1137'), null, 12::smallint);
  insert into tests.t1137 select null, v.term_end from public.agreement_versions v where v.id = tests.id('a1137:v1');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1137 ends', (select count(*) = 4 from tests.t1137 where s is not null and e = s),
    'a term did not end on start + months - 1 day');
  perform tests.ok('C1137 null start', (select count(*) = 1 from tests.t1137 where s is null and e is null),
    'term_end is not null without a start');
  perform tests.expect_error('C1137 generated', format('update public.agreement_versions set term_end = ''2030-01-01'' where id = %L',
    tests.id('a1137:v1')), '428C9');
end $$;

-- C1138: the term writer stores the term on the highest version of a draft only and returns its id.
select tests.ab_agr('a1138', 'draft');
select tests.ab_version('a1138', 2);
create table tests.t1138 (id uuid);
grant all on tests.t1138 to authenticated;
select tests.act_as('uE');
insert into tests.t1138 select public.save_agreement_term(tests.id('a1138'), '2027-01-01', 18::smallint);
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1138 returns v2', (select id from tests.t1138) = tests.id('a1138:v2'), 'did not return the highest version id');
  perform tests.ok('C1138 v2 stored', (select term_start = '2027-01-01' and term_months = 18 from public.agreement_versions
    where id = tests.id('a1138:v2')), 'version 2 does not hold the term');
  perform tests.ok('C1138 v1 kept', (select term_start is null and term_months = 12 from public.agreement_versions
    where id = tests.id('a1138:v1')), 'version 1 changed');
end $$;

-- C1139: the term writer's refusals change nothing.
select tests.ab_agr('a1139sent', 'sent');
select tests.ab_agr('a1139', 'draft');
select tests.ab_agr('a1139b', 'draft', null, 'B');
update public.agreement_versions set term_start = '2026-06-01', term_months = 6
where id in (tests.id('a1139sent:v1'), tests.id('a1139:v1'), tests.id('a1139b:v1'));
create table tests.t1139 as select id, term_start, term_months, snapshot from public.agreement_versions
where id in (tests.id('a1139sent:v1'), tests.id('a1139:v1'), tests.id('a1139b:v1'));
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1139 sent', format('select public.save_agreement_term(%L, ''2027-01-01'', 12::smallint)',
    tests.id('a1139sent')), '55000');
  perform tests.expect_error('C1139 unknown', format('select public.save_agreement_term(%L, ''2027-01-01'', 12::smallint)',
    tests.id('a1139nothing')), 'P0002');
  perform tests.expect_error('C1139 other org', format('select public.save_agreement_term(%L, ''2027-01-01'', 12::smallint)',
    tests.id('a1139b')), 'P0002');
  perform tests.expect_error('C1139 months 0', format('select public.save_agreement_term(%L, ''2027-01-01'', 0::smallint)',
    tests.id('a1139')), '23514');
  perform tests.expect_error('C1139 months 61', format('select public.save_agreement_term(%L, ''2027-01-01'', 61::smallint)',
    tests.id('a1139')), '23514');
  perform tests.expect_error('C1139 start 1999', format('select public.save_agreement_term(%L, ''1999-12-31'', 12::smallint)',
    tests.id('a1139')), '23514');
  perform tests.expect_error('C1139 start 2100', format('select public.save_agreement_term(%L, ''2100-01-01'', 12::smallint)',
    tests.id('a1139')), '23514');
end $$;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C1139 viewer', format('select public.save_agreement_term(%L, ''2027-01-01'', 12::smallint)',
    tests.id('a1139')), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1139 unchanged', (select count(*) = 3 from tests.t1139 t join public.agreement_versions v on v.id = t.id
    where v.term_start is not distinct from t.term_start and v.term_months = t.term_months and v.snapshot = t.snapshot),
    'a refused term write changed a version');
end $$;

-- C1140: members still cannot update agreement_versions, not even one column.
do $$ begin
  perform tests.ok('C1140 table', not has_table_privilege('authenticated', 'public.agreement_versions', 'UPDATE'),
    'authenticated can update agreement_versions');
  perform tests.ok('C1140 columns', not exists (select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'agreement_versions'
      and has_column_privilege('authenticated', 'public.agreement_versions', c.column_name, 'UPDATE')),
    'authenticated can update a column of agreement_versions');
end $$;

-- C1144: a revision carries version n's term, and version n keeps it.
select tests.ab_agr('a1144', 'changes_requested');
update public.agreement_versions set term_start = '2027-01-01', term_months = 24 where id = tests.id('a1144:v1');
select tests.act_as('uE');
select public.apply_agreement_transition(tests.id('a1144'), 'changes_requested', 'draft', 'agreement.revised', '{}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1144 copied', (select term_start = '2027-01-01' and term_months = 24 from public.agreement_versions
    where agreement_id = tests.id('a1144') and version_no = 2), 'version 2 did not carry the term');
  perform tests.ok('C1144 kept', (select term_start = '2027-01-01' and term_months = 24 from public.agreement_versions
    where id = tests.id('a1144:v1')), 'version 1 changed');
end $$;

-- Renewal (.specs/features/renewal/checks.md): C1172-C1189. Each check makes its own agreements with
-- tests.rn_agreement; every due agreement is renewed by the end of its check, so a later run returns only its own.
create table tests.rn_ids (label text, id uuid);
create function tests.rn_run(p_label text, p_date date) returns setof uuid
language sql as $$
  insert into tests.rn_ids select p_label, id from private.run_renewals(p_date) as id returning id
$$;
create function tests.rn_ret(p_label text) returns uuid[]
language sql as $$ select coalesce(array_agg(id order by id), '{}') from tests.rn_ids where label = p_label $$;
create function tests.rn_event(p_agreement uuid) returns public.events
language sql as $$ select * from public.events where entity_id = p_agreement order by created_at, id limit 1 $$;
create function tests.rn_costs(p_agreement uuid) returns bigint[]
language sql as $$
  select array_agg(l.cost_per_visit_cents order by l.position) from public.service_lines l
  join public.agreement_versions v on v.id = l.agreement_version_id where v.agreement_id = p_agreement
$$;

-- C1172-C1176: CPI 3.20 as of 2027-10-15, frozen cap 5 and threshold 5: an accepted renewal R.
select tests.rn_cpi(3.20, '2027-10-15');
select tests.rn_agreement('r1172');
create table tests.rn_expected as
select 'AG-' || (max(substring(number from '^AG-([0-9]+)$')::integer) + 1) as number
from public.agreements where org_id = tests.id('orgA');
select tests.rn_run('C1172', '2027-12-01');
do $$
declare
  r public.agreements := tests.rn_of(tests.id('r1172'));
  a public.agreements := (select x from public.agreements x where x.id = tests.id('r1172'));
  v public.agreement_versions;
  e public.events;
begin
  perform tests.ok('C1172 returns R', tests.rn_ret('C1172') = array[r.id], 'returned ' || tests.rn_ret('C1172')::text);
  perform tests.ok('C1172 R', r.status = 'accepted' and r.org_id = a.org_id and r.site_id = a.site_id
    and r.number = (select number from tests.rn_expected), 'R is ' || to_jsonb(r)::text);

  select * into v from public.agreement_versions where agreement_id = r.id;
  perform tests.ok('C1173 one version', (select count(*) from public.agreement_versions where agreement_id = r.id) = 1
    and v.version_no = 1, 'R has another version set');
  perform tests.ok('C1173 term', v.term_start = '2028-01-01' and v.term_months = 12 and v.term_end = '2028-12-31',
    'term ' || v.term_start || ' ' || v.term_months || ' ' || v.term_end);

  perform tests.ok('C1174 3.2 on 5', tests.rn_costs(r.id) = array[25800, 20639]::bigint[], 'costs ' || tests.rn_costs(r.id)::text);
  perform tests.ok('C1174 kept', (
    select array_agg(row(l.description, l.visit_months, l.visits_per_year, l.position)::text order by l.position)
    from public.service_lines l where l.agreement_version_id = v.id) = (
    select array_agg(row(l.description, l.visit_months, l.visits_per_year, l.position)::text order by l.position)
    from public.service_lines l where l.agreement_version_id = tests.id('r1172:v1')), 'a line field changed');
  perform tests.ok('C1174 coverage', (
    select array_agg(l.position || ':' || c.asset_type_id order by l.position, c.asset_type_id)
    from public.service_lines l join public.service_line_asset_types c on c.service_line_id = l.id
    where l.agreement_version_id = v.id) = (
    select array_agg(l.position || ':' || c.asset_type_id order by l.position, c.asset_type_id)
    from public.service_lines l join public.service_line_asset_types c on c.service_line_id = l.id
    where l.agreement_version_id = tests.id('r1172:v1')), 'coverage changed');

  perform tests.ok('C1175 snapshot', v.snapshot = (select snapshot from public.agreement_versions where id = tests.id('r1172:v1')),
    'snapshot differs');

  e := tests.rn_event(r.id);
  perform tests.ok('C1176 one event', (select count(*) from public.events where entity_id = r.id) = 1
    and e.type = 'agreement.renewed', 'events on R: ' || (select string_agg(type, ',') from public.events where entity_id = r.id));
  perform tests.ok('C1176 payload', e.payload = jsonb_build_object('renewsAgreementId', tests.id('r1172'), 'cpiPct', 3.2,
    'appliedPct', 3.2, 'cpiAsOf', '2027-10-15'), 'payload ' || e.payload::text);
  perform tests.ok('C1176 outbox', (select count(*) from public.outbox where event_id = e.id) = 1, 'not one outbox row');
end $$;

-- C1174: CPI 4.00 with cap 2.5, and CPI -1.00.
select tests.rn_cpi(4.00, '2027-10-15');
select tests.rn_agreement('r1174b', p_terms => '{"cpiCapPct": 2.5, "cpiRenegotiationThresholdPct": 5, "renewalNoticeDays": 30}');
select tests.rn_run('C1174b', '2027-12-01');
select tests.rn_cpi(-1.00, '2027-10-15');
select tests.rn_agreement('r1174c');
select tests.rn_run('C1174c', '2027-12-01');
do $$ begin
  perform tests.ok('C1174 4.0 on 2.5', tests.rn_costs((tests.rn_of(tests.id('r1174b'))).id) = array[25625, 20499]::bigint[],
    'costs ' || tests.rn_costs((tests.rn_of(tests.id('r1174b'))).id)::text);
  perform tests.ok('C1174 -1.0', tests.rn_costs((tests.rn_of(tests.id('r1174c'))).id) = array[25000, 19999]::bigint[],
    'costs ' || tests.rn_costs((tests.rn_of(tests.id('r1174c'))).id)::text);
end $$;

-- C1177: due on term_end - 30 days, not the day before.
select tests.rn_cpi(3.20, '2027-10-15');
select tests.rn_agreement('r1177');
select tests.rn_run('C1177a', '2027-11-30');
do $$ begin
  perform tests.ok('C1177 day before', tests.rn_ret('C1177a') = '{}' and (tests.rn_of(tests.id('r1177'))).id is null,
    'renewed on 2027-11-30');
end $$;
select tests.rn_run('C1177b', '2027-12-01');
do $$ begin
  perform tests.ok('C1177 notice day', tests.rn_ret('C1177b') = array[(tests.rn_of(tests.id('r1177'))).id], 'not renewed on 2027-12-01');
end $$;

-- C1178: never a second renewal; the link refuses a duplicate, itself and another org.
select tests.rn_run('C1178a', '2027-12-01');
select tests.rn_run('C1178b', '2027-12-02');
do $$ begin
  perform tests.ok('C1178 reruns', tests.rn_ret('C1178a') = '{}' and tests.rn_ret('C1178b') = '{}', 'a rerun created a renewal');
  perform tests.ok('C1178 one', (select count(*) from public.agreements where renews_agreement_id = tests.id('r1172')) = 1,
    'more than one renewal of A');
  perform tests.expect_error('C1178 duplicate', format(
    'insert into public.agreements (org_id, site_id, status, renews_agreement_id) values (%L, %L, ''withdrawn'', %L)',
    tests.id('orgA'), tests.id('r1172:site'), tests.id('r1172')), '23505');
  perform tests.expect_error('C1178 self', format(
    'insert into public.agreements (id, org_id, site_id, status, renews_agreement_id) values (%L, %L, %L, ''withdrawn'', %L)',
    tests.id('r1178self'), tests.id('orgA'), tests.id('r1172:site'), tests.id('r1178self')), '23514');
  perform tests.expect_error('C1178 other org', format(
    'insert into public.agreements (org_id, site_id, status, renews_agreement_id) values (%L, %L, ''withdrawn'', %L)',
    tests.id('orgB'), tests.id('siteB'), tests.id('agrA')), '23503');
end $$;

-- C1179: the run holds the renewals lock for the rest of its transaction.
do $$ begin
  perform tests.ok('C1179 lock', exists (
    select 1 from pg_locks l
    where l.locktype = 'advisory' and l.granted and l.pid = pg_backend_pid() and l.objsubid = 1
      and l.classid::bigint = ((hashtext('renewals')::bigint >> 32) & 4294967295)
      and l.objid::bigint = (hashtext('renewals')::bigint & 4294967295)), 'no granted renewals lock');
end $$;

-- C1180: the frozen terms decide, whatever Company settings say now.
select tests.rn_agreement('r1180');
update public.org_settings set cpi_cap_pct = 0, cpi_renegotiation_threshold_pct = 1, renewal_notice_days = 90
where org_id = tests.id('orgA');
select tests.rn_run('C1180a', '2027-11-30');
select tests.rn_run('C1180b', '2027-12-01');
do $$ begin
  perform tests.ok('C1180 notice', tests.rn_ret('C1180a') = '{}', 'renewed on 2027-11-30 with the org''s 90 days');
  perform tests.ok('C1180 auto', (tests.rn_of(tests.id('r1180'))).status = 'accepted'
    and (tests.rn_event((tests.rn_of(tests.id('r1180'))).id)).payload -> 'appliedPct' = '3.2'::jsonb, 'not auto at 3.2');
end $$;
update public.org_settings set cpi_cap_pct = 0, cpi_renegotiation_threshold_pct = 5, renewal_notice_days = 30
where org_id = tests.id('orgA');

-- C1181: no frozen notice or threshold falls back to the org's; no frozen cap is cpi_unset.
select tests.rn_agreement('r1181', p_terms => '{"cpiCapPct": 5}');
select tests.rn_run('C1181a', '2027-11-30');
select tests.rn_run('C1181b', '2027-12-01');
select tests.rn_agreement('r1181c', p_terms => '{"cpiCapPct": null, "cpiRenegotiationThresholdPct": 5, "renewalNoticeDays": 30}');
select tests.rn_run('C1181c', '2027-12-01');
do $$ begin
  perform tests.ok('C1181 fallback notice', tests.rn_ret('C1181a') = '{}', 'renewed on 2027-11-30');
  perform tests.ok('C1181 fallback auto', (tests.rn_of(tests.id('r1181'))).status = 'accepted', 'not auto on 2027-12-01');
  perform tests.ok('C1181 no cap', (tests.rn_of(tests.id('r1181c'))).status = 'draft'
    and (tests.rn_event((tests.rn_of(tests.id('r1181c'))).id)).payload ->> 'reason' = 'cpi_unset', 'not a cpi_unset draft');
end $$;

-- C1182: only an accepted agreement with a start date is renewed.
do $$
declare s text;
begin
  foreach s in array array['draft', 'sent', 'changes_requested', 'refused', 'expired', 'withdrawn'] loop
    perform tests.rn_agreement('r1182' || s);
    update public.agreements set status = s where id = tests.id('r1182' || s);
  end loop;
  perform tests.rn_agreement('r1182nostart', p_start => null);
end $$;
select tests.rn_run('C1182', '2028-06-01');
do $$
declare s text;
begin
  foreach s in array array['draft', 'sent', 'changes_requested', 'refused', 'expired', 'withdrawn', 'nostart'] loop
    perform tests.ok('C1182 ' || s, (tests.rn_of(tests.id('r1182' || s))).id is null, s || ' was renewed');
  end loop;
end $$;

-- C1183: no client can call the writer.
do $$ begin
  perform tests.ok('C1183 anon', not has_function_privilege('anon', 'private.run_renewals(date)', 'execute'), 'anon can execute');
  perform tests.ok('C1183 authenticated', not has_function_privilege('authenticated', 'private.run_renewals(date)', 'execute'),
    'authenticated can execute');
end $$;

-- C1184: CPI at the threshold drafts at the old prices; just below renews.
select tests.rn_cpi(5.00, '2027-10-15');
select tests.rn_agreement('r1184');
select tests.rn_run('C1184', '2027-12-01');
select tests.rn_cpi(4.99, '2027-10-15');
select tests.rn_agreement('r1184b');
select tests.rn_run('C1184b', '2027-12-01');
do $$
declare
  r public.agreements := tests.rn_of(tests.id('r1184'));
  e public.events := tests.rn_event(r.id);
begin
  perform tests.ok('C1184 draft', r.status = 'draft' and (select snapshot from public.agreement_versions where agreement_id = r.id) = '{}',
    'R is ' || r.status);
  perform tests.ok('C1184 prices', tests.rn_costs(r.id) = array[25000, 19999]::bigint[], 'costs ' || tests.rn_costs(r.id)::text);
  perform tests.ok('C1184 event', e.type = 'agreement.renewal_drafted'
    and (select count(*) from public.events where entity_id = r.id) = 1
    and e.payload = jsonb_build_object('renewsAgreementId', tests.id('r1184'), 'cpiPct', 5, 'cpiAsOf', '2027-10-15',
                                       'reason', 'at_threshold'), 'event ' || e.type || ' ' || e.payload::text);
  perform tests.ok('C1184 4.99', (tests.rn_of(tests.id('r1184b'))).status = 'accepted', '4.99 did not auto-renew');
end $$;

-- C1185: no CPI set.
select tests.rn_cpi(null, null);
select tests.rn_agreement('r1185');
select tests.rn_run('C1185', '2027-12-01');
do $$ begin
  perform tests.ok('C1185 unset', (tests.rn_of(tests.id('r1185'))).status = 'draft'
    and (tests.rn_event((tests.rn_of(tests.id('r1185'))).id)).payload ->> 'reason' = 'cpi_unset', 'not a cpi_unset draft');
end $$;

-- C1186: a CPI older than 13 months is stale.
select tests.rn_cpi(3.20, '2026-10-31');
select tests.rn_agreement('r1186');
select tests.rn_run('C1186', '2027-12-01');
select tests.rn_cpi(3.20, '2026-11-01');
select tests.rn_agreement('r1186b');
select tests.rn_run('C1186b', '2027-12-01');
do $$ begin
  perform tests.ok('C1186 stale', (tests.rn_of(tests.id('r1186'))).status = 'draft'
    and (tests.rn_event((tests.rn_of(tests.id('r1186'))).id)).payload ->> 'reason' = 'cpi_stale', 'not a cpi_stale draft');
  perform tests.ok('C1186 fresh', (tests.rn_of(tests.id('r1186b'))).status = 'accepted', '2026-11-01 did not auto-renew');
end $$;

-- C1188: a draft renewal carries the next term.
do $$
declare v public.agreement_versions := (select v from public.agreement_versions v
                                        where v.agreement_id = (tests.rn_of(tests.id('r1185'))).id);
begin
  perform tests.ok('C1188 term', v.term_start = '2028-01-01' and v.term_months = 12 and v.term_end = '2028-12-31',
    'term ' || v.term_start || ' ' || v.term_months || ' ' || v.term_end);
end $$;

-- C1189: a renewal draft is an ordinary draft for its estimator.
create table tests.rn_r1189 as select (tests.rn_of(tests.id('r1185'))).id as id;
grant select on tests.rn_r1189 to authenticated;
select tests.act_as('uE');
select public.save_service_line((select id from tests.rn_r1189), null, 'Added after renegotiation', '{6}'::smallint[], 15000,
                                array[tests.id('typeA')]);
select public.save_agreement_term((select id from tests.rn_r1189), '2028-02-01', 12::smallint);
select public.send_agreement((select id from tests.rn_r1189), md5('r1189') || md5('r1189:2'), 'agreement.sent',
                             '{"from": "draft", "to": "sent"}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  r uuid := (select id from tests.rn_r1189);
  v public.agreement_versions := (select v from public.agreement_versions v where v.agreement_id = r);
begin
  perform tests.ok('C1189 line', (select count(*) from public.service_lines where agreement_version_id = v.id) = 3, 'no added line');
  perform tests.ok('C1189 term', v.term_start = '2028-02-01', 'term not saved');
  perform tests.ok('C1189 sent', (select status from public.agreements where id = r) = 'sent' and v.snapshot ? 'takenAt',
    'not sent with a frozen snapshot');
end $$;

-- C1187: an open agreement on the site blocks that renewal only. Last, because A stays due.
select tests.rn_cpi(3.20, '2027-10-15');
select tests.rn_agreement('r1187');
select tests.rn_agreement('r1187b');
insert into public.agreements (id, org_id, site_id, status)
values (tests.id('r1187:d'), tests.id('orgA'), tests.id('r1187:site'), 'draft');
select tests.rn_run('C1187draft', '2027-12-01');
update public.agreements set status = 'sent' where id = tests.id('r1187:d');
select tests.rn_run('C1187sent', '2027-12-01');
update public.agreements set status = 'changes_requested' where id = tests.id('r1187:d');
select tests.rn_run('C1187changes', '2027-12-01');
do $$
declare s text;
begin
  perform tests.ok('C1187 other renewed', tests.rn_ret('C1187draft') = array[(tests.rn_of(tests.id('r1187b'))).id],
    'returned ' || tests.rn_ret('C1187draft')::text);
  foreach s in array array['draft', 'sent', 'changes'] loop
    perform tests.ok('C1187 ' || s, (s = 'draft' or tests.rn_ret('C1187' || s) = '{}')
      and (tests.rn_of(tests.id('r1187'))).id is null
      and not exists (select 1 from public.events where payload ->> 'renewsAgreementId' = tests.id('r1187')::text)
      and not exists (select 1 from public.notifications where agreement_id = tests.id('r1187')), 'A renewed with ' || s || ' open');
  end loop;
end $$;

-- versioning C1319: a revision carries the change request's reason and the revising member as its author.
reset role;
select set_config('request.jwt.claims', '', true);
select tests.ab_agr('a1319', 'changes_requested');
insert into public.events (org_id, entity_type, entity_id, type, payload)
values (tests.id('orgA'), 'agreement', tests.id('a1319'), 'agreement.changes_requested',
        '{"reason": "Too expensive", "versionNo": 1}');
select tests.act_as('uE');
select public.apply_agreement_transition(tests.id('a1319'), 'changes_requested', 'draft', 'agreement.revised', '{"versionNo": 2}');
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1319 version 2', (select created_by = tests.id('uE') and reason = 'Too expensive'
    from public.agreement_versions where agreement_id = tests.id('a1319') and version_no = 2),
    'version 2 has no author or reason');
  perform tests.ok('C1319 version 1', (select created_by is null and reason is null
    from public.agreement_versions where id = tests.id('a1319:v1')), 'version 1 was changed');
end $$;

-- versioning C1320: a new agreement's version 1 has its creator and no reason.
select tests.ab_site('s1320');
select tests.act_as('uE');
create temp table c1320 as select public.create_agreement(tests.id('s1320')) as id;
grant select on c1320 to authenticated;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1320 version 1', (select v.created_by = tests.id('uE') and v.reason is null
    from public.agreement_versions v join c1320 on c1320.id = v.agreement_id where v.version_no = 1),
    'version 1 has the wrong author or a reason');
end $$;

-- versioning C1321: no direct update of a version, and a direct insert cannot name another author.
select tests.ab_agr('a1321', 'draft');
select tests.act_as('uA');
do $$ begin
  perform tests.expect_error('C1321 update', format('update public.agreement_versions set reason = %L where id = %L',
    'x', tests.id('a1321:v1')), '42501');
end $$;
select tests.act_as('uE');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, created_by)
values (tests.id('a1321:v9'), tests.id('orgA'), tests.id('a1321'), 9, tests.id('uA'));
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1321 author', (select created_by = tests.id('uE') from public.agreement_versions
    where id = tests.id('a1321:v9')), 'a direct insert named another author');
end $$;

-- versioning C1324: the note of a draft's current version, with its 500-character bound.
select tests.ab_agr('a1324', 'draft');
select tests.act_as('uE');
select public.save_version_note(tests.id('a1324'), '  Added boiler  ');
do $$ begin
  perform tests.ok('C1324 stored', (select reason = 'Added boiler' from public.agreement_versions
    where id = tests.id('a1324:v1')), 'the note was not stored trimmed');
end $$;
select public.save_version_note(tests.id('a1324'), repeat('n', 500));
do $$ begin
  perform tests.ok('C1324 500', (select char_length(reason) = 500 from public.agreement_versions
    where id = tests.id('a1324:v1')), 'a 500-character note was not stored');
  perform tests.expect_error('C1324 501', format('select public.save_version_note(%L, repeat(%L, 501))',
    tests.id('a1324'), 'n'), '23514');
  perform tests.ok('C1324 unchanged', (select char_length(reason) = 500 from public.agreement_versions
    where id = tests.id('a1324:v1')), 'a refused note changed the stored one');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- versioning C1325: only a draft takes a note, and a viewer takes none.
select tests.ab_agr('a1325s', 'sent');
select tests.ab_agr('a1325d', 'draft');
select tests.act_as('uE');
do $$ begin
  perform tests.expect_error('C1325 sent', format('select public.save_version_note(%L, %L)', tests.id('a1325s'), 'x'), '55000');
end $$;
select tests.act_as('uV');
do $$ begin
  perform tests.expect_error('C1325 viewer', format('select public.save_version_note(%L, %L)', tests.id('a1325d'), 'x'), '42501');
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1325 unchanged', (select reason is null from public.agreement_versions
    where id = tests.id('a1325d:v1')), 'a refused note was stored');
end $$;

-- versioning C1324, C1325: the refusals carry their hints.
select tests.act_as('uE');
do $$
declare h text;
begin
  begin
    perform public.save_version_note(tests.id('a1324'), repeat('n', 501));
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
  end;
  perform tests.ok('C1324 hint', h = 'note_too_long', 'the 501-character refusal hint was ' || coalesce(h, 'null'));
  h := null;
  begin
    perform public.save_version_note(tests.id('a1325s'), 'x');
  exception when others then
    get stacked diagnostics h = pg_exception_hint;
  end;
  perform tests.ok('C1325 hint', h = 'not_editable', 'the not-a-draft refusal hint was ' || coalesce(h, 'null'));
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- versioning C1345 (door 4): a signed-in insert is stamped with the caller, and a setup insert with no user keeps its value.
select tests.ab_agr('a1345', 'draft');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, created_by)
values (tests.id('a1345:v7'), tests.id('orgA'), tests.id('a1345'), 7, tests.id('uA'));
select tests.act_as('uE');
insert into public.agreement_versions (id, org_id, agreement_id, version_no, created_by)
values (tests.id('a1345:v8'), tests.id('orgA'), tests.id('a1345'), 8, tests.id('uA'));
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform tests.ok('C1345 no user', (select created_by = tests.id('uA') from public.agreement_versions
    where id = tests.id('a1345:v7')), 'an insert with no signed-in user lost its created_by');
  perform tests.ok('C1345 spoof', (select created_by = tests.id('uE') from public.agreement_versions
    where id = tests.id('a1345:v8')), 'a signed-in insert named another author');
end $$;

-- versioning C1327: the backfill (the migration's statement, run over rows built as they were before it).
select tests.ab_agr('a1327', 'draft');
select tests.ab_version('a1327', 2);
select tests.ab_agr('a1327n', 'sent');
insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
values (tests.id('orgA'), 'agreement', tests.id('a1327'), 'agreement.changes_requested',
        '{"reason": "Old request", "versionNo": 7}', null),
       (tests.id('orgA'), 'agreement', tests.id('a1327'), 'agreement.changes_requested',
        '{"reason": "Add a boiler", "versionNo": 1}', null),
       (tests.id('orgA'), 'agreement', tests.id('a1327'), 'agreement.revised', '{"versionNo": 2}', tests.id('uE'));
update public.agreement_versions v
set created_by = r.actor_id,
    reason = (
      select c.payload ->> 'reason'
      from public.events c
      where c.entity_type = 'agreement' and c.entity_id = v.agreement_id and c.type = 'agreement.changes_requested'
        and c.created_at <= r.created_at
      order by (c.payload ->> 'versionNo' = (v.version_no - 1)::text) desc, c.created_at desc
      limit 1
    )
from public.events r
where r.entity_type = 'agreement' and r.entity_id = v.agreement_id and r.type = 'agreement.revised'
  and r.payload ->> 'versionNo' = v.version_no::text;
do $$ begin
  perform tests.ok('C1327 revision', (select created_by = tests.id('uE') and reason = 'Add a boiler'
    from public.agreement_versions where id = tests.id('a1327:v2')), 'the revision was not backfilled');
  perform tests.ok('C1327 version 1', (select created_by is null and reason is null
    from public.agreement_versions where id = tests.id('a1327:v1')), 'version 1 was backfilled');
  perform tests.ok('C1327 no events', (select created_by is null and reason is null
    from public.agreement_versions where id = tests.id('a1327n:v1')), 'a version with no events was backfilled');
end $$;

rollback;
select 'agreement_builder: pass' as result;
