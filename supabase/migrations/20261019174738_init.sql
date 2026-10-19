-- init: the tenant schema for Phase 1 (.specs/features/supabase-init/plan.md).
-- Every tenant row carries org_id; child rows reference parents through (id, org_id) so a reference
-- cannot cross orgs (door 1). RLS policies call the private helpers (door 2).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'estimator', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id, org_id);

create table public.org_settings (
  org_id uuid primary key references public.orgs (id) on delete cascade,
  legal_name text not null,
  address text,
  phone text,
  logo_path text,
  accent_color text check (accent_color ~ '^#[0-9a-f]{6}$'),
  repair_discount_pct numeric(5, 2) not null default 0 check (repair_discount_pct between 0 and 100),
  cpi_cap_pct numeric(5, 2) not null default 0 check (cpi_cap_pct between 0 and 100),
  cancellation_notice_days integer check (cancellation_notice_days >= 0),
  payment_days integer check (payment_days >= 0),
  governing_province text,
  tax_note text,
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index customers_org_id_idx on public.customers (org_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  customer_id uuid not null,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  unique (id, customer_id),
  foreign key (customer_id, org_id) references public.customers (id, org_id)
);
create index contacts_org_id_idx on public.contacts (org_id);
create index contacts_customer_id_idx on public.contacts (customer_id, org_id);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  customer_id uuid not null,
  site_contact_id uuid,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (customer_id, org_id) references public.customers (id, org_id),
  foreign key (site_contact_id, customer_id) references public.contacts (id, customer_id)
);
create index sites_org_id_idx on public.sites (org_id);
create index sites_customer_id_idx on public.sites (customer_id, org_id);
create index sites_site_contact_id_idx on public.sites (site_contact_id, customer_id);

create table public.asset_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, code),
  unique (id, org_id)
);

create table public.asset_type_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  asset_type_id uuid not null,
  position integer not null default 0,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (asset_type_id, org_id) references public.asset_types (id, org_id)
);
create index asset_type_tasks_org_id_idx on public.asset_type_tasks (org_id);
create index asset_type_tasks_asset_type_id_idx on public.asset_type_tasks (asset_type_id, org_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  site_id uuid not null,
  asset_type_id uuid not null,
  unit_no text,
  type_model text,
  location text,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_at timestamptz not null default now(),
  foreign key (site_id, org_id) references public.sites (id, org_id),
  foreign key (asset_type_id, org_id) references public.asset_types (id, org_id)
);
create index assets_org_id_idx on public.assets (org_id);
create index assets_site_id_idx on public.assets (site_id, org_id);
create index assets_asset_type_id_idx on public.assets (asset_type_id, org_id);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  site_id uuid not null,
  number text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'refused', 'changes_requested', 'expired', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (site_id, org_id) references public.sites (id, org_id)
);
create index agreements_org_id_idx on public.agreements (org_id);
create index agreements_site_id_idx on public.agreements (site_id, org_id);

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  agreement_id uuid not null,
  version_no integer not null check (version_no >= 1),
  snapshot jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (agreement_id, version_no),
  unique (id, org_id),
  foreign key (agreement_id, org_id) references public.agreements (id, org_id)
);
create index agreement_versions_org_id_idx on public.agreement_versions (org_id);
create index agreement_versions_agreement_id_idx on public.agreement_versions (agreement_id, org_id);

create table public.service_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  agreement_version_id uuid not null,
  position integer not null default 0,
  description text not null,
  visits_per_year integer not null check (visits_per_year >= 1),
  cost_per_visit_cents bigint not null check (cost_per_visit_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (agreement_version_id, org_id) references public.agreement_versions (id, org_id)
);
create index service_lines_org_id_idx on public.service_lines (org_id);
create index service_lines_agreement_version_id_idx on public.service_lines (agreement_version_id, org_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  agreement_version_id uuid not null unique,
  status text not null default 'pending_signature'
    check (status in ('pending_signature', 'client_signed', 'completed', 'declined', 'voided')),
  created_at timestamptz not null default now(),
  foreign key (agreement_version_id, org_id) references public.agreement_versions (id, org_id)
);
create index contracts_org_id_idx on public.contracts (org_id);
create index contracts_agreement_version_id_idx on public.contracts (agreement_version_id, org_id);

