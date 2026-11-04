-- members-page, database side: C1497, C1498, C1507-C1513, C1520-C1526, C1531-C1540 (.specs/features/members-page/checks.md).
-- Run after fixture.sql in the same execute_sql call (npm run test:db members). Fixture: org A owner uA, estimator uE,
-- viewer uV; org B owner uB; uX in no org. Setup runs as the table owner with no signed-in user.

reset role;
select set_config('request.jwt.claims', '', true);

-- The SQLSTATE and hint a statement ends with, as 'state:hint' ('ok' when it succeeds), run as the current role.
create function tests.m_state(p_sql text) returns text
language plpgsql as $$
declare
  v_state text;
  v_hint text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_hint = pg_exception_hint;
  return v_state || ':' || coalesce(v_hint, '');
end $$;

-- tests.expect_error compares the SQLSTATE only (L-025, L-030); this compares the hint as well.
create function tests.m_expect(p_label text, p_sql text, p_expected text) returns void
language plpgsql as $$
declare
  v_got text := tests.m_state(p_sql);
begin
  if v_got <> p_expected then
    raise exception '%: expected %, got % for %', p_label, p_expected, v_got, p_sql;
  end if;
end $$;

-- list_members and list_invitations as 'email:role' joined by commas, in the order the function returns them.
create function tests.m_roster() returns text
language sql as $$
  select coalesce(string_agg(t.email || ':' || t.role, ',' order by t.ord), '')
  from public.list_members() with ordinality as t(user_id, email, role, joined_at, ord)
$$;

create function tests.m_invites() returns text
language sql as $$
  select coalesce(string_agg(t.email || ':' || t.role, ',' order by t.ord), '')
  from public.list_invitations() with ordinality as t(id, email, role, created_at, expires_at, ord)
$$;

-- A count past RLS, so a test can compare what a member sees with what exists.
create function tests.m_members_in(p_org uuid) returns bigint
language sql security definer as $$ select count(*) from public.memberships where org_id = p_org $$;

grant execute on function tests.m_state(text), tests.m_expect(text, text, text), tests.m_roster(), tests.m_invites(),
  tests.m_members_in(uuid) to anon, authenticated;

-- Users: uAd admin and bviewer viewer in org A; the rest are set up where they are used.
insert into auth.users (id, email, aud, role)
select tests.id(u), u || '@members.test', 'authenticated', 'authenticated'
from unnest(array['uAd', 'bviewer', 'mo1', 'mo2', 'ma1', 'ma2', 'me', 'mv', 'mv2', 'mn', 'so1', 'sa1',
                  'nw1', 'nw2', 'nw3', 'nw4', 'nw5']) as u;
insert into auth.users (id, email, aud, role) values (tests.id('nwcase'), 'Nw.Case@Members.Test', 'authenticated', 'authenticated');

insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgA'), tests.id('uAd'), 'admin'),
  (tests.id('orgA'), tests.id('bviewer'), 'viewer');

-- C1497: the roster, as each role, then a user in no org, then the other org.
select tests.act_as('uA');
select tests.ok('C1497 owner', tests.m_roster() =
  'uA@example.test:owner,uAd@members.test:admin,uE@example.test:estimator,bviewer@members.test:viewer,uV@example.test:viewer',
  tests.m_roster());
select tests.ok('C1497 row', (select user_id from public.list_members() where email = 'uA@example.test') = tests.id('uA')
  and (select joined_at from public.list_members() where email = 'uA@example.test') is not null, 'user_id or joined_at wrong');
select tests.act_as('uAd');
select tests.ok('C1497 admin order', tests.m_roster() =
  'uA@example.test:owner,uAd@members.test:admin,uE@example.test:estimator,bviewer@members.test:viewer,uV@example.test:viewer',
  tests.m_roster());
