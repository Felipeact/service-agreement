-- Ask AI allowance by plan: how many questions the caller's whole company has asked this month (calendar month, America/Vancouver,
-- the same window as AI imports). A member can only read their own rows of `assistant_questions`, so the company total comes from
-- this function, which returns two numbers and nothing about who asked what. Any member of the org may call it.
create function public.assistant_month_usage()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select m.org_id into v_org from public.memberships m where m.user_id = (select auth.uid()) limit 1;
  if v_org is null then
    raise exception 'not a member' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'used', (select count(*)::integer from public.assistant_questions q
             where q.org_id = v_org and q.asked_at >= private.month_start() and q.asked_at < private.month_start(1)),
    'resets_on', (private.month_start(1) at time zone 'America/Vancouver')::date);
end $$;

revoke execute on function public.assistant_month_usage() from public, anon;
grant execute on function public.assistant_month_usage() to authenticated;
