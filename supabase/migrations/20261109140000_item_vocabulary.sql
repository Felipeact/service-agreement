-- item-vocabulary doors 1 and 2: the org's word for the serviced item, and the customer's page reading it.

-- Door 1: two words, lowercase, never null. Every existing org reads 'equipment' (no backfill).
alter table public.org_settings
  add column item_singular text not null default 'equipment' check (item_singular ~ '^[a-z][a-z'' -]{0,29}$'),
  add column item_plural text not null default 'equipment' check (item_plural ~ '^[a-z][a-z'' -]{0,29}$');

-- Door 2: portal_view (same signature) returns the words inside `tenant`.
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
                            'itemSingular', s.item_singular, 'itemPlural', s.item_plural)
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
    'today', to_char((now() at time zone 'America/Vancouver')::date, 'YYYY-MM-DD'),
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;
