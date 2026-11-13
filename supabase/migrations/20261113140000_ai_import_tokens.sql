-- Records the Claude tokens each import job used, so the real cost of an AI import is known and the owner can see it. The allowance
-- stays a count of imports (plan_limits.ai_imports); tokens are shown, never enforced.

alter table public.import_jobs
  add column input_tokens bigint not null default 0 check (input_tokens >= 0),
  add column output_tokens bigint not null default 0 check (output_tokens >= 0);

-- Same function as before (20261027045548) with two optional arguments: the tokens the chunk's call used, added to the job's totals.
-- An old caller that passes neither adds nothing.
drop function public.record_extraction_chunk(uuid, integer, integer, jsonb);

create function public.record_extraction_chunk(
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
  insert into public.import_rows (org_id, job_id, position, asset_type_raw, unit_no, type_model, location, confidence, source_ref, asset_type_id)
  select v_org, p_job_id, v_base + e.ord,
         e.value ->> 'asset_type_raw', e.value ->> 'unit_no', e.value ->> 'type_model', e.value ->> 'location',
         e.value ->> 'confidence', e.value ->> 'source_ref', (e.value ->> 'asset_type_id')::uuid
  from jsonb_array_elements(p_rows) with ordinality as e(value, ord);
  return v_new;
end $$;

revoke execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) from public, anon;
grant execute on function public.record_extraction_chunk(uuid, integer, integer, jsonb, bigint, bigint) to authenticated;

-- org_usage gains the month's tokens beside the month's imports (same month window as the import count).
create or replace function public.org_usage()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_plan text;
  v_agreements_limit integer;
  v_imports_limit integer;
begin
  -- One org per person until there is an org switcher (decision 9).
  select m.org_id into v_org from public.memberships m where m.user_id = (select auth.uid()) limit 1;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to read usage' using errcode = '42501';
  end if;
  select b.plan, l.live_agreements, l.ai_imports into v_plan, v_agreements_limit, v_imports_limit
  from public.org_billing b join private.plan_limits l on l.plan = b.plan
  where b.org_id = v_org;
  return jsonb_build_object(
    'plan', v_plan,
    'live_agreements', jsonb_build_object(
      'used', (select count(*)::integer from public.agreements a where a.org_id = v_org and a.status in ('draft', 'sent', 'changes_requested')),
      'limit', v_agreements_limit),
    'ai_imports', jsonb_build_object(
      'used', (select count(*)::integer from public.import_jobs j
               where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1)),
      'limit', v_imports_limit,
      'input_tokens', (select coalesce(sum(j.input_tokens), 0)::bigint from public.import_jobs j
                       where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1)),
      'output_tokens', (select coalesce(sum(j.output_tokens), 0)::bigint from public.import_jobs j
                        where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1))),
    'resets_on', (private.month_start(1) at time zone 'America/Vancouver')::date);
end $$;
