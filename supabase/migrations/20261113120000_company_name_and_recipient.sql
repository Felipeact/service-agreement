-- 1. One workspace per company name: the register form asks before Checkout, and provisioning refuses a name already taken
--    (the webhook backstop, closed code invalid_metadata). Names compare lower-cased with runs of spaces collapsed.
create function private.company_in_use(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with wanted as (select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')) as k)
  select w.k <> '' and (
    exists (select 1 from public.orgs o where lower(regexp_replace(btrim(o.name), '\s+', ' ', 'g')) = w.k)
    or exists (select 1 from public.org_settings s where lower(regexp_replace(btrim(coalesce(s.legal_name, '')), '\s+', ' ', 'g')) = w.k)
  ) from wanted w
$$;
revoke execute on function private.company_in_use(text) from public, anon, authenticated;

create function public.company_has_workspace(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(private.company_in_use(p_name), false) $$;
revoke all on function public.company_has_workspace(text) from public, anon, authenticated;
grant execute on function public.company_has_workspace(text) to anon, authenticated;

create or replace function private.provision_workspace(p_event_id text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_session jsonb;
  v_meta jsonb;
  v_customer text;
  v_subscription text;
  v_email text;
  v_plan text;
  v_trades text[];
  v_trade text;
  v_seats_text text;
  v_seats integer;
  v_included integer;
  v_company text;
  v_phone text;
  v_org uuid;
begin
  select e.body -> 'data' -> 'object' into v_session from private.stripe_events e where e.id = p_event_id;
  v_meta := case when jsonb_typeof(v_session -> 'metadata') = 'object' then v_session -> 'metadata' else '{}'::jsonb end;

  v_customer := case when jsonb_typeof(v_session -> 'customer') = 'string' then v_session ->> 'customer' end;
  v_subscription := case when jsonb_typeof(v_session -> 'subscription') = 'string' then v_session ->> 'subscription' end;
  if v_session ->> 'mode' is distinct from 'subscription' or coalesce(v_customer, '') = '' or coalesce(v_subscription, '') = '' then
    raise exception 'not_a_subscription' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.org_billing b where b.stripe_subscription_id = v_subscription) then
    raise exception 'already_provisioned' using errcode = 'P0001';
  end if;

  v_email := lower(btrim(coalesce(
    case when jsonb_typeof(v_session -> 'customer_details' -> 'email') = 'string' then v_session -> 'customer_details' ->> 'email' end,
    case when jsonb_typeof(v_session -> 'customer_email') = 'string' then v_session ->> 'customer_email' end, '')));
  v_plan := case when jsonb_typeof(v_meta -> 'plan') = 'string' then v_meta ->> 'plan' end;
  v_included := case v_plan when 'starter' then 2 when 'team' then 5 when 'business' then 10 end;
  v_trades := case when jsonb_typeof(v_meta -> 'trades') = 'string' then string_to_array(v_meta ->> 'trades', ',') end;
  v_seats_text := case when jsonb_typeof(v_meta -> 'seats') = 'string' then v_meta ->> 'seats' end;
  v_company := case when jsonb_typeof(v_meta -> 'company') = 'string' then btrim(v_meta ->> 'company') end;
  v_phone := case when jsonb_typeof(v_meta -> 'phone') = 'string' then nullif(btrim(v_meta ->> 'phone'), '') end;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254
     or v_included is null
     or v_trades is null or cardinality(v_trades) not between 1 and 4
     or v_seats_text is null or v_seats_text !~ '^[0-9]{1,3}$'
     or coalesce(char_length(v_company), 0) not between 1 and 120 then
    raise exception 'invalid_metadata' using errcode = 'P0001';
  end if;
  foreach v_trade in array v_trades loop
    if v_trade not in ('hvac', 'plumbing', 'electrical', 'other') then
      raise exception 'invalid_metadata' using errcode = 'P0001';
    end if;
  end loop;
  v_seats := v_seats_text::integer;
  if v_seats not between v_included and 50 then
    raise exception 'invalid_metadata' using errcode = 'P0001';
  end if;

  if private.email_in_use(v_email) then
    raise exception 'email_in_use' using errcode = 'P0001';
  end if;
  if private.company_in_use(v_company) then
    raise exception 'invalid_metadata' using errcode = 'P0001';
  end if;

  insert into public.orgs (name) values (v_company) returning id into v_org;
  insert into public.org_settings (org_id, legal_name, phone, setup_completed_at) values (v_org, v_company, v_phone, null);
  insert into public.org_billing (org_id, stripe_customer_id, stripe_subscription_id, plan, seats, trades, other_trade)
  values (v_org, v_customer, v_subscription, v_plan, v_seats, v_trades, 'other' = any (v_trades));
  foreach v_trade in array v_trades loop
    if v_trade <> 'other' then
      perform private.seed_org_catalog(v_org, v_trade);
    end if;
  end loop;
  insert into public.invitations (org_id, email, role, invited_by, expires_at)
  values (v_org, v_email, 'owner', null, now() + interval '30 days');
  return v_email;
end $$;
revoke execute on function private.provision_workspace(text) from public, anon, authenticated;

-- 2. Sending an agreement emails the site contact. These two let the page see that address and, when there is none, save one
--    before the send. Both run as the caller, so row-level security keeps them inside the caller's org and writer role.
create function public.agreement_recipient(p_agreement_id uuid)
returns text
language sql stable
set search_path = ''
as $$
  select nullif(btrim(c.email), '')
  from public.agreements a
  join public.sites s on s.id = a.site_id and s.org_id = a.org_id
  join public.contacts c on c.id = s.site_contact_id and c.customer_id = s.customer_id
  where a.id = p_agreement_id
$$;

create function public.set_agreement_recipient(p_agreement_id uuid, p_email text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_site public.sites;
  v_name text;
  v_contact uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254 then
    return false;
  end if;
  select s.* into v_site from public.agreements a join public.sites s on s.id = a.site_id and s.org_id = a.org_id where a.id = p_agreement_id;
  if not found then
    return false;
  end if;
  if v_site.site_contact_id is not null then
    update public.contacts set email = v_email where id = v_site.site_contact_id and customer_id = v_site.customer_id;
    return found;
  end if;
  select c.name into v_name from public.customers c where c.id = v_site.customer_id and c.org_id = v_site.org_id;
  insert into public.contacts (org_id, customer_id, name, email) values (v_site.org_id, v_site.customer_id, coalesce(v_name, 'Customer'), v_email)
  returning id into v_contact;
  update public.sites set site_contact_id = v_contact where id = v_site.id;
  return true;
end $$;

revoke execute on function public.agreement_recipient(uuid), public.set_agreement_recipient(uuid, text) from public, anon;
grant execute on function public.agreement_recipient(uuid), public.set_agreement_recipient(uuid, text) to authenticated;
