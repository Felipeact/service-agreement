-- auth-magic-link S6: C23, then C22. Run as one execute_sql call: fixture.sql, then this file with the line
-- SEED_BODY below replaced by the body of supabase/seed.sql (the file without its `begin;` and `commit;` lines).
-- Ends in rollback and returns `demo_owner: pass`.

create function tests.demo() returns uuid
language sql immutable as $$ select '00000000-0000-4000-8000-00000000de30'::uuid $$;

-- One run of the seed, as an operator would run it, inside this transaction.
create function tests.run_seed() returns void
language plpgsql as $fn$
begin
  execute $seed$
SEED_BODY
  $seed$;
end $fn$;

-- C23: app.demo_owner_email is never set, so the seed attaches nobody.
select tests.run_seed();
do $$ begin
  perform tests.ok('C23', (select count(*) from public.memberships where org_id = tests.demo()) = 0,
    'a membership was inserted without app.demo_owner_email');
end $$;

-- C22: the setting names an existing user, in another case than stored; two runs attach them once, as owner.
insert into auth.users (id, email, aud, role)
values (tests.id('demoOwner'), 'owner@example.test', 'authenticated', 'authenticated');
select set_config('app.demo_owner_email', 'Owner@Example.TEST', true);
select tests.run_seed();
select tests.run_seed();
do $$ begin
  perform tests.ok('C22 count', (select count(*) from public.memberships where org_id = tests.demo()) = 1,
    'expected exactly one demo membership after two runs');
  perform tests.ok('C22 owner',
    exists (select 1 from public.memberships
            where org_id = tests.demo() and user_id = tests.id('demoOwner') and role = 'owner'),
    'the demo membership is not the invited user as owner');
end $$;

rollback;
select 'demo_owner: pass' as result;
