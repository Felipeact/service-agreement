-- A company whose subscription ended is read-only in the database too, not only in the app (.specs/features/db-freeze/).
-- private.has_org_role is the one gate every write policy and write function asks, so it now answers false for a frozen org.
-- The few reads a frozen owner still needs (Billing, usage, the pending invitations, the logo) ask the old question instead.

-- Door 1: whether an org is frozen. No org_billing row (the demo org) is never frozen. A status Stripe adds later is not in the set.
create function private.org_is_frozen(p_org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select b.status in ('canceled', 'unpaid', 'incomplete_expired')
    from public.org_billing b
    where b.org_id = p_org
  ), false)
$$;

revoke execute on function private.org_is_frozen(uuid) from public, anon;
grant execute on function private.org_is_frozen(uuid) to authenticated;

-- Door 2: the old has_org_role body, for the read paths that must survive a freeze.
create function private.has_org_role_any_state(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  )
$$;

revoke execute on function private.has_org_role_any_state(uuid, text[]) from public, anon;
grant execute on function private.has_org_role_any_state(uuid, text[]) to authenticated;

-- Door 1: same signature, now false while the org is frozen.
create or replace function private.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  ) and not private.org_is_frozen(p_org)
$$;

-- The app's banner and the database now read one rule.
create or replace function public.my_org_frozen()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select private.org_is_frozen(m.org_id)
    from public.memberships m
    where m.user_id = (select auth.uid())
    order by m.created_at
    limit 1
  ), false)
$$;

-- The five reads that stay open for a frozen owner or admin.
alter policy org_billing_select on public.org_billing
  using ((select private.has_org_role_any_state(org_id, array['owner', 'admin'])));

alter policy invitations_select on public.invitations
  using ((select private.has_org_role_any_state(org_id, array['owner', 'admin'])));

alter policy logos_select on storage.objects
  using (bucket_id = 'logos'
         and (select private.has_org_role_any_state(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin'])));

create or replace function public.list_invitations()
returns table(id uuid, email text, role text, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_org uuid := private.current_org();
begin
  if v_org is null or not (select private.has_org_role_any_state(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to see invitations' using errcode = '42501';
  end if;
  return query
  select i.id, i.email, i.role, i.created_at, i.expires_at
  from public.invitations i
  where i.org_id = v_org and i.accepted_at is null
  order by i.created_at desc, i.id
  limit 500;
end $$;

create or replace function public.org_usage()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_plan text;
  v_agreements_limit integer;
  v_imports_limit integer;
begin
  -- One org per person until there is an org switcher (decision 9).
  select m.org_id into v_org from public.memberships m where m.user_id = (select auth.uid()) limit 1;
  if v_org is null or not (select private.has_org_role_any_state(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to read usage' using errcode = '42501';
  end if;
  select b.plan, l.live_agreements, l.ai_imports into v_plan, v_agreements_limit, v_imports_limit
  from public.org_billing b join private.plan_limits l on l.plan = b.plan
  where b.org_id = v_org;
  return jsonb_build_object(
    'plan', v_plan,
    'live_agreements', jsonb_build_object(
      'used', (select count(*)::integer from public.agreements a where a.org_id = v_org and a.status in ('draft', 'sent', 'changes_requested')),
      'limit', v_agreements_limit),
    'ai_imports', jsonb_build_object(
      'used', (select count(*)::integer from public.import_jobs j
               where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1)),
      'limit', v_imports_limit,
      'input_tokens', (select coalesce(sum(j.input_tokens), 0)::bigint from public.import_jobs j
                       where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1)),
      'output_tokens', (select coalesce(sum(j.output_tokens), 0)::bigint from public.import_jobs j
                        where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1))),
    'resets_on', (private.month_start(1) at time zone 'America/Vancouver')::date);
end $$;
