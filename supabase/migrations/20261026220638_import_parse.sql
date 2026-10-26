-- Asset import, step 2: the read outcome on import_jobs (.specs/features/import-parse, door 1).
-- A job is read once: `uploaded` -> `parsed` (counts, null for a PDF) or `unreadable` (a reason). The table is
-- empty on the live project (checked 2026-10-26), so the new checks hold without a backfill.

alter table public.import_jobs
  drop constraint import_jobs_status_check,
  add constraint import_jobs_status_check check (status in ('uploading', 'uploaded', 'parsed', 'unreadable')),
  add column read_error text
    check (read_error in ('corrupt', 'password_protected', 'no_table', 'no_text', 'too_many_rows')),
  add column table_count integer check (table_count >= 0),
  add column row_count integer check (row_count >= 0),
  add column read_at timestamptz;

alter table public.import_jobs
  add constraint import_jobs_reason_iff_unreadable check ((status = 'unreadable') = (read_error is not null)),
  add constraint import_jobs_read_at_iff_read check ((status in ('parsed', 'unreadable')) = (read_at is not null)),
  add constraint import_jobs_counts_only_parsed check (status = 'parsed' or (table_count is null and row_count is null)),
  add constraint import_jobs_counts_together check ((table_count is null) = (row_count is null));