select tests.ok('C1497 admin sees five', (select count(*) from public.list_members()) = 5, 'admin does not see the five members of org A');
select tests.act_as('uE');
select tests.ok('C1497 estimator sees five', (select count(*) from public.list_members()) = 5, 'estimator does not see the five members');
select tests.act_as('uV');
select tests.ok('C1497 viewer sees five', (select count(*) from public.list_members()) = 5, 'viewer does not see the five members');
select tests.ok('C1497 viewer order', tests.m_roster() =
  'uA@example.test:owner,uAd@members.test:admin,uE@example.test:estimator,bviewer@members.test:viewer,uV@example.test:viewer',
  tests.m_roster());
select tests.act_as('uX');
select tests.ok('C1497 no org', (select count(*) from public.list_members()) = 0, 'a user in no org sees members');
select tests.act_as('uB');
select tests.ok('C1497 other org', tests.m_roster() = 'uB@example.test:owner', tests.m_roster());

-- C1498: invitations. Setup as the table owner: one expired, one live, an accepted one and one of org B.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.invitations (id, org_id, email, role, created_at, expires_at) values
  (tests.id('inv:old'), tests.id('orgA'), 'old@x.test', 'viewer', now() - interval '3 days', now() - interval '1 day'),
  (tests.id('inv:new'), tests.id('orgA'), 'new@x.test', 'estimator', now() - interval '1 hour', now() + interval '10 days'),
  (tests.id('inv:b'), tests.id('orgB'), 'b@x.test', 'viewer', now(), now() + interval '10 days');
insert into public.invitations (id, org_id, email, role, created_at, expires_at, accepted_at, accepted_by) values
  (tests.id('inv:done'), tests.id('orgA'), 'done@x.test', 'viewer', now() - interval '5 days', now() + interval '1 day',
   now() - interval '4 days', tests.id('uV'));

select tests.act_as('uA');
select tests.ok('C1498 owner', tests.m_invites() = 'new@x.test:estimator,old@x.test:viewer', tests.m_invites());
select tests.act_as('uAd');
select tests.ok('C1498 admin', tests.m_invites() = 'new@x.test:estimator,old@x.test:viewer', tests.m_invites());
select tests.act_as('uE');
select tests.m_expect('C1498 estimator', 'select * from public.list_invitations()', '42501:');
select tests.act_as('uV');
select tests.m_expect('C1498 viewer', 'select * from public.list_invitations()', '42501:');
select tests.act_as('uB');
select tests.ok('C1498 other org', tests.m_invites() = 'b@x.test:viewer', tests.m_invites());

-- C1507: create_invitation stores the lowercased address, the role, the author and 14 days.
select tests.act_as('uA');
do $$
declare
  v_id uuid;
  r public.invitations;
begin
  v_id := public.create_invitation('Pat@Example.com', 'estimator');
  select * into r from public.invitations where id = v_id;
  perform tests.ok('C1507 row', r.email = 'pat@example.com' and r.role = 'estimator' and r.invited_by = tests.id('uA')
    and r.accepted_at is null and r.expires_at = now() + interval '14 days' and r.org_id = tests.id('orgA'), row_to_json(r)::text);
  perform tests.ok('C1507 one', (select count(*) from public.invitations where email = 'pat@example.com') = 1, 'not exactly one row');
end $$;

-- C1508: a bad address raises 23514 / invalid_email and stores nothing.
do $$
declare
  v text;
begin
  foreach v in array array['', 'no-at-sign', 'a@b', repeat('a', 248) || '@b.test'] loop
    perform tests.m_expect('C1508 ' || left(v, 12) || ' ' || length(v), format('select public.create_invitation(%L, ''viewer'')', v), '23514:invalid_email');
  end loop;
  perform tests.ok('C1508 nothing stored', (select count(*) from public.invitations where email like 'a%@b.test' or email = '' or email = 'no-at-sign') = 0,
    'a bad address was stored');
end $$;

