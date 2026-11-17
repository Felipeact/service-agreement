-- Re-importing a list must never duplicate the site's equipment. A row that matches an asset already on the job's site
-- (same type, same unit # ignoring punctuation and case) starts skipped, and commit_import refuses to insert such a row even
-- when it is included (jobs extracted before this migration, or a row someone unskipped). Rows with no type or no unit # are
-- never judged a repeat. Otherwise the same functions as 20261116140000 and 20261027162030.
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
  v_site uuid;
begin
  select j.org_id, j.site_id into v_org, v_site from public.import_jobs j where j.id = p_job_id;
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
           or exists (select 1 from public.assets a
                      where a.site_id = v_site and a.asset_type_id = i.type_id
                        and btrim(regexp_replace(lower(coalesce(a.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')) = i.unit_key)
         )
  from incoming i;
  return v_new;
end $$;

revoke execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) from public, anon;
grant execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) to authenticated;

create or replace function public.commit_import(p_job_id uuid)
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

  for v_row in
    select i.id, i.asset_type_id, i.unit_no, i.type_model, i.location
    from public.import_rows i
    where i.job_id = p_job_id and not i.skipped
    order by i.position
  loop
    -- Already on the site (including an asset this same loop just added from an earlier included row): not added again.
    if nullif(btrim(regexp_replace(lower(coalesce(v_row.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')), '') is not null
       and exists (
         select 1 from public.assets a
         where a.site_id = v_site and a.asset_type_id = v_row.asset_type_id
           and btrim(regexp_replace(lower(coalesce(a.unit_no, '')), '[^[:alnum:]]+', ' ', 'g'))
             = btrim(regexp_replace(lower(coalesce(v_row.unit_no, '')), '[^[:alnum:]]+', ' ', 'g'))
       ) then
      update public.import_rows set skipped = true where id = v_row.id;
      continue;
    end if;
    insert into public.assets (org_id, site_id, asset_type_id, unit_no, type_model, location, source)
    values (v_org, v_site, v_row.asset_type_id, v_row.unit_no, v_row.type_model, v_row.location, 'import')
    returning id into v_asset;
    update public.import_rows set asset_id = v_asset where id = v_row.id;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'import job % has no row to add', p_job_id using errcode = '23514';
  end if;

  update public.import_jobs
  set status = 'committed', committed_at = now(), committed_by = auth.uid(), committed_count = v_count, updated_at = now()
  where id = p_job_id;
  return v_count;
end $$;

revoke execute on function public.commit_import(uuid) from public, anon;
grant execute on function public.commit_import(uuid) to authenticated;
