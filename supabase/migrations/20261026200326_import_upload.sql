-- Asset import, step 1: import jobs and the private `imports` bucket (.specs/features/import-upload, doors 1-3 and 5).

-- ---------------------------------------------------------------------------
-- import_jobs: one uploaded file destined for one site's register (door 1).
-- Later Phase 2 items extend the status check (AD-005).
-- ---------------------------------------------------------------------------

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  site_id uuid not null,
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text not null check (content_type in (
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  status text not null default 'uploading' check (status in ('uploading', 'uploaded')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_by_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (site_id, org_id) references public.sites (id, org_id)
);
create index import_jobs_org_id_idx on public.import_jobs (org_id);
create index import_jobs_site_id_idx on public.import_jobs (site_id, org_id, created_at desc);
create index import_jobs_created_by_idx on public.import_jobs (created_by);

revoke insert, update, delete, truncate, references, trigger on public.import_jobs from anon;
revoke truncate, references, trigger on public.import_jobs from authenticated;

alter table public.import_jobs enable row level security;

-- Same as assets: members read, everyone but viewers write.
create policy import_jobs_select on public.import_jobs for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy import_jobs_insert on public.import_jobs for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy import_jobs_update on public.import_jobs for update to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])))
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy import_jobs_delete on public.import_jobs for delete to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));

-- ---------------------------------------------------------------------------
-- The private `imports` bucket (door 2): 20 MB, four content types.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 20971520, array[
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- ---------------------------------------------------------------------------
-- Object key `<org_id>/<job_id>` and its policies (doors 3 and 5). No update policy: nothing overwrites.
-- ---------------------------------------------------------------------------

-- A malformed key segment is refused by the policy (42501), not by a cast error (22P02).
create function private.uuid_or_null(p_text text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_text::uuid end
$$;

create policy imports_select on storage.objects for select to authenticated
  using (
    bucket_id = 'imports'
    and (select private.is_org_member(private.uuid_or_null((storage.foldername(name))[1])))
  );

-- Only into the folder of a job of that org that is still waiting for its file.
create policy imports_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imports'
    and array_length(storage.foldername(name), 1) = 1
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin', 'estimator']))
    and exists (
      select 1 from public.import_jobs j
      where j.id = private.uuid_or_null(storage.filename(name))
        and j.org_id = private.uuid_or_null((storage.foldername(name))[1])
        and j.status = 'uploading'
    )
  );

create policy imports_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'imports'
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin', 'estimator']))
  );
