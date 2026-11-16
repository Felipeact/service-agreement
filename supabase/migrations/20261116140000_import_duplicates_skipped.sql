-- A row the extraction reads as a repeat of an earlier row of the same job (same typed asset type, same unit # once its
-- punctuation and case are ignored) starts skipped, so "Add N assets" counts it once (.specs/features/qa-p1-p2/, C7006).
-- The row stays in the review with its "Same as row N" flag, and unskipping it is one click. Rows with no type or no unit #
-- are never judged a repeat. Otherwise the same function as 20261113140000_ai_import_tokens.sql.
-- NOT applied to the hosted project: applying it needs the owner's go-ahead.
create or replace function public.record_extraction_chunk(
  p_job_id uuid,
  p_expected_cursor integer,
  p_total integer,
  p_rows jsonb,
  p_input_tokens bigint default 0,
  p_output_tokens bigint default 0
)
returns integer
language plpgsql
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
      extract_started_at = case when p_expected_cursor is null then now() else extract_started_at end,
      input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
      output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
      updated_at = now()
  where id = p_job_id
    and extract_cursor is not distinct from p_expected_cursor
    and status = case when p_expected_cursor is null then 'parsed' else 'extracting' end
    and (p_expected_cursor is null or extract_total = p_total);
  if not found then
    raise exception 'import job % is no longer at cursor %', p_job_id, p_expected_cursor using errcode = '40001';
  end if;

  select coalesce(max(r.position), 0) into v_base from public.import_rows r where r.job_id = p_job_id;
  -- A repeat is skipped as it is inserted (the review lock refuses updating rows while the job is still extracting).
  with incoming as (
    select e.ord, e.value, (e.value ->> 'asset_type_id')::uuid as type_id,
           nullif(btrim(regexp_replace(lower(coalesce(e.value ->> 'unit_no', '')), '[^[:alnum:]]+', ' ', 'g')), '') as unit_key
    from jsonb_array_elements(p_rows) with ordinality as e(value, ord)
  )
  insert into public.import_rows (org_id, job_id, position, asset_type_raw, unit_no, type_model, location, confidence, source_ref, asset_type_id, skipped)
  select v_org, p_job_id, v_base + i.ord,
         i.value ->> 'asset_type_raw', i.value ->> 'unit_no', i.value ->> 'type_model', i.value ->> 'location',
         i.value ->> 'confidence', i.value ->> 'source_ref', i.type_id,
         i.type_id is not null and i.unit_key is not null and (
           exists (select 1 from incoming o where o.ord < i.ord and o.type_id = i.type_id and o.unit_key = i.unit_key)
           or exists (select 1 from public.import_rows o
                      where o.job_id = p_job_id and o.asset_type_id = i.type_id
                        and btrim(regexp_replace(lower(coalesce(o.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')) = i.unit_key)
         )
  from incoming i;
  return v_new;
end $$;

revoke execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) from public, anon;
grant execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) to authenticated;
