-- agreement-templates (.specs/features/agreement-templates/plan.md): an agreement draws its intro, closing text and shown
-- sections from an immutable template version that it points at, and a template can preset the first service lines.
-- Door 1: several agreement templates per org. The one-per-org-per-kind index becomes partial (contracts keep one per org); a
-- separate partial index keeps exactly one system template per kind. `archived_at` retires a template without deleting its
-- versions, which sent agreements still point at.
-- Door 2: body = { "schema": 1, "name", "description", "intro": [Block], "footer": [Block],
-- "sections": { "schedule", "scope" }, "preset": { "termMonths", "lines": [ { "description", "visitMonths",
-- "assetTypeCodes", "costPerVisitCents" } ] } }; a Block is the contract template's heading, paragraph or clause. A parity test
-- keeps the system body equal to SYSTEM_AGREEMENT_BODY in web/domain/agreement/template.ts.
-- Door 3: agreement_versions.template_version_id. Set by create_agreement when a template is used, set by send_agreement to the
-- system agreement version while still null (before the transition, while the version is still a draft), copied by a revise,
-- and refused once the version is no longer the latest of a draft agreement (the rule service_lines_frozen uses).
-- Door 4: save_agreement_template and archive_agreement_template are the only writers; members have no insert on either table.

-- Door 1.
alter table public.document_templates add column archived_at timestamptz;
drop index public.document_templates_one_per_org_kind;
create unique index document_templates_one_contract_per_org
  on public.document_templates (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
  where kind = 'contract';
create unique index document_templates_one_system_per_kind
  on public.document_templates (kind) where org_id is null;

-- The system agreement template and its version 1: no text, every optional section shown, no preset.
insert into public.document_templates (id, org_id, kind)
values ('00000000-0000-4000-8000-00000000c002', null, 'agreement');
insert into public.document_template_versions (id, template_id, org_id, version_no, body)
values ('00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-00000000c002', null, 1,
        $body${"schema":1,"name":"Standard agreement","description":"","intro":[],"footer":[],"sections":{"schedule":true,"scope":true},"preset":{"termMonths":null,"lines":[]}}$body$::jsonb);

-- Door 3: the pin. Existing versions keep a null pin, which a sent one reads as the system version 1.
alter table public.agreement_versions
  add column template_version_id uuid references public.document_template_versions (id);
create index agreement_versions_template_version_id_idx on public.agreement_versions (template_version_id);

-- The pin of a version that is not the latest of a draft agreement never changes. A definer so the agreement is read past RLS;
-- it applies to the table owner too (members have no update grant on the table at all).
create function private.agreement_version_pin_frozen()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_open boolean;
begin
  select a.status = 'draft' and old.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = a.id)
  into v_open
  from public.agreements a where a.id = old.agreement_id;
  if v_open is not true then
    raise exception 'the template of agreement version % cannot be changed', old.id using errcode = '55000', hint = 'template_pin_frozen';
  end if;
  return new;
end $$;

revoke execute on function private.agreement_version_pin_frozen() from public, anon, authenticated;

create trigger agreement_versions_pin_frozen
  before update of template_version_id on public.agreement_versions
  for each row when (old.template_version_id is distinct from new.template_version_id)
  execute function private.agreement_version_pin_frozen();