-- C1509: an address already in the org, in other case, is refused; one that belongs to another org only is stored.
do $$
begin
  perform tests.m_expect('C1509 member', 'select public.create_invitation(''UV@EXAMPLE.TEST'', ''viewer'')', '23505:already_member');
  perform tests.ok('C1509 not stored', (select count(*) from public.invitations where email = 'uv@example.test') = 0, 'a member was invited');
  perform public.create_invitation('ub@example.test', 'viewer');
  perform tests.ok('C1509 other org member is stored',
    (select count(*) from public.invitations where email = 'ub@example.test' and org_id = tests.id('orgA')) = 1, 'not stored');
end $$;

-- C1510: the same address again is one row, with the new role and 14 more days, and the same id.
reset role;
select set_config('request.jwt.claims', '', true);
update public.invitations set expires_at = now() - interval '1 day' where email = 'pat@example.com';
create table tests.m_pat as select id from public.invitations where email = 'pat@example.com';
grant select on tests.m_pat to authenticated;
select tests.act_as('uA');
do $$
declare
  v_id uuid;
  r public.invitations;
begin
  v_id := public.create_invitation('pat@example.com', 'admin');
  select * into r from public.invitations where id = v_id;
  perform tests.ok('C1510 same id', v_id = (select id from tests.m_pat), 'a second row was made');
  perform tests.ok('C1510 one row', (select count(*) from public.invitations where email = 'pat@example.com') = 1, 'not one row');
  perform tests.ok('C1510 refreshed', r.role = 'admin' and r.expires_at = now() + interval '14 days', row_to_json(r)::text);
end $$;

-- C1511: an admin cannot invite an owner; an owner can; an admin can invite the other three roles.
select tests.act_as('uAd');
do $$
declare
  v text;
begin
  perform tests.m_expect('C1511 admin invites owner', 'select public.create_invitation(''o1@x.test'', ''owner'')', '55000:owner_only');
  perform tests.ok('C1511 nothing stored', (select count(*) from public.invitations where email = 'o1@x.test') = 0, 'stored');
  foreach v in array array['admin', 'estimator', 'viewer'] loop
    perform tests.m_expect('C1511 admin invites ' || v, format('select public.create_invitation(%L, %L)', 'r-' || v || '@x.test', v), 'ok');
  end loop;
  perform tests.ok('C1511 three stored', (select count(*) from public.invitations where email like 'r-%@x.test') = 3, 'not three');
end $$;
select tests.act_as('uA');
select tests.m_expect('C1511 owner invites owner', 'select public.create_invitation(''o2@x.test'', ''owner'')', 'ok');

-- C1512: an estimator, a viewer and a user in no org are refused by every manager function; anon cannot execute any.
do $$
declare
  u text;
  s text;
begin
  foreach u in array array['uE', 'uV', 'uX'] loop
    perform tests.act_as(u);
    foreach s in array array[
      'select public.create_invitation(''z@x.test'', ''viewer'')',
      format('select public.revoke_invitation(%L)', tests.id('inv:new')),
      'select * from public.list_invitations()',
      format('select public.set_member_role(%L, ''viewer'')', tests.id('bviewer')),
      format('select public.remove_member(%L)', tests.id('bviewer'))] loop
      perform tests.m_expect('C1512 ' || u || ' ' || left(s, 40), s, '42501:');
    end loop;
  end loop;
  reset role;
  perform tests.ok('C1512 nothing changed', (select count(*) from public.invitations where email = 'z@x.test') = 0
    and tests.m_members_in(tests.id('orgA')) = 5, 'a refused call changed data');
end $$;
reset role;
do $$
declare
  f text;
begin
  foreach f in array array['public.list_members()', 'public.list_invitations()', 'public.create_invitation(text, text)',
                           'public.revoke_invitation(uuid)', 'public.set_member_role(uuid, text)', 'public.remove_member(uuid)',
                           'public.accept_invitations()'] loop
    perform tests.ok('C1512 anon ' || f, not has_function_privilege('anon', f, 'execute'), 'anon can execute ' || f);
    perform tests.ok('C1512 authenticated ' || f, has_function_privilege('authenticated', f, 'execute'), 'authenticated cannot execute ' || f);
  end loop;
  perform tests.ok('C1512 hook closed to authenticated', not has_function_privilege('authenticated', 'private.hook_before_user_created(jsonb)', 'execute'),
    'authenticated can execute the hook');
