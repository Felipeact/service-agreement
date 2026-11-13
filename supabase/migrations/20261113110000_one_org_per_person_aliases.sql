-- One org per person: "in use" ignores the +tag of an address, so owner+two@x.com cannot open a second workspace
-- beside owner@x.com. Same signature and callers as 20261112210000; only the comparison changes.
create or replace function private.email_in_use(p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with wanted as (select regexp_replace(p_email, '\+[^@]*@', '@') as base)
  select exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id, wanted w
    where regexp_replace(lower(u.email), '\+[^@]*@', '@') = w.base
  ) or exists (
    select 1 from public.invitations i, wanted w
    where regexp_replace(i.email, '\+[^@]*@', '@') = w.base and i.accepted_at is null and i.expires_at > now()
  )
$$;

revoke execute on function private.email_in_use(text) from public, anon, authenticated;
