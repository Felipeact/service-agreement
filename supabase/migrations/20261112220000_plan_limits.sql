-- plan-limits (.specs/features/plan-limits/plan.md): what each plan allows, enforced in the database.
-- Door 1: the limits live here, seeded from the draft price table in ROADMAP.md (`PLANS` in web/domain/billing). A parity test
-- keeps the two equal. Members cannot read the table; they learn a limit only through a refusal or `org_usage`.
-- Door 2: `import_jobs.extract_started_at` is what an AI import is: the moment a job's first extraction chunk is recorded.
-- Door 3: usage is computed on each read from `agreements` and `import_jobs`, never stored.

create table private.plan_limits (
  plan text primary key check (plan in ('starter', 'team', 'business')),
  live_agreements integer not null check (live_agreements > 0),
  ai_imports integer not null check (ai_imports > 0)
);

revoke all on private.plan_limits from public, anon, authenticated;

insert into private.plan_limits (plan, live_agreements, ai_imports) values
  ('starter', 15, 10),
  ('team', 60, 40),
  ('business', 200, 120);

alter table public.org_billing
  add constraint org_billing_plan_fkey foreign key (plan) references private.plan_limits (plan);

alter table public.import_jobs add column extract_started_at timestamptz;

-- Raises 55000 with hint `plan_limit_agreements` and detail `<plan>|<limit>|<used>` when the org holds as many live
-- agreements as its plan allows. An org with no billing row has no plan and no limit. Only a member of the org is told
-- anything; for anyone else it returns, so it cannot be used to read another org's plan.
create function private.assert_agreement_capacity(p_org uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  if not (select private.has_org_role(p_org, array['owner', 'admin', 'estimator', 'viewer'])) then
    return;
  end if;
  select b.plan, l.live_agreements into v_plan, v_limit
  from public.org_billing b join private.plan_limits l on l.plan = b.plan
  where b.org_id = p_org;
  if v_plan is null then
    return;
  end if;
  select count(*)::integer into v_used from public.agreements a
  where a.org_id = p_org and a.status in ('draft', 'sent', 'changes_requested');
  if v_used >= v_limit then
    raise exception 'the % plan allows % live agreements', v_plan, v_limit
      using errcode = '55000', hint = 'plan_limit_agreements', detail = v_plan || '|' || v_limit || '|' || v_used;
  end if;
end $$;

revoke execute on function private.assert_agreement_capacity(uuid) from public, anon;
grant execute on function private.assert_agreement_capacity(uuid) to authenticated;

-- The same function as before (20261103173437), with the capacity check after the per-org lock, so two creates in one org
-- cannot both pass at limit - 1.
create or replace function public.create_agreement(p_site_id uuid)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_inactive boolean;
  v_number text;
  v_agreement uuid;
begin
  select s.org_id into v_org from public.sites s where s.id = p_site_id;
  if v_org is null then
    raise exception 'site % not found', p_site_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to create an agreement for site %', p_site_id using errcode = '42501';
  end if;
  -- A create waits for a deactivation in flight instead of reading the site as active.
  select s.deactivated_at is not null into v_inactive from public.sites s where s.id = p_site_id for share;
  if v_inactive then
    raise exception 'site % is inactive', p_site_id using errcode = '55000', hint = 'site_inactive';
  end if;

  -- Two creates in one org take turns here, so they cannot read the same highest number.
  perform pg_advisory_xact_lock(hashtextextended('agreement_number:' || v_org::text, 0));
  perform private.assert_agreement_capacity(v_org);
  select 'AG-' || (coalesce(max(substring(a.number from '^AG-([0-9]+)$')::integer), 1000) + 1) into v_number
  from public.agreements a where a.org_id = v_org;

  insert into public.agreements (org_id, site_id, number) values (v_org, p_site_id, v_number)
  returning id into v_agreement;
  insert into public.agreement_versions (org_id, agreement_id, version_no, term_months)
  values (v_org, v_agreement, 1,
          coalesce((select s.default_term_months from public.org_settings s where s.org_id = v_org), 12));
  return v_agreement;
end $$;

-- The same function as before (20261027045548), stamping `extract_started_at` on the call that opens the job (null cursor).
create or replace function public.record_extraction_chunk(
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
      extract_started_at = case when p_expected_cursor is null then now() else extract_started_at end,
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

-- The first instant of the current calendar month in America/Vancouver, and of the next one.
create function private.month_start(p_offset integer default 0)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select (date_trunc('month', now() at time zone 'America/Vancouver') + make_interval(months => p_offset)) at time zone 'America/Vancouver'
$$;

-- How many AI imports the org of this job has started this month against its plan. Callable by owner, admin and estimator
-- (the roles that extract). P0002 for a missing job or one of another org, 42501 for a viewer. No billing row: allowed.
create function public.import_allowance(p_job_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  select j.org_id into v_org from public.import_jobs j where j.id = p_job_id;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator', 'viewer'])) then
    raise exception 'import job % not found', p_job_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change import job %', p_job_id using errcode = '42501';
  end if;
  select b.plan, l.ai_imports into v_plan, v_limit
  from public.org_billing b join private.plan_limits l on l.plan = b.plan
  where b.org_id = v_org;
  select count(*)::integer into v_used from public.import_jobs j
  where j.org_id = v_org and j.extract_started_at >= private.month_start() and j.extract_started_at < private.month_start(1);
  return jsonb_build_object(
    'plan', v_plan, 'used', v_used, 'limit', v_limit,
    'allowed', v_limit is null or v_used < v_limit,
    'resets_on', (private.month_start(1) at time zone 'America/Vancouver')::date);
end $$;

revoke execute on function public.import_allowance(uuid) from public, anon;
grant execute on function public.import_allowance(uuid) to authenticated;

-- Plan, live agreements and AI imports against the limits, for the caller's own org. Owner and admin only (decision 17:
-- money and plan figures). No billing row: the plan and both limits are null.
create function public.org_usage()
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
      'limit', v_imports_limit),
    'resets_on', (private.month_start(1) at time zone 'America/Vancouver')::date);
end $$;

revoke execute on function public.org_usage() from public, anon;
grant execute on function public.org_usage() to authenticated;