end $$;

-- C1513: revoke deletes that pending invitation only; another org's, an unknown id and an accepted one are P0002.
select tests.act_as('uA');
do $$
declare
  v_before bigint := (select count(*) from public.invitations);
begin
  perform public.revoke_invitation(tests.id('inv:new'));
  perform tests.ok('C1513 deleted', not exists (select 1 from public.invitations where id = tests.id('inv:new')), 'still there');
  perform tests.ok('C1513 only that one', (select count(*) from public.invitations) = v_before - 1, 'more than one row went');
  perform tests.m_expect('C1513 other org', format('select public.revoke_invitation(%L)', tests.id('inv:b')), 'P0002:');
  perform tests.m_expect('C1513 unknown', format('select public.revoke_invitation(%L)', tests.id('inv:nothing')), 'P0002:');
  perform tests.m_expect('C1513 accepted', format('select public.revoke_invitation(%L)', tests.id('inv:done')), 'P0002:');
end $$;
reset role;
select tests.ok('C1513 org B row kept', exists (select 1 from public.invitations where id = tests.id('inv:b')), 'org B invitation went');
select tests.ok('C1513 accepted row kept', exists (select 1 from public.invitations where id = tests.id('inv:done')), 'accepted invitation went');

-- C1520-C1524: accepting. Setup as the table owner.
select set_config('request.jwt.claims', '', true);
insert into public.invitations (id, org_id, email, role, created_at, expires_at) values
  (tests.id('acc:1'), tests.id('orgA'), 'nw1@members.test', 'estimator', now() - interval '1 day', now() + interval '5 days'),
  (tests.id('acc:case'), tests.id('orgA'), 'nw.case@members.test', 'admin', now() - interval '1 day', now() + interval '5 days'),
  (tests.id('acc:2a'), tests.id('orgA'), 'nw2@members.test', 'viewer', now() - interval '2 days', now() + interval '5 days'),
  (tests.id('acc:2b'), tests.id('orgB'), 'nw2@members.test', 'admin', now() - interval '1 day', now() + interval '5 days'),
  (tests.id('acc:3'), tests.id('orgA'), 'nw3@members.test', 'viewer', now() - interval '1 day', now() + interval '5 days'),
  (tests.id('acc:4'), tests.id('orgA'), 'nw4@members.test', 'viewer', now() - interval '3 days', now() - interval '1 day'),
  (tests.id('acc:5'), tests.id('orgA'), 'nw5@members.test', 'viewer', now() - interval '1 day', now() + interval '5 days');
insert into public.memberships (org_id, user_id, role) values (tests.id('orgB'), tests.id('nw3'), 'viewer');
delete from public.invitations where id = tests.id('acc:5');

-- C1520: the address matches ignoring case; one membership with the invited role; the invitation is marked.
select tests.act_as('nw1');
select tests.ok('C1520 returns 1', public.accept_invitations() = 1, 'did not return 1');
select tests.act_as('nwcase');
select tests.ok('C1520 case returns 1', public.accept_invitations() = 1, 'a different case did not match');
reset role;
select tests.ok('C1520 membership', (select role from public.memberships where org_id = tests.id('orgA') and user_id = tests.id('nw1')) = 'estimator',
  'no estimator membership');
select tests.ok('C1520 case membership', (select role from public.memberships where org_id = tests.id('orgA') and user_id = tests.id('nwcase')) = 'admin',
  'no admin membership');
select tests.ok('C1520 marked', (select accepted_by from public.invitations where id = tests.id('acc:1')) = tests.id('nw1')
  and (select accepted_at from public.invitations where id = tests.id('acc:1')) is not null, 'invitation not marked accepted');

