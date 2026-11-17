-- Learning from corrections across companies. When someone maps a spelling a list used ("VRV", "Ventilateur d'extraction") to an
-- equipment type, that is a vote for (spelling, the type's code). A spelling that at least two different companies agree on, and
-- that no other code has two companies behind, is used for every company's imports as one more spelling of that type.
--   * Only the short normalised spelling and the type's code are kept, never the file, the row or the unit. A spelling is at most
--     40 characters, has no digits (so no unit numbers, serials or phone numbers) and no '@'; anything else is not recorded.
--   * type_alias_votes has no policy and no grant: nobody reads or writes it directly. record_type_alias and shared_type_aliases are
--     the only doors, and the second returns agreed spellings only, never who voted.
-- NOT applied to the hosted project: applying it needs the owner's go-ahead.
create table public.type_alias_votes (
  alias text not null check (char_length(alias) between 2 and 40 and alias !~ '[0-9@]'),
  type_code text not null check (char_length(type_code) between 1 and 80),
  org_id uuid not null references public.orgs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alias, type_code, org_id)
);
alter table public.type_alias_votes enable row level security;
revoke all on public.type_alias_votes from public, anon, authenticated;
create index type_alias_votes_org_id_idx on public.type_alias_votes (org_id);

-- Records the caller's company's vote that p_alias means the type p_type_id. A spelling that cannot be shared is ignored, not an
-- error: the mapping itself already happened.
create function public.record_type_alias(p_alias text, p_type_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_code text;
  v_alias text := btrim(regexp_replace(lower(coalesce(p_alias, '')), '[^[:alpha:][:digit:]]+', ' ', 'g'));
begin
  if v_user is null then
    raise exception 'not allowed to record a type spelling' using errcode = '42501';
  end if;
  select t.org_id, t.code into v_org, v_code from public.asset_types t where t.id = p_type_id;
  if v_org is null or not (select private.has_org_role(v_org, array['owner', 'admin', 'estimator'])) then
    raise exception 'not allowed to record a type spelling' using errcode = '42501';
  end if;
  if char_length(v_alias) not between 2 and 40 or v_alias ~ '[0-9@]' then
    return;
  end if;
  insert into public.type_alias_votes (alias, type_code, org_id) values (v_alias, v_code, v_org) on conflict do nothing;
end $$;

-- The spellings enough companies agree on, with the type code each means. Agreed: at least two companies voted for the pair, and
-- no other code has two or more companies behind the same spelling.
create function public.shared_type_aliases()
returns table (alias text, type_code text)
language sql stable security definer
set search_path = ''
as $$
  with agreed as (
    select v.alias, v.type_code, count(distinct v.org_id) as orgs
    from public.type_alias_votes v
    group by v.alias, v.type_code
    having count(distinct v.org_id) >= 2
  )
  select a.alias, a.type_code
  from agreed a
  where (select count(*) from agreed b where b.alias = a.alias) = 1
    and (select auth.uid()) is not null
$$;

revoke execute on function public.record_type_alias(text, uuid) from public, anon;
grant execute on function public.record_type_alias(text, uuid) to authenticated;
revoke execute on function public.shared_type_aliases() from public, anon;
grant execute on function public.shared_type_aliases() to authenticated;