-- Append-only audit log (door 9). n8n_execution_id is written back by the service role.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  type text not null,
  payload jsonb not null default '{}',
  actor_id uuid,
  n8n_execution_id text,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index events_org_id_idx on public.events (org_id, created_at);
create index events_entity_idx on public.events (entity_type, entity_id);

-- One dispatch row per event, read and written by the service role only (door 9).
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  event_id uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  foreign key (event_id, org_id) references public.events (id, org_id)
);
create index outbox_org_id_idx on public.outbox (org_id);
create index outbox_pending_idx on public.outbox (available_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS helpers (door 2). The private schema is not exposed by the Data API.
-- ---------------------------------------------------------------------------

create schema private;
grant usage on schema private to authenticated;

create function private.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  )
$$;

create function private.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  )
$$;

revoke execute on function private.is_org_member(uuid) from public, anon;
revoke execute on function private.has_org_role(uuid, text[]) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants. anon keeps select only, which RLS turns into zero rows.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke update, delete on public.events from authenticated;
revoke all on public.outbox from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.org_settings enable row level security;
alter table public.customers enable row level security;
alter table public.contacts enable row level security;
alter table public.sites enable row level security;
alter table public.asset_types enable row level security;
alter table public.asset_type_tasks enable row level security;
alter table public.assets enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.service_lines enable row level security;
alter table public.contracts enable row level security;
alter table public.events enable row level security;
alter table public.outbox enable row level security;

-- orgs: members read; owner and admin rename. Orgs are created by the service role until onboarding.
create policy orgs_select on public.orgs for select to authenticated
  using ((select private.is_org_member(id)));
create policy orgs_update on public.orgs for update to authenticated
  using ((select private.has_org_role(id, array['owner', 'admin'])))
  with check ((select private.has_org_role(id, array['owner', 'admin'])));

-- Company policy: members read, owner and admin write.
create policy memberships_select on public.memberships for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy memberships_insert on public.memberships for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin'])));
create policy memberships_update on public.memberships for update to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])))
  with check ((select private.has_org_role(org_id, array['owner', 'admin'])));
create policy memberships_delete on public.memberships for delete to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])));

create policy org_settings_select on public.org_settings for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy org_settings_insert on public.org_settings for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin'])));
create policy org_settings_update on public.org_settings for update to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])))
  with check ((select private.has_org_role(org_id, array['owner', 'admin'])));

-- Catalog: members read, owner and admin write; domain data: members read, everyone but viewers write.
do $$
declare
  t text;
  writers text;
begin
  foreach t in array array['asset_types', 'asset_type_tasks', 'customers', 'contacts', 'sites', 'assets',
                           'agreements', 'agreement_versions', 'service_lines', 'contracts'] loop
    writers := case when t in ('asset_types', 'asset_type_tasks')
                    then 'array[''owner'', ''admin'']'
                    else 'array[''owner'', ''admin'', ''estimator'']' end;
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_org_member(org_id)))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.has_org_role(org_id, %s)))',
                   t || '_insert', t, writers);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.has_org_role(org_id, %s))) with check ((select private.has_org_role(org_id, %s)))',
                   t || '_update', t, writers, writers);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.has_org_role(org_id, %s)))',
                   t || '_delete', t, writers);
  end loop;
end $$;

-- events: members read, writers append. Update and delete are revoked above.
create policy events_select on public.events for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy events_insert on public.events for insert to authenticated
  with check ((select private.has_org_role(org_id, array['owner', 'admin', 'estimator'])));

-- outbox: no policies; RLS on and privileges revoked, so only the service role reaches it.
