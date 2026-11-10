-- plan-change door 2 (.specs/features/plan-change/plan.md): the one way a member changes what their org's plan is recorded as.
-- `org_billing` is select-only for members on purpose (workspace-provisioning door 1): an update policy would let a member write
-- any column, including the Stripe ids. This definer function checks the caller's role itself, validates the two values the
-- table's own checks also guard, and updates only `plan` and `seats` of the caller's own org.

create function public.set_org_plan(p_plan text, p_seats integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  -- One org per person until there is an org switcher (decision 9).
  select m.org_id into v_org from public.memberships m where m.user_id = (select auth.uid()) limit 1;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to change the plan' using errcode = '42501';
  end if;
  if p_plan is null or p_plan not in ('starter', 'team', 'business') or p_seats is null or p_seats not between 1 and 50 then
    raise exception 'invalid plan or seats' using errcode = '22023';
  end if;
  update public.org_billing set plan = p_plan, seats = p_seats where org_id = v_org;
  if not found then
    raise exception 'no billing record for this org' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.set_org_plan(text, integer) from public, anon;
grant execute on function public.set_org_plan(text, integer) to authenticated;
