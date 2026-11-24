-- A row that says nothing but its type (no unit #, no type/model, no location) is a repeat when the site already has a bare unit of
-- that type, counted: a file with two bare walk-in freezers on a site that has one adds one. Re-importing the same list therefore
-- adds nothing, and a bare "Walk-in freezer" row is no longer the one row a second import slipped through. Otherwise the same
-- function as 20261117400000. Applied to the hosted project with the owner's request to fix re-import duplicates (2026-11-24).
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
  v_bare_used jsonb := '{}'::jsonb;
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
    if nullif(btrim(regexp_replace(lower(coalesce(v_row.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')), '') is not null then
      -- Tagged: same type and same unit #, including an asset this loop just added from an earlier included row.
      if exists (
        select 1 from public.assets a
        where a.site_id = v_site and a.asset_type_id = v_row.asset_type_id
          and btrim(regexp_replace(lower(coalesce(a.unit_no, '')), '[^[:alnum:]]+', ' ', 'g'))
            = btrim(regexp_replace(lower(coalesce(v_row.unit_no, '')), '[^[:alnum:]]+', ' ', 'g'))
      ) then
        update public.import_rows set skipped = true where id = v_row.id;
        continue;
      end if;
    elsif (
      nullif(btrim(regexp_replace(lower(coalesce(v_row.type_model, '')), '[^[:alnum:]]+', ' ', 'g')), '') is not null
      or nullif(btrim(regexp_replace(lower(coalesce(v_row.location, '')), '[^[:alnum:]]+', ' ', 'g')), '') is not null
    ) and exists (
      select 1 from public.assets a
      where a.site_id = v_site and a.asset_type_id = v_row.asset_type_id
        and nullif(btrim(regexp_replace(lower(coalesce(a.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
        and btrim(regexp_replace(lower(coalesce(a.type_model, '')), '[^[:alnum:]]+', ' ', 'g'))
          = btrim(regexp_replace(lower(coalesce(v_row.type_model, '')), '[^[:alnum:]]+', ' ', 'g'))
        and btrim(regexp_replace(lower(coalesce(a.location, '')), '[^[:alnum:]]+', ' ', 'g'))
          = btrim(regexp_replace(lower(coalesce(v_row.location, '')), '[^[:alnum:]]+', ' ', 'g'))
        and a.id not in (select r.asset_id from public.import_rows r where r.job_id = p_job_id and r.asset_id is not null)
    ) then
      update public.import_rows set skipped = true where id = v_row.id;
      continue;
    elsif nullif(btrim(regexp_replace(lower(coalesce(v_row.type_model, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
      and nullif(btrim(regexp_replace(lower(coalesce(v_row.location, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
      and (
        select count(*) from public.assets a
        where a.site_id = v_site and a.asset_type_id = v_row.asset_type_id
          and nullif(btrim(regexp_replace(lower(coalesce(a.unit_no, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
          and nullif(btrim(regexp_replace(lower(coalesce(a.type_model, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
          and nullif(btrim(regexp_replace(lower(coalesce(a.location, '')), '[^[:alnum:]]+', ' ', 'g')), '') is null
          and a.id not in (select r.asset_id from public.import_rows r where r.job_id = p_job_id and r.asset_id is not null)
      ) > coalesce((v_bare_used ->> v_row.asset_type_id::text)::integer, 0)
    then
      v_bare_used := v_bare_used || jsonb_build_object(v_row.asset_type_id::text, coalesce((v_bare_used ->> v_row.asset_type_id::text)::integer, 0) + 1);
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