-- C1521: two live invitations; only the earliest-created is accepted.
select tests.act_as('nw2');
select tests.ok('C1521 returns 1', public.accept_invitations() = 1, 'did not return 1');
reset role;
select tests.ok('C1521 earliest', (select count(*) from public.memberships where user_id = tests.id('nw2') and org_id = tests.id('orgA')) = 1
  and (select count(*) from public.memberships where user_id = tests.id('nw2')) = 1, 'not exactly the org A membership');
select tests.ok('C1521 other pending', (select accepted_at from public.invitations where id = tests.id('acc:2b')) is null, 'the later invitation was accepted');

-- C1522: a user who already has a membership accepts nothing.
select tests.act_as('nw3');
select tests.ok('C1522 returns 0', public.accept_invitations() = 0, 'did not return 0');
reset role;
select tests.ok('C1522 unchanged', (select count(*) from public.memberships where user_id = tests.id('nw3')) = 1
  and (select accepted_at from public.invitations where id = tests.id('acc:3')) is null, 'a membership was added or the invitation accepted');

-- C1523: an expired invitation, a revoked one and none at all give 0 and no membership.
do $$
declare
  u text;
begin
  foreach u in array array['nw4', 'nw5', 'uX'] loop
    perform tests.act_as(u);
    perform tests.ok('C1523 ' || u, public.accept_invitations() = 0, u || ' did not get 0');
    reset role;
    perform tests.ok('C1523 no membership ' || u, (select count(*) from public.memberships where user_id = tests.id(u)) = 0, u || ' got a membership');
  end loop;
end $$;

-- C1524: a second call finds nothing and leaves one membership.
select tests.act_as('nw1');
select tests.ok('C1524 second call', public.accept_invitations() = 0, 'a second call did not return 0');
reset role;
select tests.ok('C1524 one membership', (select count(*) from public.memberships where user_id = tests.id('nw1')) = 1, 'not exactly one membership');

-- C1525: the signup hook.
do $$
declare
  v jsonb;
  c record;
begin
  perform tests.ok('C1525 live, any case', private.hook_before_user_created('{"user": {"email": "PAT@Example.com"}}'::jsonb) = '{}'::jsonb, 'a live invitation was refused');
  for c in select * from (values ('none', 'nobody@x.test'), ('expired', 'old@x.test'), ('accepted', 'done@x.test'), ('empty', '')) as t(label, email) loop
    v := private.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', c.email)));
    perform tests.ok('C1525 ' || c.label, v -> 'error' ->> 'http_code' = '403' and v -> 'error' ->> 'message' = 'Sign-ups are by invitation.', v::text);
  end loop;
  perform tests.ok('C1525 no user object', private.hook_before_user_created('{}'::jsonb) -> 'error' ->> 'http_code' = '403', 'an event with no user was allowed');
end $$;

-- C1526: only supabase_auth_admin runs the hook and it reads the table through the function, not by a grant.
do $$ begin
  perform tests.ok('C1526 execute', has_function_privilege('supabase_auth_admin', 'private.hook_before_user_created(jsonb)', 'execute'), 'supabase_auth_admin cannot run the hook');
  perform tests.ok('C1526 usage', has_schema_privilege('supabase_auth_admin', 'private', 'usage'), 'no usage on private');
  perform tests.ok('C1526 no table grant', not has_table_privilege('supabase_auth_admin', 'public.invitations', 'select'), 'supabase_auth_admin can read invitations');
  perform tests.ok('C1526 anon closed', not has_function_privilege('anon', 'private.hook_before_user_created(jsonb)', 'execute'), 'anon can run the hook');
end $$;

-- C1531: the table's own constraints, as the table owner.
do $$
declare
  o uuid := tests.id('orgA');
