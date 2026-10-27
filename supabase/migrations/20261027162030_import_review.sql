-- Asset import, step 4: review the extracted rows and commit them to assets (.specs/features/import-review, doors 1 to 4).
-- import_jobs and import_rows are empty on the live project (checked 2026-10-27), so the new checks hold without a backfill.

-- Door 1: each row's fate. A row becomes at most one asset; deleting that asset clears the link and keeps the row.
alter table public.assets add constraint assets_id_org_id_key unique (id, org_id);

alter table public.import_rows
  add column skipped boolean not null default false,
  add column asset_id uuid,
  add constraint import_rows_asset_id_key unique (asset_id),
  add constraint import_rows_asset_fkey foreign key (asset_id, org_id) references public.assets (id, org_id) on delete set null (asset_id),
  add constraint import_rows_skipped_never_committed check (not (skipped and asset_id is not null));

-- Door 2: the commit state. A committed job was read and extracted, so the checks that name those states include it.
alter table public.import_jobs
  drop constraint import_jobs_status_check,
  drop constraint import_jobs_read_at_iff_read,
  drop constraint import_jobs_counts_only_read,
  drop constraint import_jobs_extract_state,
  drop constraint import_jobs_extracted_at_iff_extracted,
  drop constraint import_jobs_extracted_is_complete,
  add column committed_at timestamptz,
  add column committed_by uuid,
  add column committed_count integer check (committed_count >= 1);

alter table public.import_jobs
  add constraint import_jobs_status_check
    check (status in ('uploading', 'uploaded', 'parsed', 'unreadable', 'extracting', 'extracted', 'committed')),
  add constraint import_jobs_read_at_iff_read
    check ((status in ('parsed', 'unreadable', 'extracting', 'extracted', 'committed')) = (read_at is not null)),
  add constraint import_jobs_counts_only_read
    check (status in ('parsed', 'extracting', 'extracted', 'committed') or (table_count is null and row_count is null)),
  add constraint import_jobs_extract_state check ((status in ('extracting', 'extracted', 'committed')) = (extract_total is not null)),
  add constraint import_jobs_extracted_at_iff_extracted check ((status in ('extracted', 'committed')) = (extracted_at is not null)),
  add constraint import_jobs_extracted_is_complete check (status not in ('extracted', 'committed') or extract_cursor = extract_total),
  add constraint import_jobs_committed_state
    check ((status = 'committed') = (committed_at is not null and committed_by is not null and committed_count is not null)),
  -- Door 2b: the three are set together, so no other status can carry part of a commit.
  add constraint import_jobs_committed_together
    check ((committed_at is null) = (committed_by is null) and (committed_at is null) = (committed_count is null));

-- Door 4: rows change only while their job is `extracted`. The job is read `for share`, so an edit and a commit
-- serialise. No job row means the job itself is being deleted (the cascade of a discard). Clearing `asset_id` alone is
-- the `on delete set null` of a deleted asset, which a committed job must allow.
create function private.import_rows_frozen()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'UPDATE' and old.asset_id is not null and new.asset_id is null
     and (new.id, new.org_id, new.job_id, new.position, new.asset_type_raw, new.unit_no, new.type_model, new.location,
          new.confidence, new.source_ref, new.asset_type_id, new.skipped)
         is not distinct from
         (old.id, old.org_id, old.job_id, old.position, old.asset_type_raw, old.unit_no, old.type_model, old.location,
          old.confidence, old.source_ref, old.asset_type_id, old.skipped) then
    return new;
  end if;
  select j.status into v_status from public.import_jobs j where j.id = old.job_id for share;
  if found and v_status <> 'extracted' then
    raise exception 'import job % is not open for review', old.job_id using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function private.import_rows_frozen() from public, anon, authenticated;

create trigger import_rows_frozen before update or delete on public.import_rows
  for each row execute function private.import_rows_frozen();

-- Door 3: every included row becomes an asset of the job's site, once, in one transaction. Raises P0002 when the job is
-- missing or outside the caller's orgs, 42501 when the caller cannot write it, 40001 when the job is not `extracted`,
-- and 23514 when an included row has no type or a field over the asset form's limits, or no row is included.
create function public.commit_import(p_job_id uuid)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_site uuid;
  v_status text;
  v_asset uuid;
  v_count integer := 0;
  v_row record;
begin
  select j.org_id into v_org from public.import_jobs j where j.id = p_job_id;
  if v_org is null then
    raise exception 'import job % not found', p_job_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change import job %', p_job_id using errcode = '42501';
  end if;

  select j.site_id, j.status into v_site, v_status from public.import_jobs j where j.id = p_job_id for update;
  if v_status is distinct from 'extracted' then
    raise exception 'import job % is not extracted', p_job_id using errcode = '40001';
  end if;
  if exists (
    select 1 from public.import_rows r
    where r.job_id = p_job_id and not r.skipped
      and (r.asset_type_id is null or length(r.unit_no) > 40 or length(r.type_model) > 120 or length(r.location) > 300)
  ) then
    raise exception 'import job % has rows that need a fix', p_job_id using errcode = '23514';
  end if;
  if not exists (select 1 from public.import_rows r where r.job_id = p_job_id and not r.skipped) then
    raise exception 'import job % has no included row', p_job_id using errcode = '23514';
  end if;

  -- Rows first, while the job is still `extracted`: the trigger refuses row changes once it is committed.
  for v_row in
    select i.id, i.asset_type_id, i.unit_no, i.type_model, i.location
    from public.import_rows i
    where i.job_id = p_job_id and not i.skipped
    order by i.position
  loop
    insert into public.assets (org_id, site_id, asset_type_id, unit_no, type_model, location, source)
    values (v_org, v_site, v_row.asset_type_id, v_row.unit_no, v_row.type_model, v_row.location, 'import')
    returning id into v_asset;
    update public.import_rows set asset_id = v_asset where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  update public.import_jobs
  set status = 'committed', committed_at = now(), committed_by = auth.uid(), committed_count = v_count, updated_at = now()
  where id = p_job_id;
  return v_count;
end $$;

revoke execute on function public.commit_import(uuid) from public, anon;
grant execute on function public.commit_import(uuid) to authenticated;
