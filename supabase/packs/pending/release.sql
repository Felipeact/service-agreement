-- Release of the plumbing and electrical starter packs (.specs/features/pack-release/checks.md).
-- Reviewed by: <REVIEWER NAME, role, company> (plumbing) and <REVIEWER NAME, role, company> (electrical), on <DATE>.
-- Draft: not a migration yet. To release, fill the two lines above, delete the guard below, then follow README.md.
do $$ begin
  raise exception 'pack release is not filled in: name the reviewers and the date, then remove this guard';
end $$;

update private.catalog_packs set released_at = now() where pack = 'plumbing' and released_at is null;
update private.catalog_packs set released_at = now() where pack = 'electrical' and released_at is null;