begin
  perform tests.expect_error('C1531 role', format('insert into public.invitations (org_id, email, role, expires_at) values (%L, ''r1@x.test'', ''contractor'', now())', o), '23514');
  perform tests.expect_error('C1531 upper case', format('insert into public.invitations (org_id, email, role, expires_at) values (%L, ''R2@x.test'', ''viewer'', now())', o), '23514');
  perform tests.expect_error('C1531 length', format('insert into public.invitations (org_id, email, role, expires_at) values (%L, %L, ''viewer'', now())', o, repeat('a', 249) || '@b.test'), '23514');
  perform tests.expect_error('C1531 accepted_at alone', format('insert into public.invitations (org_id, email, role, expires_at, accepted_at) values (%L, ''r3@x.test'', ''viewer'', now(), now())', o), '23514');
  perform tests.expect_error('C1531 accepted_by alone', format('insert into public.invitations (org_id, email, role, expires_at, accepted_by) values (%L, ''r4@x.test'', ''viewer'', now(), %L)', o, tests.id('uV')), '23514');
  perform tests.expect_error('C1531 second live row', format('insert into public.invitations (org_id, email, role, expires_at) values (%L, ''pat@example.com'', ''viewer'', now())', o), '23505');
  perform tests.expect_error('C1531 unknown org', format('insert into public.invitations (org_id, email, role, expires_at) values (%L, ''r5@x.test'', ''viewer'', now())', tests.id('no-such-org')), '23503');
  insert into public.invitations (org_id, email, role, expires_at) values (o, 'done@x.test', 'viewer', now() + interval '1 day');
  perform tests.ok('C1531 accepted address invited again', (select count(*) from public.invitations where email = 'done@x.test' and org_id = o) = 2, 'not allowed');
  insert into public.orgs (id, name) values (tests.id('orgZ'), 'Zeta (test)');
  insert into public.invitations (org_id, email, role, expires_at) values (tests.id('orgZ'), 'z1@x.test', 'viewer', now());
  delete from public.orgs where id = tests.id('orgZ');
  perform tests.ok('C1531 cascade', (select count(*) from public.invitations where org_id = tests.id('orgZ')) = 0, 'invitations outlived the org');
end $$;

-- Org M for S4: owners mo1 and mo2, admins ma1 and ma2, estimator me, viewers mv and mv2. Org N: owner mn and a viewer.
insert into public.orgs (id, name) values (tests.id('orgM'), 'Meridian (test)'), (tests.id('orgN'), 'Nordic (test)'), (tests.id('orgS'), 'Solo (test)');
insert into public.memberships (org_id, user_id, role) values
  (tests.id('orgM'), tests.id('mo1'), 'owner'), (tests.id('orgM'), tests.id('mo2'), 'owner'),
  (tests.id('orgM'), tests.id('ma1'), 'admin'), (tests.id('orgM'), tests.id('ma2'), 'admin'),
  (tests.id('orgM'), tests.id('me'), 'estimator'), (tests.id('orgM'), tests.id('mv'), 'viewer'), (tests.id('orgM'), tests.id('mv2'), 'viewer'),
  (tests.id('orgN'), tests.id('mn'), 'owner'),
  (tests.id('orgS'), tests.id('so1'), 'owner'), (tests.id('orgS'), tests.id('sa1'), 'admin');

create function tests.m_role(p_org text, p_user text) returns text
language sql security definer as $$
  select role from public.memberships where org_id = tests.id(p_org) and user_id = tests.id(p_user)
$$;
grant execute on function tests.m_role(text, text) to anon, authenticated;

-- C1532: an owner and an admin change another non-owner member's role; the same role again is a success.
select tests.act_as('mo1');
do $$ begin
  perform public.set_member_role(tests.id('mv'), 'estimator');
  perform tests.ok('C1532 owner sets', tests.m_role('orgM', 'mv') = 'estimator', 'role not stored');
  perform tests.m_expect('C1532 same role', format('select public.set_member_role(%L, ''estimator'')', tests.id('mv')), 'ok');
  perform tests.ok('C1532 same role unchanged', tests.m_role('orgM', 'mv') = 'estimator', 'role changed');
  perform tests.ok('C1532 listed', tests.m_roster() like '%mv@members.test:estimator%', tests.m_roster());
