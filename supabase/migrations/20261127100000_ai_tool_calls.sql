-- AI tool calls: one audit row per tool an AI client (the MCP endpoint) runs for a member. Only the tool name, the door it came
-- through and whether it worked are kept, never the arguments or the answer. A member reads their own rows; nothing is updated or deleted.
create table public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tool text not null check (char_length(tool) between 1 and 60),
  source text not null check (source in ('mcp', 'app')),
  ok boolean not null,
  called_at timestamptz not null default now()
);
alter table public.ai_tool_calls enable row level security;
create index ai_tool_calls_user_called_idx on public.ai_tool_calls (user_id, called_at desc);
create index ai_tool_calls_org_id_idx on public.ai_tool_calls (org_id);

create policy ai_tool_calls_select_own on public.ai_tool_calls
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_tool_calls_insert_own on public.ai_tool_calls
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_org_role(org_id, array['owner', 'admin', 'estimator', 'viewer'])));

revoke all on public.ai_tool_calls from public, anon;
grant select, insert on public.ai_tool_calls to authenticated;
