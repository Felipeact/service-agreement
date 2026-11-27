-- API and MCP activity log: owners and admins read every row of their company's `ai_tool_calls` (tool, door, outcome, member, time),
-- not only their own. Still never arguments or answers; nothing is updated or deleted.
create policy ai_tool_calls_select_managers on public.ai_tool_calls
  for select to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])));