end $$;
select tests.act_as('ma1');
do $$ begin
  perform public.set_member_role(tests.id('mv2'), 'estimator');
  perform tests.ok('C1532 admin sets', tests.m_role('orgM', 'mv2') = 'estimator', 'admin could not set a role');
  perform public.set_member_role(tests.id('mv2'), 'viewer');
end $$;

-- C1533: an admin cannot grant Owner or touch an owner; an owner can promote and demote another owner.
do $$ begin
  perform tests.m_expect('C1533 admin grants owner', format('select public.set_member_role(%L, ''owner'')', tests.id('mv')), '55000:owner_only');
  perform tests.m_expect('C1533 admin demotes owner', format('select public.set_member_role(%L, ''viewer'')', tests.id('mo2')), '55000:owner_only');
  perform tests.m_expect('C1533 admin removes owner', format('select public.remove_member(%L)', tests.id('mo2')), '55000:owner_only');
  perform tests.ok('C1533 unchanged', tests.m_role('orgM', 'mo2') = 'owner' and tests.m_role('orgM', 'mv') = 'estimator', 'a refused call changed a role');
end $$;
select tests.act_as('mo1');
do $$ begin
  perform public.set_member_role(tests.id('ma2'), 'owner');
  perform tests.ok('C1533 owner promotes', tests.m_role('orgM', 'ma2') = 'owner', 'not promoted');
  perform public.set_member_role(tests.id('ma2'), 'admin');
  perform tests.ok('C1533 owner demotes another owner', tests.m_role('orgM', 'ma2') = 'admin', 'not demoted');
end $$;

-- C1534: the only owner cannot demote or remove themself (last_owner, not self); an admin cannot reach them (owner_only).
select tests.act_as('so1');
do $$ begin
  perform tests.m_expect('C1534 demote', format('select public.set_member_role(%L, ''admin'')', tests.id('so1')), '55000:last_owner');
  perform tests.m_expect('C1534 remove', format('select public.remove_member(%L)', tests.id('so1')), '55000:last_owner');
  perform tests.ok('C1534 unchanged', tests.m_role('orgS', 'so1') = 'owner', 'the only owner changed');
end $$;
select tests.act_as('sa1');
do $$ begin
  perform tests.m_expect('C1534 admin cannot reach the owner', format('select public.remove_member(%L)', tests.id('so1')), '55000:owner_only');
end $$;

-- C1535: acting on yourself is refused when you are not the only owner.
select tests.act_as('ma1');
do $$ begin
  perform tests.m_expect('C1535 admin sets self', format('select public.set_member_role(%L, ''viewer'')', tests.id('ma1')), '55000:self');
  perform tests.m_expect('C1535 admin removes self', format('select public.remove_member(%L)', tests.id('ma1')), '55000:self');
end $$;
select tests.act_as('mo1');
do $$ begin
  perform tests.m_expect('C1535 owner sets self', format('select public.set_member_role(%L, ''admin'')', tests.id('mo1')), '55000:self');
  perform tests.m_expect('C1535 owner removes self', format('select public.remove_member(%L)', tests.id('mo1')), '55000:self');
  perform tests.ok('C1535 unchanged', tests.m_role('orgM', 'mo1') = 'owner' and tests.m_role('orgM', 'ma1') = 'admin', 'a role changed');
end $$;

-- C1538: a user outside the caller's org, or unknown, is P0002 and the other org is untouched.
do $$ begin
  perform tests.m_expect('C1538 other org set', format('select public.set_member_role(%L, ''viewer'')', tests.id('mn')), 'P0002:');
  perform tests.m_expect('C1538 other org remove', format('select public.remove_member(%L)', tests.id('mn')), 'P0002:');
  perform tests.m_expect('C1538 unknown', format('select public.remove_member(%L)', tests.id('nobody')), 'P0002:');
  perform tests.ok('C1538 other org kept', tests.m_role('orgN', 'mn') = 'owner', 'the other org changed');
end $$;

-- C1539: the members lock is held once a write returns, and a demoted owner can no longer act as one.
do $$
declare
  v_key bigint := hashtext('members:' || tests.id('orgM')::text)::bigint;
