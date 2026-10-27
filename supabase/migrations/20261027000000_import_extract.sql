-- Asset import, step 3: extraction state on import_jobs, the rows it yields, the chunk write and the counts view
-- (.specs/features/import-extract, doors 1, 2, 4 and 7). import_jobs is empty on the live project (checked 2026-10-26),
-- so the new checks hold without a backfill.

-- Door 2: two statuses and the cursor. Two import-parse checks assumed a read job is never extracted, so they are replaced.
alter table public.import_jobs
  drop constraint import_jobs_status_check,
  drop constraint import_jobs_read_at_iff_read,
  drop constraint import_jobs_counts_only_parsed,
  add constraint import_jobs_status_check
    check (status in ('uploading', 'uploaded', 'parsed', 'unreadable', 'extracting', 'extracted')),
  add column extract_cursor integer check (extract_cursor >= 0),
  add column extract_total integer check (extract_total >= 1),
  add column extracted_at timestamptz;

alter table public.import_jobs
  add constraint import_jobs_read_at_iff_read
    check ((status in ('parsed', 'unreadable', 'extracting', 'extracted')) = (read_at is not null)),
  add constraint import_jobs_counts_only_read
    check (status in ('parsed', 'extracting', 'extracted') or (table_count is null and row_count is null)),
  add constraint import_jobs_extract_state check ((status in ('extracting', 'extracted')) = (extract_total is not null)),
  add constraint import_jobs_extract_together check ((extract_cursor is null) = (extract_total is null)),
  add constraint import_jobs_cursor_within_total check (extract_cursor <= extract_total),
  add constraint import_jobs_extracted_at_iff_extracted check ((status = 'extracted') = (extracted_at is not null)),
  add constraint import_jobs_extracted_is_complete check (status <> 'extracted' or extract_cursor = extract_total);

-- Door 1: the candidate rows. `asset_type_id is null` is what the screen calls "needs an equipment type".
create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  job_id uuid not null,
  position integer not null check (position >= 1),
  asset_type_raw text,
  unit_no text,
  type_model text,
  location text,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  source_ref text,
  asset_type_id uuid,
  unique (job_id, position),
  unique (id, org_id),
  foreign key (job_id, org_id) references public.import_jobs (id, org_id) on delete cascade,
  foreign key (asset_type_id, org_id) references public.asset_types (id, org_id)
);
create index import_rows_org_id_idx on public.import_rows (org_id);
create index import_rows_asset_type_id_idx on public.import_rows (asset_type_id, org_id);

revoke insert, update, delete, truncate, references, trigger on public.import_rows from anon;
revoke truncate, references, trigger on public.import_rows from authenticated;

alter table public.import_rows enable row level security;

-- Same as assets: members read, everyone but viewers write.
create policy import_rows_select on public.import_rows for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy import_rows_insert on public.import_rows for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy import_rows_update on public.import_rows for update to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])))
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));
create policy import_rows_delete on public.import_rows for delete to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));

-- Door 4: one chunk's rows and the cursor move together. The first call passes a null cursor on a `parsed` job; the
-- cursor then counts chunks recorded. Raises P0002 when the job is missing or outside the caller's orgs, 42501 when the
-- caller cannot write it, and 40001 when the cursor (or the job's status or total) is no longer what the caller saw.
create function public.record_extraction_chunk(
  p_job_id uuid,
  p_expected_cursor integer,
  p_total integer,
  p_rows jsonb
)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_new integer;
  v_base integer;
begin
  select j.org_id into v_org from public.import_jobs j where j.id = p_job_id;
  if v_org is null then
    raise exception 'import job % not found', p_job_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change import job %', p_job_id using errcode = '42501';
  end if;

  v_new := coalesce(p_expected_cursor, 0) + 1;
  update public.import_jobs
  set status = case when v_new = p_total then 'extracted' else 'extracting' end,
      extract_cursor = v_new,
      extract_total = p_total,
      extracted_at = case when v_new = p_total then now() end,
      updated_at = now()
  where id = p_job_id
    and extract_cursor is not distinct from p_expected_cursor
    and status = case when p_expected_cursor is null then 'parsed' else 'extracting' end
    and (p_expected_cursor is null or extract_total = p_total);
  if not found then
    raise exception 'import job % is no longer at cursor %', p_job_id, p_expected_cursor using errcode = '40001';
  end if;

  select coalesce(max(r.position), 0) into v_base from public.import_rows r where r.job_id = p_job_id;
  insert into public.import_rows (org_id, job_id, position, asset_type_raw, unit_no, type_model, location, confidence, source_ref, asset_type_id)
  select v_org, p_job_id, v_base + e.ord,
         e.value ->> 'asset_type_raw', e.value ->> 'unit_no', e.value ->> 'type_model', e.value ->> 'location',
         e.value ->> 'confidence', e.value ->> 'source_ref', (e.value ->> 'asset_type_id')::uuid
  from jsonb_array_elements(p_rows) with ordinality as e(value, ord);
  return v_new;
end $$;

revoke execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb) to authenticated;

-- Door 7: the counts the job list shows, read as the caller so RLS decides which jobs they see.
create view public.import_row_counts with (security_invoker = true) as
select r.job_id, r.org_id, count(*)::integer as rows, (count(*) filter (where r.asset_type_id is null))::integer as unmatched
from public.import_rows r
group by r.job_id, r.org_id;

revoke all on public.import_row_counts from public, anon;
grant select on public.import_row_counts to authenticated;
