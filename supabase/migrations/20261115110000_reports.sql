-- Reporting (.specs/features/reporting/plan.md). Seven read-only report functions over agreements, their latest version, service lines
-- and the events log. All are security invoker, so the select policies decide which org's rows exist for the caller (AD-015), as
-- search_records does. No table or column changes.
--
-- Access (decision 17): owner and admin see money; an estimator sees the operational reports with money columns null; a viewer and
-- a non-member get 42501. Reads stay open for a frozen org (AD-189 refuses writes only), so the check is the membership role alone.
-- Dates count under the event measured, in America/Vancouver (door 2).
-- Live value = visits per year x cost per visit, summed over the lines of an agreement's latest version, in cents.
-- In term = accepted, with today (America/Vancouver) between the latest version's term_start and term_end.

-- The org the app acts for (the oldest membership, as private.current_org) when the caller holds one of the roles; 42501 otherwise.
create function private.report_org(p_roles text[])
returns uuid
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_role text;
begin
  select x.org_id, x.role into v_org, v_role
  from public.memberships x
  where x.user_id = (select auth.uid())
  order by x.created_at, x.id
  limit 1;
  if v_org is null or not (v_role = any (p_roles)) then
    raise exception 'reports are not available to this role' using errcode = '42501';
  end if;
  return v_org;
end $$;

-- Whether the caller sees money: an owner or admin of the org the app acts for.
create function private.report_money()
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select coalesce((
    select m.role in ('owner', 'admin') from public.memberships m
    where m.user_id = (select auth.uid())
    order by m.created_at, m.id
    limit 1
  ), false)
$$;

-- One row per agreement of the org: its latest version, live value and whether it is in term.
create function private.report_base(p_org uuid)
returns table (id uuid, number text, status text, created_at timestamptz, updated_at timestamptz, site_name text, customer_id uuid,
               customer_name text, version_id uuid, term_start date, term_end date, value_cents bigint, in_term boolean)
language sql stable security invoker
set search_path = ''
as $$
  select a.id, a.number, a.status, a.created_at, a.updated_at, s.name, c.id, c.name, v.id, v.term_start, v.term_end,
         coalesce((select sum(l.visits_per_year::bigint * l.cost_per_visit_cents)
                   from public.service_lines l where l.agreement_version_id = v.id and l.org_id = v.org_id), 0)::bigint,
         coalesce(a.status = 'accepted' and v.term_start is not null
                  and (now() at time zone 'America/Vancouver')::date between v.term_start and v.term_end, false)
  from public.agreements a
  join public.sites s on s.id = a.site_id and s.org_id = a.org_id
  join public.customers c on c.id = s.customer_id and c.org_id = s.org_id
  left join lateral (
    select w.* from public.agreement_versions w where w.agreement_id = a.id and w.org_id = a.org_id order by w.version_no desc limit 1
  ) v on true
  where a.org_id = p_org
$$;

-- The events of each agreement, with a contract's completion mapped back to its agreement; d is the America/Vancouver date.
create function private.report_events(p_org uuid)
returns table (agreement_id uuid, type text, at timestamptz, d date, payload jsonb)
language sql stable security invoker
set search_path = ''
as $$
  select e.entity_id, e.type, e.created_at, (e.created_at at time zone 'America/Vancouver')::date, e.payload
  from public.events e where e.org_id = p_org and e.entity_type = 'agreement'
  union all
  select v.agreement_id, e.type, e.created_at, (e.created_at at time zone 'America/Vancouver')::date, e.payload
  from public.events e
  join public.contracts k on k.id = e.entity_id and k.org_id = e.org_id
  join public.agreement_versions v on v.id = k.agreement_version_id and v.org_id = k.org_id
  where e.org_id = p_org and e.entity_type = 'contract' and e.type = 'contract.completed'
$$;

revoke execute on function private.report_org(text[]) from public, anon;
revoke execute on function private.report_money() from public, anon;
revoke execute on function private.report_base(uuid) from public, anon;
revoke execute on function private.report_events(uuid) from public, anon;
grant execute on function private.report_org(text[]) to authenticated;
grant execute on function private.report_money() to authenticated;
grant execute on function private.report_base(uuid) to authenticated;
grant execute on function private.report_events(uuid) to authenticated;

