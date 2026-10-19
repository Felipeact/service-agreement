-- S2 roles: C8-C15. Run after fixture.sql in the same execute_sql call.

-- C8 (as table owner: only the check constraint decides)
do $$ begin
  perform tests.expect_error('C8 contractor',
    format('insert into public.memberships (org_id, user_id, role) values (%L, %L, ''contractor'')', tests.id('orgB'), tests.id('uX')), '23514');
  insert into public.memberships (org_id, user_id, role) values
    (tests.id('orgB'), tests.id('uA'), 'owner'),
    (tests.id('orgB'), tests.id('uV'), 'admin'),
    (tests.id('orgB'), tests.id('uE'), 'estimator'),
    (tests.id('orgB'), tests.id('uX'), 'viewer');
end $$;

-- C9
do $$ begin
  perform tests.expect_error('C9',
    format('insert into public.memberships (org_id, user_id, role) values (%L, %L, ''admin'')', tests.id('orgA'), tests.id('uV')), '23505');
end $$;

select tests.act_as('uV');

-- C10
do $$
declare t text;
begin
  foreach t in array array_remove(tests.tenant_tables(), 'outbox') loop
    perform tests.ok('C10 ' || t,
      tests.count(format('select count(*) from public.%I where org_id = %L', t, tests.id('orgA'))) >= 1,
      'viewer cannot read org A rows');
  end loop;
end $$;

-- C11
do $$
declare t text;
begin
  foreach t in array array_remove(tests.tenant_tables(), 'outbox') loop
    perform tests.expect_error('C11 ' || t, tests.insert_sql(t, 'A'), '42501');
  end loop;
end $$;

-- C12
do $$
declare
  t text;
  a uuid := tests.id('orgA');
begin
  foreach t in array array_remove(array_remove(tests.tenant_tables(), 'outbox'), 'events') loop
    perform tests.expect_rows('C12 update ' || t,
      format('update public.%I set org_id = org_id where org_id = %L', t, a), 0);
    perform tests.expect_rows('C12 delete ' || t,
      format('delete from public.%I where org_id = %L', t, a), 0);
  end loop;
end $$;

reset role;
select tests.act_as('uE');

-- C13
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','sites','assets','agreements','agreement_versions','service_lines'] loop
    perform tests.expect_rows('C13 ' || t, tests.insert_sql(t, 'A'), 1);
  end loop;
end $$;

-- C14
do $$
declare a uuid := tests.id('orgA');
begin
  perform tests.expect_rows('C14 org_settings update',
    format('update public.org_settings set tax_note = ''x'' where org_id = %L', a), 0);
  perform tests.expect_error('C14 memberships insert', tests.insert_sql('memberships', 'A'), '42501');
  perform tests.expect_rows('C14 memberships update',
    format('update public.memberships set role = ''owner'' where org_id = %L', a), 0);
  perform tests.expect_rows('C14 memberships delete',
    format('delete from public.memberships where org_id = %L', a), 0);
end $$;

reset role;
select tests.act_as('uA');

-- C15
do $$ begin
  perform tests.expect_rows('C15 org_settings update',
    format('update public.org_settings set tax_note = ''GST 5%%'' where org_id = %L', tests.id('orgA')), 1);
  perform tests.expect_rows('C15 memberships insert', tests.insert_sql('memberships', 'A'), 1);
end $$;

reset role;
rollback;
select 'rls_roles: pass' as result;
