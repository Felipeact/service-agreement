-- Members page (.specs/features/members-page, doors 1 to 4): invitations, the signup gate, accepting an invitation, and
-- the only writers of memberships. No service-role key anywhere: every function runs in the database as its owner and
-- checks the caller itself (AD-004, AD-114).
--
-- A person is invited by a row in public.invitations. Supabase Auth may create a login only for an invited address
-- (the Before User Created hook, registered in the dashboard), and the first sign-in turns the invitation into a
-- membership (accept_invitations, called by /auth/confirm).

-- Door 1: the invitation. At most one live (not accepted) row per address in an org. Rows stay after acceptance, so
-- the table records who invited whom; an expired row stays too and can be resent.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 254),
  role text not null check (role in ('owner', 'admin', 'estimator', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete cascade,
  unique (id, org_id),
  constraint invitations_accepted_together check ((accepted_at is null) = (accepted_by is null))
);
create unique index invitations_one_live on public.invitations (org_id, email) where accepted_at is null;
-- The hook and accept_invitations look an address up across orgs.
create index invitations_live_email_idx on public.invitations (email) where accepted_at is null;
create index invitations_invited_by_idx on public.invitations (invited_by) where invited_by is not null;
create index invitations_accepted_by_idx on public.invitations (accepted_by) where accepted_by is not null;

alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])));

-- Door 4: memberships are written only by the functions below. RLS cannot say "the last owner stays" or "an admin
-- cannot touch an owner" (AD-060, AD-113). A policy with no privilege behind it is dead weight that a later grant
-- would silently reopen, so the three write policies go too.
revoke insert, update, delete on public.memberships from authenticated;
drop policy memberships_insert on public.memberships;
drop policy memberships_update on public.memberships;
drop policy memberships_delete on public.memberships;

-- The org the app acts for: the member's oldest membership, as MemberDirectory.currentMember reads it.
create function private.current_org()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = (select auth.uid())
  order by m.created_at, m.id
  limit 1
$$;

revoke execute on function private.current_org() from public, anon, authenticated;

-- Reads. list_members is open to every member (colleagues of one company); the emails come from auth.users because no
-- public table holds them (as private.org_managers). Owner first, then admin, estimator, viewer, then email.
create function public.list_members()
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = (select private.current_org())
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'estimator' then 2 else 3 end, u.email, m.user_id
  limit 500
$$;

create function public.list_invitations()
returns table (id uuid, email text, role text, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_org uuid := private.current_org();
begin
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to see invitations' using errcode = '42501';
  end if;
  return query
  select i.id, i.email, i.role, i.created_at, i.expires_at
  from public.invitations i
  where i.org_id = v_org and i.accepted_at is null
  order by i.created_at desc, i.id
  limit 500;
end $$;

-- Writers. Each takes the org's members lock first, so two changes in one org take turns, and then reads the caller's
-- role: a manager demoted a moment ago is refused, not obeyed on a stale read. Refusals carry a hint the adapters read.
create function public.create_invitation(p_email text, p_role text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_org is null then
    raise exception 'not allowed to invite' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('members:' || v_org::text));
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to invite' using errcode = '42501';
  end if;
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'not an email address' using errcode = '23514', hint = 'invalid_email';
  end if;
  if p_role is null or p_role not in ('owner', 'admin', 'estimator', 'viewer') then
    raise exception 'not a role' using errcode = '23514', hint = 'invalid_role';
  end if;
  if p_role = 'owner' and not (select private.has_org_role(v_org, array['owner'])) then
    raise exception 'only an owner can invite an owner' using errcode = '55000', hint = 'owner_only';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = v_org and lower(u.email) = v_email
  ) then
    raise exception '% is already a member', v_email using errcode = '23505', hint = 'already_member';
  end if;

  -- A live invitation for the address is refreshed: new role, 14 more days. That is also what Resend does.
  insert into public.invitations (org_id, email, role, invited_by, expires_at)
  values (v_org, v_email, p_role, (select auth.uid()), now() + interval '14 days')
  on conflict (org_id, email) where accepted_at is null
  do update set role = excluded.role, invited_by = excluded.invited_by, expires_at = excluded.expires_at
  returning id into v_id;
  return v_id;
end $$;

create function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org();
begin
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to revoke invitations' using errcode = '42501';
  end if;
  delete from public.invitations i where i.id = p_invitation_id and i.org_id = v_org and i.accepted_at is null;
  if not found then
    raise exception 'invitation % not found', p_invitation_id using errcode = 'P0002';
  end if;