-- Door 2, the database side of the body shape. Returns why a body cannot be stored, or null. The variable names are not
-- checked here: web/domain/agreement/template.ts rejects an unknown one on save, and an unknown one renders as no value.
create function private.jsonb_has_exactly_keys(p_value jsonb, p_keys text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
     and (select count(*) from jsonb_object_keys(p_value)) = cardinality(p_keys)
     and p_value ?& p_keys
$$;

revoke execute on function private.jsonb_has_exactly_keys(jsonb, text[]) from public, anon, authenticated;

create function private.agreement_template_problem(p_body jsonb)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_list text;
  v_block jsonb;
  v_line jsonb;
  v_month jsonb;
  v_code jsonb;
  v_seen integer[];
  v_value integer;
begin
  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    return 'the body must be an object';
  end if;
  if octet_length(p_body::text) > 65536 then
    return 'the body is over 64 KB';
  end if;
  if not private.jsonb_has_exactly_keys(p_body, array['schema', 'name', 'description', 'intro', 'footer', 'sections', 'preset']) then
    return 'the body must have exactly the keys schema, name, description, intro, footer, sections and preset';
  end if;
  if p_body -> 'schema' <> '1'::jsonb then
    return 'schema must be 1';
  end if;
  if jsonb_typeof(p_body -> 'name') <> 'string' or char_length(btrim(p_body ->> 'name')) not between 1 and 80 then
    return 'name must be 1 to 80 characters';
  end if;
  if jsonb_typeof(p_body -> 'description') <> 'string' or char_length(p_body ->> 'description') > 300 then
    return 'description must be at most 300 characters';
  end if;

  foreach v_list in array array['intro', 'footer'] loop
    if jsonb_typeof(p_body -> v_list) <> 'array' then
      return v_list || ' must be a list';
    end if;
    if jsonb_array_length(p_body -> v_list) > 30 then
      return v_list || ' has more than 30 blocks';
    end if;
    for v_block in select e from jsonb_array_elements(p_body -> v_list) e loop
      if not private.jsonb_has_exactly_keys(v_block, array['type', 'text'])
         or v_block ->> 'type' is null or v_block ->> 'type' not in ('heading', 'paragraph', 'clause')
         or jsonb_typeof(v_block -> 'text') <> 'string'
         or char_length(v_block ->> 'text') not between 1 and 2000 then
        return v_list || ' has a block that is not a heading, paragraph or clause of 1 to 2,000 characters';
      end if;
    end loop;
  end loop;

  if not private.jsonb_has_exactly_keys(p_body -> 'sections', array['schedule', 'scope'])
     or jsonb_typeof(p_body #> '{sections,schedule}') <> 'boolean' or jsonb_typeof(p_body #> '{sections,scope}') <> 'boolean' then
    return 'sections must be { schedule, scope }, each true or false';
  end if;

  if not private.jsonb_has_exactly_keys(p_body -> 'preset', array['termMonths', 'lines']) then
    return 'preset must be { termMonths, lines }';
  end if;
  -- 60 is the most an agreement version can hold (agreement_versions.term_months).
  if jsonb_typeof(p_body #> '{preset,termMonths}') <> 'null'
     and (jsonb_typeof(p_body #> '{preset,termMonths}') <> 'number'
          or (p_body #>> '{preset,termMonths}')::numeric <> trunc((p_body #>> '{preset,termMonths}')::numeric)
          or (p_body #>> '{preset,termMonths}')::numeric not between 1 and 60) then
    return 'termMonths must be empty or a whole number of months from 1 to 60';
  end if;
  if jsonb_typeof(p_body #> '{preset,lines}') <> 'array' then
    return 'preset lines must be a list';
  end if;
  if jsonb_array_length(p_body #> '{preset,lines}') > 20 then
    return 'preset has more than 20 lines';
  end if;
  for v_line in select e from jsonb_array_elements(p_body #> '{preset,lines}') e loop
    if not private.jsonb_has_exactly_keys(v_line, array['description', 'visitMonths', 'assetTypeCodes', 'costPerVisitCents'])
       or jsonb_typeof(v_line -> 'description') <> 'string'
       or char_length(btrim(v_line ->> 'description')) not between 1 and 2000 then
      return 'a preset line must be { description, visitMonths, assetTypeCodes, costPerVisitCents } with a description';
    end if;
    if jsonb_typeof(v_line -> 'visitMonths') <> 'array' or jsonb_array_length(v_line -> 'visitMonths') not between 1 and 12 then
      return 'a preset line needs 1 to 12 visit months';
    end if;
    v_seen := '{}';
    for v_month in select e from jsonb_array_elements(v_line -> 'visitMonths') e loop
      if jsonb_typeof(v_month) <> 'number' or (v_month #>> '{}')::numeric <> trunc((v_month #>> '{}')::numeric)
         or (v_month #>> '{}')::numeric not between 1 and 12 then
        return 'a visit month must be a whole number from 1 to 12';
      end if;
      v_value := (v_month #>> '{}')::numeric::integer;
      if v_value = any (v_seen) then
        return 'a visit month is repeated';
      end if;
      v_seen := v_seen || v_value;
    end loop;
    if jsonb_typeof(v_line -> 'assetTypeCodes') <> 'array' then
      return 'assetTypeCodes must be a list';
    end if;
    for v_code in select e from jsonb_array_elements(v_line -> 'assetTypeCodes') e loop
      if jsonb_typeof(v_code) <> 'string' or char_length(btrim(v_code #>> '{}')) not between 1 and 80 then
        return 'an equipment type code must be 1 to 80 characters';
      end if;
    end loop;
    if jsonb_typeof(v_line -> 'costPerVisitCents') <> 'null'
       and (jsonb_typeof(v_line -> 'costPerVisitCents') <> 'number'
            or (v_line ->> 'costPerVisitCents')::numeric <> trunc((v_line ->> 'costPerVisitCents')::numeric)
            or (v_line ->> 'costPerVisitCents')::numeric not between 0 and 1000000000000) then
      return 'a price per visit must be empty or a whole number of cents, not negative';
    end if;
  end loop;
  return null;
end $$;

revoke execute on function private.agreement_template_problem(jsonb) from public, anon, authenticated;

-- Door 4. Saves a template: a new one when p_template_id is null (in the caller's org), else the next version of that one.
-- 42501 for a caller who is no member of any org or not owner or admin of the template's org; P0002 for an id that is not an
-- agreement template of the caller's own orgs (or is archived); 22023 for a body that cannot be stored; 23505 when another
-- non-archived template of the org already has the name, ignoring case.
create function public.save_agreement_template(p_template_id uuid, p_body jsonb)
returns table (template_id uuid, version_no integer)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_template uuid := p_template_id;
  v_problem text;
  v_no integer;
begin
  if v_user is null or not exists (select 1 from public.memberships m where m.user_id = v_user) then
    raise exception 'not allowed to save agreement templates' using errcode = '42501';
  end if;
  if p_template_id is null then
    select m.org_id into v_org from public.memberships m where m.user_id = v_user limit 1;
  else
    select t.org_id into v_org from public.document_templates t
    where t.id = p_template_id and t.kind = 'agreement' and t.org_id is not null and t.archived_at is null;
    if v_org is null or not exists (select 1 from public.memberships m where m.user_id = v_user and m.org_id = v_org) then
      raise exception 'agreement template % not found', p_template_id using errcode = 'P0002';
    end if;
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to save agreement templates' using errcode = '42501';
  end if;

  v_problem := private.agreement_template_problem(p_body);
  if v_problem is not null then
    raise exception 'invalid agreement template: %', v_problem using errcode = '22023';
  end if;

  -- Two saves in one org take turns, so neither reads a version number or a name the other is about to take.
  perform pg_advisory_xact_lock(hashtextextended('agreement_template:' || v_org::text, 0));
  if exists (
    select 1 from public.document_templates t
    join lateral (select tv.body from public.document_template_versions tv
                  where tv.template_id = t.id order by tv.version_no desc limit 1) l on true
    where t.org_id = v_org and t.kind = 'agreement' and t.archived_at is null and t.id is distinct from p_template_id
      and lower(btrim(l.body ->> 'name')) = lower(btrim(p_body ->> 'name'))) then
    raise exception 'a template named "%" already exists', btrim(p_body ->> 'name')
      using errcode = '23505', hint = 'template_name_taken';
  end if;

  if p_template_id is null then
    insert into public.document_templates (org_id, kind) values (v_org, 'agreement') returning id into v_template;
  end if;
  select coalesce(max(tv.version_no), 0) + 1 into v_no from public.document_template_versions tv where tv.template_id = v_template;
  insert into public.document_template_versions (template_id, org_id, version_no, body)
  values (v_template, v_org, v_no, p_body);
  return query select v_template, v_no;
end $$;

revoke execute on function public.save_agreement_template(uuid, jsonb) from public, anon;
grant execute on function public.save_agreement_template(uuid, jsonb) to authenticated;

-- Door 4. Retires a template from the list and the picker. Sets `archived_at` once; a second call changes nothing. Its versions
-- and the agreements pinned to them are untouched. Same errors as the save for who and what.
create function public.archive_agreement_template(p_template_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
begin
  if v_user is null or not exists (select 1 from public.memberships m where m.user_id = v_user) then
    raise exception 'not allowed to archive agreement templates' using errcode = '42501';
  end if;
  select t.org_id into v_org from public.document_templates t
  where t.id = p_template_id and t.kind = 'agreement' and t.org_id is not null;
  if v_org is null or not exists (select 1 from public.memberships m where m.user_id = v_user and m.org_id = v_org) then
    raise exception 'agreement template % not found', p_template_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin'])) then
    raise exception 'not allowed to archive agreement templates' using errcode = '42501';
  end if;
  update public.document_templates t set archived_at = now() where t.id = p_template_id and t.archived_at is null;
end $$;

revoke execute on function public.archive_agreement_template(uuid) from public, anon;
grant execute on function public.archive_agreement_template(uuid) to authenticated;

-- Copies a preset's lines into a version, as the member who creates the agreement (RLS and the line triggers apply). A code
-- that matches no equipment type of the org is left off its line; the line is still created. A null price becomes 0.
create function private.apply_template_preset(p_version_id uuid, p_org uuid, p_body jsonb)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_line record;
  v_id uuid;
begin
  for v_line in
    select e.value as line, e.ord from jsonb_array_elements(p_body #> '{preset,lines}') with ordinality as e(value, ord)
  loop
    insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                      cost_per_visit_cents)
    select p_org, p_version_id, (v_line.ord - 1)::integer, v_line.line ->> 'description', m.months, cardinality(m.months),
           coalesce((v_line.line ->> 'costPerVisitCents')::numeric::bigint, 0)
    from (select array(select distinct (x.value #>> '{}')::numeric::smallint
                       from jsonb_array_elements(v_line.line -> 'visitMonths') x order by 1) as months) m
    returning id into v_id;
    insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
    select p_org, v_id, t.id from public.asset_types t
    where t.org_id = p_org
      and t.code in (select c.value #>> '{}' from jsonb_array_elements(v_line.line -> 'assetTypeCodes') c);
  end loop;
end $$;

revoke execute on function private.apply_template_preset(uuid, uuid, jsonb) from public, anon;
grant execute on function private.apply_template_preset(uuid, uuid, jsonb) to authenticated;

-- Door 3. The same function as before (20261112220000: role, site-inactive, per-org lock, plan capacity, numbering, default
-- term), with an optional template version. The old one-argument function is dropped so one function answers the rpc.
-- 22023 for a version that is not an agreement template version of the org or the system (one of another org is not visible
-- to the caller, so it reads as unknown). The preset's term replaces the default term only when it is not null.
drop function public.create_agreement(uuid);

create function public.create_agreement(p_site_id uuid, p_template_version_id uuid default null)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_inactive boolean;
  v_number text;
  v_agreement uuid;
  v_version uuid;
  v_body jsonb;
  v_term smallint;
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

  if p_template_version_id is not null then
    select tv.body into v_body
    from public.document_template_versions tv join public.document_templates t on t.id = tv.template_id
    where tv.id = p_template_version_id and t.kind = 'agreement' and (tv.org_id is null or tv.org_id = v_org);
    if v_body is null then
      raise exception 'template version % is not an agreement template of this org', p_template_version_id using errcode = '22023';
    end if;
  end if;

  select 'AG-' || (coalesce(max(substring(a.number from '^AG-([0-9]+)$')::integer), 1000) + 1) into v_number
  from public.agreements a where a.org_id = v_org;

  v_term := coalesce((v_body #>> '{preset,termMonths}')::numeric::smallint,
                     (select s.default_term_months from public.org_settings s where s.org_id = v_org), 12);
  insert into public.agreements (org_id, site_id, number) values (v_org, p_site_id, v_number)
  returning id into v_agreement;
  insert into public.agreement_versions (org_id, agreement_id, version_no, term_months, template_version_id)
  values (v_org, v_agreement, 1, v_term, p_template_version_id)
  returning id into v_version;
  if v_body is not null then
    perform private.apply_template_preset(v_version, v_org, v_body);
  end if;
  return v_agreement;
end $$;

revoke execute on function public.create_agreement(uuid, uuid) from public, anon;
grant execute on function public.create_agreement(uuid, uuid) to authenticated;

-- Door 3. Pins the system agreement template's latest version on the latest version of a draft agreement while it has no pin.
-- A definer because members have no update grant on agreement_versions. It checks the role and the status itself and does
-- nothing otherwise, so the transition that follows in send_agreement still decides the error for a missing agreement, a
-- caller who may not send, or a status that is no longer draft.
create function private.pin_system_agreement_template(p_agreement_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.agreement_versions v
  set template_version_id = (select tv.id from public.document_template_versions tv
                             join public.document_templates t on t.id = tv.template_id
                             where t.kind = 'agreement' and t.org_id is null order by tv.version_no desc limit 1)
  where v.agreement_id = p_agreement_id and v.template_version_id is null
    and v.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = p_agreement_id)
    and exists (select 1 from public.agreements a
                where a.id = v.agreement_id and a.status = 'draft'
                  and (select private.has_org_role(a.org_id, array['owner', 'admin', 'estimator'])));
end $$;

revoke execute on function private.pin_system_agreement_template(uuid) from public, anon;
grant execute on function private.pin_system_agreement_template(uuid) to authenticated;

-- Door 3. The same function as before (20261102222043), pinning the system template first while the version is still a draft.
create or replace function public.send_agreement(p_agreement_id uuid, p_token_hash text, p_event_type text, p_payload jsonb, p_token_sealed text)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_event uuid;
  v_version uuid;
  v_start date;
begin
  if p_event_type is distinct from 'agreement.sent' then
    raise exception 'send_agreement writes agreement.sent only' using errcode = '23514';
  end if;

  perform private.pin_system_agreement_template(p_agreement_id);
  v_event := public.apply_agreement_transition(p_agreement_id, 'draft', 'sent', p_event_type, p_payload);

  -- After the status update, which holds the agreement's row: a line or a term cannot change meanwhile.
  select v.id, v.term_start into v_version, v_start from public.agreement_versions v
  where v.agreement_id = p_agreement_id order by v.version_no desc limit 1;
  if not exists (select 1 from public.service_lines l where l.agreement_version_id = v_version) then
    raise exception 'agreement % has no service line', p_agreement_id using errcode = '23514';
  end if;
  if v_start is null then
    raise exception 'agreement % has no term start date', p_agreement_id using errcode = '23514', hint = 'no_term_start';
  end if;

  perform private.stamp_valid_until(p_agreement_id);
  perform private.issue_portal_link(p_agreement_id, p_token_hash, p_token_sealed);
  return v_event;
end $$;

revoke execute on function public.send_agreement(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.send_agreement(uuid, text, text, jsonb, text) to authenticated;

-- Door 3. The same function as before (20261104090000): a revision copies the pin of the version it copies.
create or replace function public.apply_agreement_transition(
  p_agreement_id uuid,
  p_expected_status text,
  p_to_status text,
  p_event_type text,
  p_payload jsonb
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_version integer;
  v_from uuid;
  v_to uuid;
  v_event uuid;
  v_line record;
  v_copy uuid;
  v_reason text;
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null then
    raise exception 'agreement % not found', p_agreement_id using errcode = 'P0002';
  end if;
  if not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;

  update public.agreements set status = p_to_status, updated_at = now()
  where id = p_agreement_id and status = p_expected_status;
  if not found then
    raise exception 'agreement % is no longer %', p_agreement_id, p_expected_status using errcode = '40001';
  end if;

  -- A draft that stops being a draft keeps what it covered at that moment.
  if p_expected_status = 'draft' then
    perform private.freeze_agreement_version(p_agreement_id);
  end if;

  -- A revision starts the next version from the content of the current one: its snapshot, its term, its lines and
  -- their coverage, and the template version it was drawn from.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    select e.payload ->> 'reason' into v_reason from public.events e
    where e.entity_type = 'agreement' and e.entity_id = p_agreement_id and e.type = 'agreement.changes_requested'
    order by e.created_at desc limit 1;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot, term_start, term_months, reason,
                                           template_version_id)
    select v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(f.snapshot, '{}'), f.term_start,
           coalesce(f.term_months, 12), v_reason, f.template_version_id
    from (select 1) one
    left join public.agreement_versions f on f.id = v_from
    returning id into v_to;
    for v_line in
      select l.id, l.org_id, l.position, l.description, l.visit_months, l.visits_per_year, l.cost_per_visit_cents
      from public.service_lines l
      where l.agreement_version_id = v_from
      order by l.position, l.created_at
    loop
      insert into public.service_lines (org_id, agreement_version_id, position, description, visit_months, visits_per_year,
                                        cost_per_visit_cents)
      values (v_line.org_id, v_to, v_line.position, v_line.description, v_line.visit_months, v_line.visits_per_year,
              v_line.cost_per_visit_cents)
      returning id into v_copy;
      insert into public.service_line_asset_types (org_id, service_line_id, asset_type_id)
      select c.org_id, v_copy, c.asset_type_id from public.service_line_asset_types c where c.service_line_id = v_line.id;
    end loop;
  end if;

  insert into public.events (org_id, entity_type, entity_id, type, payload, actor_id)
  values (v_org, 'agreement', p_agreement_id, p_event_type, p_payload, auth.uid())
  returning id into v_event;
  perform private.enqueue_outbox(v_event);
  return v_event;
end $$;

revoke execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.apply_agreement_transition(uuid, text, text, text, jsonb) to authenticated;

-- Door 3, review page: portal_view returns `template`, the body of the version's pinned template version (the system version 1
-- while the pin is null: a version sent before this feature was drawn from it). Otherwise as 20261111100000_tenant_logo.sql.
create or replace function public.portal_view(p_token_hash text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_link public.portal_links;
  v_version public.agreement_versions;
  v_agreement public.agreements;
  v_current boolean;
  v_decision jsonb;
  v_tenant jsonb;
begin
  select * into v_link from public.portal_links l where l.token_hash = p_token_hash;
  if not found then
    return null;
  end if;
  select * into v_version from public.agreement_versions v where v.id = v_link.agreement_version_id and v.org_id = v_link.org_id;
  select * into v_agreement from public.agreements a where a.id = v_version.agreement_id and a.org_id = v_link.org_id;
  v_current := v_version.version_no = (select max(w.version_no) from public.agreement_versions w where w.agreement_id = v_agreement.id);

  if v_agreement.status in ('accepted', 'refused', 'changes_requested') then
    select jsonb_build_object('status', v_agreement.status, 'decidedAt', e.created_at, 'reason', e.payload -> 'reason')
    into v_decision
    from public.events e
    where e.org_id = v_agreement.org_id and e.entity_type = 'agreement' and e.entity_id = v_agreement.id
      and e.type = 'agreement.' || v_agreement.status
    order by e.created_at desc, e.id limit 1;
  end if;

  select jsonb_build_object('name', s.legal_name, 'address', s.address, 'phone', s.phone, 'accent', s.accent_color,
                            'itemSingular', s.item_singular, 'itemPlural', s.item_plural, 'logoPath', s.logo_path)
  into v_tenant from public.org_settings s where s.org_id = v_link.org_id;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'versionNo', v_version.version_no,
      'current', v_current,
      'revoked', v_link.revoked_at is not null,
      'revokedAt', v_link.revoked_at,
      'firstViewedAt', v_link.first_viewed_at),
    'agreement', jsonb_build_object('number', v_agreement.number, 'status', v_agreement.status),
    'tenant', v_tenant,
    'customer', (select jsonb_build_object('name', c.name) from public.sites s
                 join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
                 where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'site', (select jsonb_build_object('name', s.name) from public.sites s
             where s.id = v_agreement.site_id and s.org_id = v_agreement.org_id),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
                  'description', l.description,
                  'visitsPerYear', l.visits_per_year,
                  'costPerVisitCents', l.cost_per_visit_cents,
                  'annualCents', l.visits_per_year * l.cost_per_visit_cents,
                  'visitMonths', to_jsonb(l.visit_months),
                  'equipment', coalesce((select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name) order by t.name, t.code)
                                         from public.service_line_asset_types c
                                         join public.asset_types t on t.id = c.asset_type_id and t.org_id = c.org_id
                                         where c.service_line_id = l.id and c.org_id = l.org_id), '[]'::jsonb))
                order by l.position, l.created_at, l.id)
              from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), '[]'::jsonb),
    'annualCents', coalesce((select sum(l.visits_per_year * l.cost_per_visit_cents)
                             from public.service_lines l where l.agreement_version_id = v_version.id and l.org_id = v_version.org_id), 0),
    'scope', case when v_version.snapshot = '{}'::jsonb then null else v_version.snapshot - 'terms' end,
    'terms', v_version.snapshot -> 'terms',
    'term', jsonb_build_object(
      'start', to_char(v_version.term_start, 'YYYY-MM-DD'),
      'months', v_version.term_months,
      'end', to_char(v_version.term_end, 'YYYY-MM-DD')),
    'version', jsonb_build_object('validUntil', to_char(v_version.valid_until, 'YYYY-MM-DD')),
    'template', (select tv.body from public.document_template_versions tv
                 where tv.id = coalesce(v_version.template_version_id, '00000000-0000-4000-8000-00000000c102')),
    'today', to_char((now() at time zone 'America/Vancouver')::date, 'YYYY-MM-DD'),
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;