begin
  perform public.set_member_role(tests.id('mo2'), 'admin');
  perform tests.ok('C1539 lock held', exists (
    select 1 from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and granted and ((classid::bigint << 32) | objid::bigint) = v_key),
    'no advisory lock for the org');
end $$;
select tests.act_as('mo2');
do $$ begin
  perform tests.m_expect('C1539 demoted owner', format('select public.set_member_role(%L, ''viewer'')', tests.id('mo1')), '55000:owner_only');
  perform tests.ok('C1539 org keeps an owner', tests.m_role('orgM', 'mo1') = 'owner', 'the org lost its owner');
end $$;

-- C1540: no member writes memberships or invitations directly; reads follow the policies.
do $$
declare
  u text;
  s text;
begin
  foreach u in array array['uA', 'uAd', 'uE', 'uV'] loop
    perform tests.act_as(u);
    foreach s in array array[
      format('insert into public.memberships (org_id, user_id, role) values (%L, %L, ''viewer'')', tests.id('orgA'), tests.id('uX')),
      format('update public.memberships set role = ''owner'' where org_id = %L', tests.id('orgA')),
      format('delete from public.memberships where org_id = %L', tests.id('orgA')),
      format('insert into public.invitations (org_id, email, role, expires_at) values (%L, ''d1@x.test'', ''viewer'', now())', tests.id('orgA')),
      format('update public.invitations set role = ''owner'' where org_id = %L', tests.id('orgA')),
      format('delete from public.invitations where org_id = %L', tests.id('orgA'))] loop
      -- A privilege refusal carries a Supabase hint of its own, so only the SQLSTATE is compared here.
      perform tests.expect_error('C1540 ' || u || ' ' || left(s, 36), s, '42501');
    end loop;
    perform tests.ok('C1540 ' || u || ' memberships', (select count(*) from public.memberships where org_id = tests.id('orgA')) = tests.m_members_in(tests.id('orgA'))
      and (select count(*) from public.memberships where org_id <> tests.id('orgA')) = 0, u || ' reads other rows than its org');
    perform tests.ok('C1540 ' || u || ' invitations',
      case when u in ('uA', 'uAd') then (select count(*) from public.invitations where org_id = tests.id('orgA')) > 0
           else (select count(*) from public.invitations) = 0 end, u || ' reads the wrong invitations');
  end loop;
end $$;

-- C1536 and C1537, last because they remove uE from org A: removal ends access and keeps the member's records.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.agreement_versions (org_id, agreement_id, version_no, created_by) values (tests.id('orgA'), tests.id('agrA'), 5001, tests.id('uE'));
insert into public.events (org_id, entity_type, entity_id, type, actor_id) values (tests.id('orgA'), 'agreement', tests.id('agrA'), 'agreement.sent', tests.id('uE'));
create table tests.m_trail as
  select (select count(*) from public.agreement_versions where created_by = tests.id('uE')) as versions,
         (select count(*) from public.events where actor_id = tests.id('uE')) as events;
select tests.act_as('uE');
select tests.ok('C1536 before', (select count(*) from public.customers) > 0, 'the estimator sees no customers before removal');
select tests.act_as('uA');
select public.remove_member(tests.id('uE'));
reset role;
select tests.ok('C1536 membership gone', (select count(*) from public.memberships where user_id = tests.id('uE')) = 0, 'membership remains');
select tests.act_as('uE');
select tests.ok('C1536 no access', (select count(*) from public.customers) = 0 and (select count(*) from public.agreements) = 0, 'a removed member still reads org data');
reset role;
select tests.ok('C1537 kept', (select count(*) from public.agreement_versions where created_by = tests.id('uE')) = (select versions from tests.m_trail)
  and (select count(*) from public.events where actor_id = tests.id('uE')) = (select events from tests.m_trail)
  and (select versions from tests.m_trail) >= 1 and (select events from tests.m_trail) >= 1, 'a record of the removed member changed');

rollback;
select 'members: pass' as result;
