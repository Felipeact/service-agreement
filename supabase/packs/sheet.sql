-- The review sheet for the practitioner (.specs/features/starter-packs/plan.md, doors 3 and 4).
-- Run each select in the Supabase SQL editor: one row per task, ordered by code then position.
-- Reading a pack here releases nothing; a pack seeds only after a later migration sets its release.
select * from private.pack_review_sheet('plumbing');
select * from private.pack_review_sheet('electrical');
