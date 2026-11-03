-- Versioning door 1: who made a version and why. `reason` is the customer's change request for a revision, or a
-- staff note on a draft; `created_by` is stamped by the database (door 4) so a direct insert cannot name another author.
alter table public.agreement_versions
  add column created_by uuid references auth.users (id) on delete set null,
  add column reason text;

create function private.stamp_version_author() returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create trigger agreement_versions_stamp_author before insert on public.agreement_versions
  for each row execute function private.stamp_version_author();

-- Backfill: a revision's author is the actor of its `agreement.revised` event, and its reason is the change request it
-- answers (the one for the previous version, else the latest one before the revision). Version 1 and anything with no
-- event stay null.
update public.agreement_versions v
set created_by = r.actor_id,
    reason = (
      select c.payload ->> 'reason'
      from public.events c
      where c.entity_type = 'agreement' and c.entity_id = v.agreement_id and c.type = 'agreement.changes_requested'
        and c.created_at <= r.created_at
      order by (c.payload ->> 'versionNo' = (v.version_no - 1)::text) desc, c.created_at desc
      limit 1
    )
from public.events r
where r.entity_type = 'agreement' and r.entity_id = v.agreement_id and r.type = 'agreement.revised'
  and r.payload ->> 'versionNo' = v.version_no::text;

-- A revision starts with the change request that asked for it as its reason.
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
  -- their coverage.
  if p_event_type = 'agreement.revised' then
    select max(v.version_no) into v_version from public.agreement_versions v where v.agreement_id = p_agreement_id;
    select v.id into v_from from public.agreement_versions v
    where v.agreement_id = p_agreement_id and v.version_no = v_version;
    select e.payload ->> 'reason' into v_reason from public.events e
    where e.entity_type = 'agreement' and e.entity_id = p_agreement_id and e.type = 'agreement.changes_requested'
    order by e.created_at desc limit 1;
    insert into public.agreement_versions (org_id, agreement_id, version_no, snapshot, term_start, term_months, reason)
    select v_org, p_agreement_id, coalesce(v_version, 0) + 1, coalesce(f.snapshot, '{}'), f.term_start,
           coalesce(f.term_months, 12), v_reason
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

-- The staff note on the current version of a draft. A definer because `authenticated` has no update on
-- `agreement_versions` (AD-060); it checks the role itself and locks the agreement so it cannot interleave with a Send.
create function public.save_version_note(p_agreement_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select a.org_id into v_org from public.agreements a where a.id = p_agreement_id;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to change agreement %', p_agreement_id using errcode = '42501';
  end if;
  select a.status into v_status from public.agreements a where a.id = p_agreement_id for update;
  if v_status <> 'draft' then
    raise exception 'agreement % is not a draft', p_agreement_id using errcode = '55000', hint = 'not_editable';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'the note is longer than 500 characters' using errcode = '23514', hint = 'note_too_long';
  end if;
  update public.agreement_versions v set reason = v_note
  where v.agreement_id = p_agreement_id
    and v.version_no = (select max(x.version_no) from public.agreement_versions x where x.agreement_id = p_agreement_id);
end $$;

revoke execute on function public.save_version_note(uuid, text) from public, anon;
grant execute on function public.save_version_note(uuid, text) to authenticated;