-- Headline (money). Recurring revenue and pipeline value are as of today; the decision counts and the days to sign use the range.
-- A decision is an accepted, refused or expired event, once per agreement and type; an agreement renewed on its own (an
-- agreement.renewed event) carries no customer decision and is left out. Pipeline = sent + accepted whose term has not started with no
-- completed contract, so an in-term agreement counts once, as recurring revenue and an ended term counts in neither.
create function public.report_headline(p_from date, p_to date)
returns table (recurring_cents bigint, pipeline_cents bigint, accepted_n bigint, refused_n bigint, expired_n bigint, signed_n bigint,
               avg_days_to_sign numeric)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin']) as org),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  ev as (select r.* from me, lateral private.report_events(me.org) r),
  renewed as (select distinct agreement_id from ev where type = 'agreement.renewed'),
  completed as (select distinct agreement_id from ev where type = 'contract.completed'),
  dec as (
    select distinct ev.agreement_id, ev.type from ev
    where ev.type in ('agreement.accepted', 'agreement.refused', 'agreement.expired') and ev.d between p_from and p_to
      and ev.agreement_id not in (select agreement_id from renewed)
  ),
  signed as (
    select c.agreement_id, c.d - (select min(s.d) from ev s where s.agreement_id = c.agreement_id and s.type = 'agreement.sent') as days
    from ev c where c.type = 'contract.completed' and c.d between p_from and p_to
  )
  select coalesce((select sum(b.value_cents) from b where b.in_term), 0)::bigint,
         coalesce((select sum(b.value_cents) from b
                   where b.status = 'sent' or (b.status = 'accepted' and not b.in_term and (b.term_start is null or b.term_start > (now() at time zone 'America/Vancouver')::date)
                       and b.id not in (select agreement_id from completed))), 0)::bigint,
         (select count(*) from dec where type = 'agreement.accepted'),
         (select count(*) from dec where type = 'agreement.refused'),
         (select count(*) from dec where type = 'agreement.expired'),
         (select count(*) from signed),
         (select round(avg(days), 1) from signed where days is not null)
$$;

-- Funnel. Four rows, always, each agreement counted once under the date of its own event. value_cents is null for an estimator.
create function public.report_funnel(p_from date, p_to date)
returns table (stage text, ord integer, n bigint, value_cents bigint)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin', 'estimator']) as org, private.report_money() as money),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  ev as (select r.* from me, lateral private.report_events(me.org) r),
  hit as (
    select 1 as ord, b.id, b.value_cents from b where (b.created_at at time zone 'America/Vancouver')::date between p_from and p_to
    union all
    select 2, b.id, b.value_cents from b
    where exists (select 1 from ev where ev.agreement_id = b.id and ev.type = 'agreement.sent' and ev.d between p_from and p_to)
    union all
    select 3, b.id, b.value_cents from b
    where exists (select 1 from ev where ev.agreement_id = b.id and ev.type = 'agreement.accepted' and ev.d between p_from and p_to)
    union all
    select 4, b.id, b.value_cents from b
    where exists (select 1 from ev where ev.agreement_id = b.id and ev.type = 'contract.completed' and ev.d between p_from and p_to)
  )
  select s.stage, s.ord, count(h.id), case when me.money then coalesce(sum(h.value_cents), 0)::bigint end
  from me
  cross join (values ('created', 1), ('sent', 2), ('accepted', 3), ('signed', 4)) as s(stage, ord)
  left join hit h on h.ord = s.ord
  group by s.stage, s.ord, me.money
  order by s.ord
$$;

-- Aging. Three 'median' rows (days is null when the stage has no data in the range) and up to ten 'stuck' rows, oldest first: a draft,
-- a sent agreement, or an accepted one with no completed contract (an automatic renewal is left out), aged from its last change.
create function public.report_aging(p_from date, p_to date)
returns table (kind text, stage text, days numeric, agreement_id uuid, number text, customer_name text, site_name text, status text)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin', 'estimator']) as org),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  ev as (select r.* from me, lateral private.report_events(me.org) r),
  first_sent as (select agreement_id, min(d) as d from ev where type = 'agreement.sent' group by agreement_id),
  first_decided as (
    select agreement_id, min(d) as d from ev
    where type in ('agreement.accepted', 'agreement.refused', 'agreement.changes_requested') group by agreement_id
  ),
  first_accepted as (select agreement_id, min(d) as d from ev where type = 'agreement.accepted' group by agreement_id),
  completed as (select agreement_id, min(d) as d from ev where type = 'contract.completed' group by agreement_id),
  spans as (
    select 1 as ord, 'Created to sent' as stage, (f.d - (b.created_at at time zone 'America/Vancouver')::date) as days
    from first_sent f join b on b.id = f.agreement_id where f.d between p_from and p_to
    union all
    select 2, 'Sent to decided', (d.d - f.d) from first_decided d join first_sent f on f.agreement_id = d.agreement_id
    where d.d between p_from and p_to
    union all
    select 3, 'Accepted to signed', (c.d - a.d) from completed c join first_accepted a on a.agreement_id = c.agreement_id
    where c.d between p_from and p_to
  ),
  stuck as (
    select b.* from b
    where (b.status in ('draft', 'sent')
           or (b.status = 'accepted' and b.id not in (select agreement_id from completed)
               and not exists (select 1 from ev where ev.agreement_id = b.id and ev.type = 'agreement.renewed')))
    order by b.updated_at, b.id
    limit 10
  )
  select 'median', t.stage, round((percentile_cont(0.5) within group (order by s.days))::numeric, 1), null::uuid, null::text, null::text, null::text, null::text
  from (values ('Created to sent', 1), ('Sent to decided', 2), ('Accepted to signed', 3)) as t(stage, ord)
  left join spans s on s.ord = t.ord
  group by t.stage, t.ord
  union all
  select 'stuck', null, ((now() at time zone 'America/Vancouver')::date - (k.updated_at at time zone 'America/Vancouver')::date)::numeric,
         k.id, k.number, k.customer_name, k.site_name, k.status
  from stuck k
