-- tenant-logo doors 1 and 2: the public `logos` bucket, who may write it, the shape of `logo_path`, and the two anonymous
-- reads (portal_view, signature_view) returning the path. Both reads keep their signatures and every other key.

-- Door 1: the bucket. Public on purpose: a logo is shown to every customer, and the review and signing pages are anonymous.
-- PNG and JPEG only (the PDF renderer draws no other), 1 MB. A new key per upload, so a replaced logo is never served stale.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg']);

-- Only an owner or admin of the org named by the key's first segment writes (and so reads through the API: Storage's delete
-- needs a select policy to see the row, and without one removes nothing, silently; the public read is the bucket flag); `uuid_or_null` makes a malformed segment a
-- policy refusal (42501), not a cast error. No update policy.
create policy logos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and array_length(storage.foldername(name), 1) = 1
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin']))
  );

create policy logos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'logos'
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin']))
  );

create policy logos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (select private.has_org_role(private.uuid_or_null((storage.foldername(name))[1]), array['owner', 'admin']))
  );

-- `logo_path` was an unused column; no org has set it, so the check cannot fail on an existing row.
alter table public.org_settings
  add constraint org_settings_logo_path_shape
  check (logo_path is null or logo_path ~ concat('^', org_id::text, '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'));

-- Door 2: portal_view returns `logoPath` inside `tenant`.
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
    'today', to_char((now() at time zone 'America/Vancouver')::date, 'YYYY-MM-DD'),
    'decision', v_decision);
end $$;

revoke execute on function public.portal_view(text) from public;
grant execute on function public.portal_view(text) to anon, authenticated;

-- Door 2: signature_view returns `logoPath` inside `tenant`.
create or replace function public.signature_view(p_token_hash text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_signer public.contract_signers;
  v_request public.contract_signature_requests;
  v_contract public.contracts;
  v_number text;
begin
  select s.* into v_signer from public.contract_signers s where s.token_hash = p_token_hash and s.role = 'customer';
  if not found then
    return null;
  end if;
  select r.* into v_request from public.contract_signature_requests r where r.id = v_signer.request_id and r.org_id = v_signer.org_id;
  if v_request.status = 'creating' then
    return null;
  end if;
  select c.* into v_contract from public.contracts c where c.id = v_request.contract_id and c.org_id = v_request.org_id;
  select a.number into v_number
  from public.agreement_versions v join public.agreements a on a.id = v.agreement_id and a.org_id = v.org_id
  where v.id = v_contract.agreement_version_id and v.org_id = v_contract.org_id;

  return jsonb_build_object(
    'tenant', (select jsonb_build_object('name', o.legal_name, 'address', o.address, 'phone', o.phone, 'accent', o.accent_color,
                                  'logoPath', o.logo_path)
               from public.org_settings o where o.org_id = v_request.org_id),
    'agreement', jsonb_build_object('number', v_number),
    'signer', jsonb_build_object('name', v_signer.name),
    'contractStatus', v_contract.status,
    'requestStatus', v_request.status,
    'embedSealed', case when v_request.status = 'open' and v_contract.status = 'pending_signature' then v_signer.embed_sealed end);
end $$;

revoke execute on function public.signature_view(text) from public;
grant execute on function public.signature_view(text) to anon, authenticated;
