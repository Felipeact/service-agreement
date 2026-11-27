-- API access: the plan a member's company is on, readable by any member (the MCP endpoint and the REST API gate on it), and the
-- REST API as a third door in the AI tool audit. `org_usage` stays owner and admin only because it carries usage figures; this
-- function returns the plan key alone.
create function public.org_plan()
returns text
language sql stable security definer
set search_path = ''
as $$
  select b.plan
  from public.memberships m
  join public.org_billing b on b.org_id = m.org_id
  where m.user_id = (select auth.uid())
  limit 1
$$;

revoke execute on function public.org_plan() from public, anon;
grant execute on function public.org_plan() to authenticated;

alter table public.ai_tool_calls drop constraint ai_tool_calls_source_check;
alter table public.ai_tool_calls add constraint ai_tool_calls_source_check check (source in ('mcp', 'api', 'app'));
