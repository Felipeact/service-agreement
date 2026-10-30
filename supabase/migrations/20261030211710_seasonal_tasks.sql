-- Seasonal tasks: a checklist task can apply to the visits of some months only (.specs/features/seasonal-tasks,
-- doors 1 to 4). Frozen snapshots are not touched: schema 1 stays readable, and its tasks apply at every visit.

-- Door 1: the months of the visits a task applies at, by cadence's rule; null means every visit.
alter table private.catalog_asset_type_tasks
  add column visit_months smallint[],
  add constraint catalog_asset_type_tasks_visit_months_check
    check (visit_months is null or private.is_visit_months(visit_months));

alter table public.asset_type_tasks
  add column visit_months smallint[],
  add constraint asset_type_tasks_visit_months_check
    check (visit_months is null or private.is_visit_months(visit_months));

-- The three catalog tasks that name a season in their own words (AC 2): heating October to March, cooling April to
-- September.
update private.catalog_asset_type_tasks set visit_months = '{1,2,3,10,11,12}'
where (code, description) in (('RTU', 'Inspect heat exchanger during heating season'), ('ERV', 'Check heating operation'));
update private.catalog_asset_type_tasks set visit_months = '{4,5,6,7,8,9}'
where code = 'RTU' and description = 'Check compressor operation during cooling operation';

do $$ begin
  if (select count(*) from private.catalog_asset_type_tasks where visit_months is not null) <> 3 then
    raise exception 'seasonal_tasks: expected 3 seasonal catalog tasks';
  end if;
end $$;

-- Door 3: an org's copy of a catalog task takes its months, matched by type code and description (AC 4).
update public.asset_type_tasks k
set visit_months = c.visit_months
from public.asset_types t, private.catalog_asset_type_tasks c
where t.id = k.asset_type_id
  and t.org_id = k.org_id
  and c.code = t.code
  and c.description = k.description
  and c.visit_months is not null;

-- Door 4: as 20261030120000_cadence.sql (AD-008), and each copied task carries the catalog's months.
create or replace function private.seed_org_catalog(p_org uuid) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  with inserted as (
    insert into public.asset_types (org_id, code, name, default_visit_months)
    select p_org, c.code, c.name, c.default_visit_months
    from private.catalog_asset_types c
    on conflict (org_id, code) do nothing
    returning id, code
  ),
  tasks as (
    insert into public.asset_type_tasks (org_id, asset_type_id, position, description, visit_months)
    select p_org, i.id, t.position, t.description, t.visit_months
    from inserted i
    join private.catalog_asset_type_tasks t on t.code = i.code
  )
  select count(*) into n from inserted;
  return n;
end $$;

revoke execute on function private.seed_org_catalog(uuid) from public, anon, authenticated;

-- Door 2: the scope document is schema 2, and each task is {description, visitMonths}. Otherwise as
-- 20261027212052_service_included.sql (AD-059): read as the caller, so RLS decides what it holds.
create or replace function public.site_service_scope(p_site_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object('schema', 2, 'types', coalesce(jsonb_agg(g.doc order by g.name, g.code), '[]'::jsonb))
  from (
    select t.code, t.name, jsonb_build_object(
      'code', t.code,
      'name', t.name,
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('description', k.description, 'visitMonths', to_jsonb(k.visit_months))
                                          order by k.position, k.created_at, k.id)
                         from public.asset_type_tasks k
                         where k.asset_type_id = t.id and k.org_id = t.org_id), '[]'::jsonb),
      'assets', jsonb_agg(jsonb_build_object('unitNo', a.unit_no, 'typeModel', a.type_model, 'location', a.location)
                          order by a.unit_no nulls last, a.created_at, a.id)
    ) as doc
    from public.assets a
    join public.asset_types t on t.id = a.asset_type_id and t.org_id = a.org_id
    where a.site_id = p_site_id
    group by t.id, t.org_id, t.code, t.name
  ) g
$$;

revoke execute on function public.site_service_scope(uuid) from public, anon;
grant execute on function public.site_service_scope(uuid) to authenticated;
