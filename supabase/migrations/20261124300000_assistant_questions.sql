-- Ask AI: one row per question a member asks the assistant, so each member has a small daily limit (30 questions in any 24 hours,
-- counted by the app). Only the time and who asked are kept, never the question or the answer.
create table public.assistant_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asked_at timestamptz not null default now()
);
alter table public.assistant_questions enable row level security;
create index assistant_questions_user_asked_idx on public.assistant_questions (user_id, asked_at desc);
create index assistant_questions_org_id_idx on public.assistant_questions (org_id);

create policy assistant_questions_select_own on public.assistant_questions
  for select to authenticated using (user_id = (select auth.uid()));
create policy assistant_questions_insert_own on public.assistant_questions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_org_role(org_id, array['owner', 'admin', 'estimator', 'viewer'])));

revoke all on public.assistant_questions from public, anon;
grant select, insert on public.assistant_questions to authenticated;