end $$;

-- Rule order for set_member_role and remove_member: not a manager (42501), target not in the org (P0002), an admin
-- touching an owner or granting Owner (owner_only), a change that would remove the only owner (last_owner), the
-- caller's own row (self). The org therefore always keeps an owner: only an owner can touch an owner, and not
-- themself unless another owner remains.
create function private.check_member_change(p_org uuid, p_user_id uuid, p_new_role text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_caller_role text;
  v_target_role text;
begin
  select m.role into v_caller_role from public.memberships m where m.org_id = p_org and m.user_id = v_caller;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'not allowed to change members' using errcode = '42501';
  end if;
  select m.role into v_target_role from public.memberships m where m.org_id = p_org and m.user_id = p_user_id for update;
  if v_target_role is null then
    raise exception 'member % not found', p_user_id using errcode = 'P0002';
  end if;
  if v_caller_role = 'admin' and (v_target_role = 'owner' or p_new_role = 'owner') then
    raise exception 'only an owner can change an owner' using errcode = '55000', hint = 'owner_only';
  end if;
  if v_target_role = 'owner' and p_new_role is distinct from 'owner'
     and (select count(*) from public.memberships m where m.org_id = p_org and m.role = 'owner') = 1 then
    raise exception 'an organization needs at least one owner' using errcode = '55000', hint = 'last_owner';
  end if;
  if p_user_id = v_caller then
    raise exception 'you cannot change or remove yourself' using errcode = '55000', hint = 'self';
  end if;
  return v_target_role;
end $$;

revoke execute on function private.check_member_change(uuid, uuid, text) from public, anon, authenticated;

create function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org();
  v_current text;
begin
  if v_org is null then
    raise exception 'not allowed to change members' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('members:' || v_org::text));
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to change members' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('owner', 'admin', 'estimator', 'viewer') then
    raise exception 'not a role' using errcode = '23514', hint = 'invalid_role';
  end if;
  v_current := private.check_member_change(v_org, p_user_id, p_role);
  if v_current <> p_role then
    update public.memberships set role = p_role where org_id = v_org and user_id = p_user_id;
  end if;
end $$;

create function public.remove_member(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org();
begin
  if v_org is null then
    raise exception 'not allowed to change members' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('members:' || v_org::text));
  perform private.check_member_change(v_org, p_user_id, null);
  delete from public.memberships where org_id = v_org and user_id = p_user_id;
end $$;

-- Door 3: the first sign-in turns the earliest live invitation for the caller's verified address into a membership.
-- A person in an org already is left alone (one org per user until there is an org switcher), and a second call finds
-- nothing to accept. The email comes from auth.users, not the token (an unverified claim would be trusted).
create function public.accept_invitations()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_invitation public.invitations;
begin
  if v_user is null then
    return 0;
  end if;
  -- Two calls of one user take turns, so neither can accept an invitation of another org after the other did.
  perform pg_advisory_xact_lock(hashtext('accept:' || v_user::text));
  if exists (select 1 from public.memberships m where m.user_id = v_user) then
    return 0;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user;
  select i.* into v_invitation
  from public.invitations i
  where i.email = v_email and i.accepted_at is null and i.expires_at > now()
  order by i.created_at, i.id
  limit 1
  for update;
  if not found then
    return 0;
  end if;
  insert into public.memberships (org_id, user_id, role) values (v_invitation.org_id, v_user, v_invitation.role);
  update public.invitations set accepted_at = now(), accepted_by = v_user where id = v_invitation.id;
  return 1;
end $$;

-- Door 2: Supabase Auth may create a login only for an invited address. A Postgres hook, so no endpoint and no secret;
-- register it in the dashboard (Authentication > Hooks > Before User Created) with sign-ups enabled.
create function private.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email <> '' and exists (
    select 1 from public.invitations i
    where i.email = v_email and i.accepted_at is null and i.expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Sign-ups are by invitation.'));
end $$;

grant usage on schema private to supabase_auth_admin;
revoke execute on function private.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function private.hook_before_user_created(jsonb) to supabase_auth_admin;

revoke execute on function public.list_members() from public, anon;
revoke execute on function public.list_invitations() from public, anon;
revoke execute on function public.create_invitation(text, text) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.accept_invitations() from public, anon;
grant execute on function public.list_members() to authenticated;
grant execute on function public.list_invitations() to authenticated;
grant execute on function public.create_invitation(text, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.accept_invitations() to authenticated;
