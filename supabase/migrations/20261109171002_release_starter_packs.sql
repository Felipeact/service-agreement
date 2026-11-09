-- Release of the plumbing and electrical starter packs (.specs/features/pack-release/checks.md, AD-163).
-- Reviewed by: Felipe Viana (owner), for both packs, on 2026-11-09. Interim review: the owner named himself the reviewer
-- "for now" (ROADMAP decision 5 asks for a practitioner), so a practitioner's review of the checklists is still open.
-- The packs are the drafts in .specs/features/starter-packs/types-draft.md as built; no correction is applied here.

update private.catalog_packs set released_at = now() where pack = 'plumbing' and released_at is null;
update private.catalog_packs set released_at = now() where pack = 'electrical' and released_at is null;
