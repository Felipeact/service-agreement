-- staff-screens: C101 (isolation of the reader shapes) and C120 (the demo agreements).
-- Run as one execute_sql call: fixture.sql, then this file with the line SEED_BODY below replaced by the body of
-- supabase/seed.sql (the file without its `begin;` and `commit;` lines). The starting state is the fixture's:
-- no demo org, so the first run really inserts. Ends in rollback and returns `staff_screens: pass`.

create function tests.demo() returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-00000000de30'::uuid $$;

create function tests.run_seed() returns void
language plpgsql as $fn$
begin
  execute $seed$
SEED_BODY
  $seed$;
end $fn$;

-- Stage of an agreement, as web/domain/pipeline pipelineStage decides it.
create function tests.stage(p_status text, p_contract text) returns text
language sql immutable as $$
  select case p_status
    when 'draft' then 'in_progress'
    when 'changes_requested' then 'in_progress'
    when 'sent' then 'sent'
    when 'refused' then 'refused'
    when 'expired' then 'refused'
    when 'withdrawn' then null
    when 'accepted' then case p_contract
      when 'completed' then 'completed'
      when 'declined' then 'refused'
      when 'voided' then null
      else 'accepted' end
  end
$$;

create function tests.stage_count(p_stage text) returns bigint
language sql as $$
  select count(*) from public.agreements a
  left join public.agreement_versions v on v.agreement_id = a.id and v.version_no = 1
  left join public.contracts c on c.agreement_version_id = v.id
  where a.org_id = tests.demo() and tests.stage(a.status, c.status) = p_stage
$$;

-- C120: first run, from the fixture state.
do $$ begin
  perform tests.ok('C120 start', (select count(*) from public.orgs where id = tests.demo()) = 0, 'the demo org already exists');
end $$;
select tests.run_seed();
do $$ begin
  perform tests.ok('C120 agreements', (select count(*) from public.agreements where org_id = tests.demo()) = 12, 'expected 12 agreements');
  perform tests.ok('C120 numbers',
    (select array_agg(number order by number) from public.agreements where org_id = tests.demo())
    = array['AG-1019','AG-1022','AG-1027','AG-1029','AG-1031','AG-1035','AG-1039','AG-1042','AG-1044','AG-1046','AG-1048','AG-1051'],
    'agreement numbers differ');
  perform tests.ok('C120 versions',
    (select count(*) from public.agreement_versions where org_id = tests.demo() and version_no = 1) = 12
    and (select count(*) from public.agreement_versions where org_id = tests.demo()) = 12,
    'expected one version 1 per agreement');
  perform tests.ok('C120 lines',
    (select count(*) from public.service_lines where org_id = tests.demo()) = 9
    and not exists (select 1 from public.service_lines l join public.agreement_versions v on v.id = l.agreement_version_id
                    join public.agreements a on a.id = v.agreement_id
                    where a.number in ('AG-1051', 'AG-1027', 'AG-1029')),
    'expected 9 lines, none on AG-1051, AG-1027, AG-1029');
  perform tests.ok('C120 contracts',
    (select count(*) from public.contracts where org_id = tests.demo()) = 3
    and (select count(*) from public.contracts c join public.agreement_versions v on v.id = c.agreement_version_id
         join public.agreements a on a.id = v.agreement_id
         where (a.number, c.status) in (('AG-1031', 'client_signed'), ('AG-1022', 'completed'), ('AG-1019', 'completed'))) = 3,
    'expected client_signed on AG-1031 and completed on AG-1022 and AG-1019');
  perform tests.ok('C120 stages',
    (tests.stage_count('in_progress'), tests.stage_count('sent'), tests.stage_count('accepted'),
     tests.stage_count('completed'), tests.stage_count('refused')) = (3, 3, 2, 2, 2),
    'stage counts differ from 3, 3, 2, 2, 2');
end $$;

-- C120: second run changes nothing.
create temporary table before_counts on commit drop as
select (select count(*) from public.agreements where org_id = tests.demo()) as agreements,
       (select count(*) from public.agreement_versions where org_id = tests.demo()) as versions,
       (select count(*) from public.service_lines where org_id = tests.demo()) as lines,
       (select count(*) from public.contracts where org_id = tests.demo()) as contracts;
select tests.run_seed();
do $$ begin
  perform tests.ok('C120 rerun',
    (select (agreements, versions, lines, contracts) from before_counts)
    = ((select count(*) from public.agreements where org_id = tests.demo()),
       (select count(*) from public.agreement_versions where org_id = tests.demo()),
       (select count(*) from public.service_lines where org_id = tests.demo()),
       (select count(*) from public.contracts where org_id = tests.demo())),
    'the second run changed a count');
end $$;

-- C101: a member of another org reads none of the demo data through the shapes the readers use;
-- a member of the demo org reads it (positive control).
insert into public.orgs (id, name) values (tests.id('orgB'), 'Other contractor');
insert into auth.users (id, email, aud, role) values
  (tests.id('userB'), 'b@example.test', 'authenticated', 'authenticated'),
  (tests.id('userDemo'), 'demo@example.test', 'authenticated', 'authenticated');
insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgB'), tests.id('userB'), 'owner'),
  (tests.demo(), tests.id('userDemo'), 'owner');

create function tests.shape_rows() returns bigint[]
language sql stable as $$
  select array[
    (select count(*) from public.customers c left join public.contacts ct on ct.customer_id = c.id
       left join public.sites s on s.customer_id = c.id left join public.assets a on a.site_id = s.id
       left join public.asset_types t on t.id = a.asset_type_id where c.org_id = tests.demo()),
    (select count(*) from public.agreements g join public.agreement_versions v on v.agreement_id = g.id
       left join public.service_lines l on l.agreement_version_id = v.id
       left join public.contracts k on k.agreement_version_id = v.id where g.org_id = tests.demo()),
    (select count(*) from public.org_settings where org_id = tests.demo())
  ]
$$;

select tests.act_as('userB');
do $$ begin
  perform tests.ok('C101 other org', tests.shape_rows() = array[0, 0, 0]::bigint[],
    'a member of another org read demo rows: ' || tests.shape_rows()::text);
end $$;
reset role;

select tests.act_as('userDemo');
do $$ begin
  perform tests.ok('C101 same org', (tests.shape_rows())[1] > 0 and (tests.shape_rows())[2] > 0 and (tests.shape_rows())[3] = 1,
    'a member of the demo org read nothing: ' || tests.shape_rows()::text);
end $$;
reset role;

rollback;
select 'staff_screens: pass' as result;
