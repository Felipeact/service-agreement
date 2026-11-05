-- Global search (.specs/features/global-search/plan.md, door 1): one read that finds customers, sites and units whose
-- searched text contains the query. No table or column changes.
--
-- It runs as the caller (security invoker), so the select policies on customers, sites, assets and asset_types decide
-- which org's rows exist for the caller (AD-015). The match is a plain substring (position, not ilike), so %, _ and \
-- in the query are ordinary characters. Inactive rows, and rows under an inactive parent, are left out (AD-116).
-- Per kind: names that start with the text first, then by title, then by id; at most p_limit rows (clamped 1 to 100).
-- A blank query returns no row.
--
-- kind        customer                site                      asset
-- title       customer name           site name                 unit number
-- customer_name  customer name        customer name             customer name
-- site_id     null                    the site                  the unit's site
-- site_name   null                    site name                 the unit's site name
-- address     null                    site address              null
-- type_name   null                    null                      equipment type name

create function public.search_records(p_query text, p_limit integer)
returns table (kind text, id uuid, title text, customer_name text, site_id uuid, site_name text, address text, type_name text)
language sql stable security invoker
set search_path = ''
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''), E' \t\r\n')) as t,
           greatest(1, least(100, coalesce(p_limit, 1))) as n
  ),
  hit_c as (
    select 0 as k, 'customer'::text as kind, cu.id, cu.name as title, cu.name as customer_name,
           null::uuid as site_id, null::text as site_name, null::text as address, null::text as type_name,
           row_number() over (order by (position(q.t in lower(cu.name)) <> 1), cu.name, cu.id) as o
    from q
    cross join public.customers cu
    where q.t <> '' and cu.deactivated_at is null and position(q.t in lower(cu.name)) > 0
  ),
  hit_s as (
    select 1 as k, 'site'::text as kind, si.id, si.name as title, cu.name as customer_name,
           si.id as site_id, si.name as site_name, si.address, null::text as type_name,
           row_number() over (order by (position(q.t in lower(si.name)) <> 1), si.name, si.id) as o
    from q
    cross join public.sites si
    join public.customers cu on cu.id = si.customer_id
    where q.t <> '' and si.deactivated_at is null and cu.deactivated_at is null
      and (position(q.t in lower(si.name)) > 0 or position(q.t in lower(coalesce(si.address, ''))) > 0)
  ),
  hit_a as (
    select 2 as k, 'asset'::text as kind, a.id, a.unit_no as title, cu.name as customer_name,
           si.id as site_id, si.name as site_name, null::text as address, t.name as type_name,
           row_number() over (order by (position(q.t in lower(a.unit_no)) <> 1), a.unit_no, a.id) as o
    from q
    cross join public.assets a
    join public.sites si on si.id = a.site_id
    join public.customers cu on cu.id = si.customer_id
    join public.asset_types t on t.id = a.asset_type_id
    where q.t <> '' and a.deactivated_at is null and si.deactivated_at is null and cu.deactivated_at is null
      and position(q.t in lower(coalesce(a.unit_no, ''))) > 0
  )
  select u.kind, u.id, u.title, u.customer_name, u.site_id, u.site_name, u.address, u.type_name
  from (select * from hit_c union all select * from hit_s union all select * from hit_a) u
  cross join q
  where u.o <= q.n
  order by u.k, u.o
$$;

revoke execute on function public.search_records(text, integer) from public, anon;
grant execute on function public.search_records(text, integer) to authenticated;