$$;

-- Losses. One row per refused, expired or withdrawn event in the range, newest first. The reason is the customer's (refused) or the
-- staff note (withdrawn) when the event holds one; value_cents is null for an estimator.
create function public.report_losses(p_from date, p_to date)
returns table (agreement_id uuid, number text, customer_name text, site_name text, outcome text, reason text, occurred date, value_cents bigint)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin', 'estimator']) as org, private.report_money() as money),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  ev as (select r.* from me, lateral private.report_events(me.org) r)
  select b.id, b.number, b.customer_name, b.site_name, substr(ev.type, 11), coalesce(ev.payload ->> 'reason', ev.payload ->> 'note'), ev.d,
         case when me.money then b.value_cents end
  from me, ev join b on b.id = ev.agreement_id
  where ev.type in ('agreement.refused', 'agreement.expired', 'agreement.withdrawn') and ev.d between p_from and p_to
  order by ev.at desc, b.id
$$;

-- Renewals. Accepted agreements whose term ends within 90 days and that no renewal links to yet, soonest first. Bucket 30, 60 or 90 by
-- days left. kind is 'auto' only when the org's CPI is set and below its renegotiation threshold, else 'negotiate'. value_cents is null
-- for an estimator.
create function public.report_renewals()
returns table (agreement_id uuid, number text, customer_name text, site_name text, term_end date, days_left integer, bucket integer,
               kind text, value_cents bigint)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin', 'estimator']) as org, private.report_money() as money),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  today as (select (now() at time zone 'America/Vancouver')::date as d)
  select b.id, b.number, b.customer_name, b.site_name, b.term_end, (b.term_end - today.d)::integer,
         case when b.term_end - today.d <= 30 then 30 when b.term_end - today.d <= 60 then 60 else 90 end,
         case when s.renewal_cpi_pct is not null and s.renewal_cpi_pct < s.cpi_renegotiation_threshold_pct then 'auto' else 'negotiate' end,
         case when me.money then b.value_cents end
  from me
  cross join today
  join b on b.status = 'accepted' and b.term_end between today.d and today.d + 90
  left join public.org_settings s on s.org_id = me.org
  where not exists (select 1 from public.agreements n where n.renews_agreement_id = b.id and n.org_id = me.org)
  order by b.term_end, b.id
$$;

-- Revenue by customer (money): live value of in-term agreements as of today, largest first, ties by name.
create function public.report_revenue_by_customer()
returns table (customer_id uuid, customer_name text, agreements bigint, value_cents bigint)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin']) as org),
  b as (select r.* from me, lateral private.report_base(me.org) r)
  select b.customer_id, b.customer_name, count(*), sum(b.value_cents)::bigint
  from b where b.in_term
  group by b.customer_id, b.customer_name
  order by 4 desc, b.customer_name, b.customer_id
$$;

-- Revenue by equipment type (money): each in-term line's value split equally over the types it covers, the remainder going to the
-- first type by name, so the total equals the headline recurring revenue. A line covering no type is 'Unassigned'.
create function public.report_revenue_by_type()
returns table (type_name text, value_cents bigint)
language sql stable security invoker
set search_path = ''
as $$
  with me as (select private.report_org(array['owner', 'admin']) as org),
  b as (select r.* from me, lateral private.report_base(me.org) r),
  ln as (
    select l.id as line_id, l.visits_per_year::bigint * l.cost_per_visit_cents as val
    from public.service_lines l join b on b.version_id = l.agreement_version_id and b.in_term
  ),
  lt as (
    select ln.line_id, ln.val, t.name,
           row_number() over (partition by ln.line_id order by t.name, t.id) as rn,
           count(*) over (partition by ln.line_id) as cnt
    from ln
    join public.service_line_asset_types x on x.service_line_id = ln.line_id
    join public.asset_types t on t.id = x.asset_type_id
  ),
  shares as (
    select lt.name, (lt.val / lt.cnt) + case when lt.rn = 1 then lt.val % lt.cnt else 0 end as v from lt
    union all
    select 'Unassigned', ln.val from ln where not exists (select 1 from lt where lt.line_id = ln.line_id)
  )
  select shares.name, sum(shares.v)::bigint from shares
  group by shares.name
  order by 2 desc, 1
$$;

revoke execute on function public.report_headline(date, date) from public, anon;
revoke execute on function public.report_funnel(date, date) from public, anon;
revoke execute on function public.report_aging(date, date) from public, anon;
revoke execute on function public.report_losses(date, date) from public, anon;
revoke execute on function public.report_renewals() from public, anon;
revoke execute on function public.report_revenue_by_customer() from public, anon;
revoke execute on function public.report_revenue_by_type() from public, anon;
grant execute on function public.report_headline(date, date) to authenticated;
grant execute on function public.report_funnel(date, date) to authenticated;
grant execute on function public.report_aging(date, date) to authenticated;
grant execute on function public.report_losses(date, date) to authenticated;
grant execute on function public.report_renewals() to authenticated;
grant execute on function public.report_revenue_by_customer() to authenticated;
grant execute on function public.report_revenue_by_type() to authenticated;
