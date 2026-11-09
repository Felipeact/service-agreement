# Pending release of the plumbing and electrical packs

Nothing here is applied. These two files wait for a practitioner's review (ROADMAP decision 5).

To release, once the reviewer has signed and any corrections have landed as their own migration:

1. Fill the reviewer and date lines in `release.sql`, delete its guard, and move it to `supabase/migrations/<version>_release_starter_packs.sql` (the version is the one `apply_migration` records, AD-006).
2. Move `starter_packs.after_release.sql` over `supabase/tests/starter_packs.sql`. It proves the same checks with the packs released and the gate with two test packs.
3. Apply the migration (needs the owner's go-ahead), run `npm run test:db starter_packs`, run the Verifier, tick ROADMAP Phase 4.5 item 5.
4. Delete this folder.

To release only one pack, delete the other `update` and drop its member from C2301 and C2302.
