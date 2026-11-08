-- type-editor door 7: the code trigger no longer answers before the row policy for a cross-tenant org_id move.
create or replace function private.asset_types_code_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'an equipment type code cannot change' using errcode = '23514';
  end if;
  -- A signed-in caller who cannot write the new org is left to the row policy (42501).
  if new.org_id is distinct from old.org_id
     and ((select auth.uid()) is null or (select private.has_org_role(new.org_id, array['owner', 'admin']))) then
    raise exception 'an equipment type org cannot change' using errcode = '23514';
  end if;
  return new;
end $$;
