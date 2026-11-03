# Versioning verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 8dbc22b..77c0581
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 26 checks have a located assertion and every runnable proof is green at HEAD. The FAIL is for four precision or coverage gaps (ranked under Gate), none of which is a failing test.

Proofs run at HEAD (from `web/`):
- One vitest call over the 4 target files: 4 files, 240 tests passed. Every `C13xx:` name below appeared individually as passed.
- Full `npm test`: 111 files, 2235 tests passed. `npm run lint` exit 0. `npx tsc --noEmit` exit 0. `npm run build` exit 0.
- `npm run test:db agreement_builder`: PASS (1 passed, 0 failed). `npm run test:db rls_isolation`: PASS.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1319 | revise stores customer reason and uE as author | test:db agreement_builder, exit 0 | `supabase/tests/agreement_builder.sql:770` - `created_by = tests.id('uE') and reason = 'Too expensive'` (v1 unchanged `:773`); migration `20261104090000_versioning.sql` reads the latest changes_requested payload reason into the insert | PASS |
| C1320 | create_agreement v1 has creator, null reason | test:db agreement_builder | `agreement_builder.sql:785` - `v.created_by = tests.id('uE') and v.reason is null` (the author comes from the door-4 trigger) | PASS |
| C1321 | authenticated cannot update a version (42501) | test:db agreement_builder | `agreement_builder.sql:794` - `expect_error('C1321 update', 'update public.agreement_versions set reason ...', '42501')`; trigger stamp `:803` `created_by = tests.id('uE')` | PASS |
| C1322 | reader returns reason and author role per version | vitest `C1322:` passed | `infrastructure/supabase/agreements.test.ts:523` - `toEqual([[2,"Too expensive","estimator"],[1,null,null]])` | PASS |
| C1323 | reason renders; null reason renders nothing | vitest `C1323:` passed | `components/agreements/agreements.test.ts:482` `toContain("Too expensive")`; `:484` `not.toContain("data-reason")`; `:485` no placeholder regex | PASS |
| C1324 | note stored; 500 ok; 501 raises 23514 hint `note_too_long`; value unchanged | test:db agreement_builder | `agreement_builder.sql:812` stored `'Added boiler'`; `:817` `char_length(reason) = 500`; `:819` `expect_error(..., '23514')`; `:821` unchanged. The hint `note_too_long` is in the migration but no assertion reads it (`expect_error` compares SQLSTATE only, `fixture.sql:51-63`) | FAIL (precision gap: the claim names the hint, nothing asserts it) |
| C1325 | non-draft raises 55000 hint `not_editable`; viewer 42501 | test:db agreement_builder | `agreement_builder.sql:832` `expect_error('C1325 sent', ..., '55000')`; `:836` `'C1325 viewer' ... '42501'`; `:841` unchanged. Hint `not_editable` is not asserted | FAIL (precision gap, same as C1324) |
| C1326 | action trims; 501 gives field error on `note` without the writer; success calls once | vitest `C1326:` x5 passed | `app/(app)/agreements.test.ts:388` `toHaveBeenCalledExactlyOnceWith(AGR, "Added boiler")`; `:395-400` `errors: { note: "Note must be 500 characters or fewer" }` and `save not.toHaveBeenCalled()` | PASS |
| C1327 | backfill matches events; others null; no revised event leaves created_by null | test:db agreement_builder; mcp execute_sql | `agreement_builder.sql:869` `created_by = tests.id('uE') and reason = 'Add a boiler'`; `:871` v1 null; `:873` no-events null. mcp (read-only, run by me): versions with a revised event naming them and an actor, with `created_by` null = `0`. Caveat: the SQL test runs a copy of the migration's UPDATE (`:855-867`), not the migration file, so drift between the two would not be caught | PASS (caveat) |
| C1328 | per-version events oldest first, type/time/actor, own version only | vitest `C1328:` x2 passed | `agreements.test.ts:545-553` `history(1)` and `history(2)` `toEqual` with sent/viewed/changes_requested and sent/refused, roles and `customer`. The asserted list contains no `accepted` event, though the claim and Coverage row name it (accepted only appears as a marker in C1329) | FAIL (coverage gap: `accepted` event type not asserted in the history) |
| C1329 | markers 2/2 on the full set; 1/null on the first two events | vitest `C1329:` x2 passed | `agreements.test.ts:569` `toMatchObject({ sentVersion: 2, acceptedVersion: 2 })`; `:571` `toMatchObject({ sentVersion: 1, acceptedVersion: null })` | PASS |
| C1330 | Sent/Accepted markers on the right versions only | vitest `C1330:` passed | `agreements.test.ts` (components) `:490-494` `block(html,1) toContain(">Sent<")`, `not.toContain(">Accepted<")`, v2 reverse, v3 `not.toMatch(/>Sent<\|>Accepted</)` | PASS |
| C1331 | "Not sent yet" only on a version with no events | vitest `C1331:` passed | `components/agreements/agreements.test.ts:501` `toContain("Not sent yet")`; `:502` `not.toContain("Not sent yet")` | PASS |
| C1332 | other org / no org gets null; page calls notFound | rls_isolation PASS; vitest `C1332:` passed | `app/(app)/agreements.test.ts:299` `rejects.toThrow("NEXT_NOT_FOUND")` for a null reader. `rls_isolation.sql:96-101` C2 asserts uA sees 0 org-B rows on `agreement_versions` and `events` (loop over `tenant_tables()`); C7 asserts anon sees none (`:126-135`). Not asserted by name for uX, and the reader-returns-null link is via RLS, not a unit | PASS (note: no uB/uX-specific reader assertion) |
| C1333 | two viewed events render one row | vitest `C1333:` passed | `agreements.test.ts:605` `toEqual([["sent",...09:00],["viewed",...10:00]])` | PASS |
| C1334 | 3 kinds, 5 fields, only differing fields listed | vitest `C1334:` x7 passed | `domain/agreement/version-diff.test.ts:18` added/removed `toEqual`; `:38,40` per-field (description, costPerVisitCents, visitsPerYear, visitMonths, equipment) `toEqual({ field, from, to })`; `:46` single field only | PASS |
| C1335 | reordered equipment/months not changed | vitest `C1335:` passed | `version-diff.test.ts:53` `expect(diffVersions([before],[after]).lines).toEqual([])` | PASS |
| C1336 | totals and deltaCents -58000 | vitest `C1336:` passed | `version-diff.test.ts:60-62` `110000`, `52000`, `-58000` (the check's corrected arithmetic) | PASS |
| C1337 | identical lines: no entries, delta 0; panel says "No differences" | vitest `C1337:` x2 passed | `version-diff.test.ts:67` `toEqual({ lines: [], totalFromCents: 100000, totalToCents: 100000, deltaCents: 0 })`; component `agreements.test.ts:510` `toContain("No differences")` | PASS |
| C1338 | `get(id,2,1)` returns compare; null for equal, missing, unknown, non-number | vitest `C1338:` x9 passed | reader `:619` `compare toMatchObject({versionNo:1, annualCents:357000})`, `:635` null for shown, undefined, 9, 0; page `app/(app)/agreements.test.ts:288` `abc`/`1.5`/`""` reach the reader as `(AGR, 2, undefined)`; `:294` `(AGR, 2, 1)`. The "not a number" case is proven at the page layer, not the reader (the claim's wording is satisfied by the pair) | PASS |
| C1339 | per-field old/new, removed and added lines, both totals, signed change | vitest `C1339:` x2 passed | `components/agreements/agreements.test.ts:521` `/...Per visit.*\$892\.50.*\$950\.00/`; `:522` removed; `:523` added; `:524-526` `$3,870.00`, `$4,000.00`, `+$130.00`; `:532` `−$300.00` | PASS |
| C1340 | inactive-site agreement renders comparison and history, no write control | vitest `C1340:` passed | `agreements.test.ts:540-542` `toContain("No differences")`, `block(html,1) toContain(">Sent<")`, no write labels. The fixture is `status: "withdrawn"` as the stand-in for an inactive site; the view has no site-active logic (`agreement-view.tsx` branches on `editable`), so the claim is satisfied through status | PASS (note: proxy for "inactive site") |
| C1341 | at 375 px no horizontal scroll, controls >= 44 px | live, not independently re-run | Author-side live run (Handoff): `scrollWidth 360 = clientWidth 360`, no control under 44 px, 768 px `753 = 753`. I checked the code only: `versions-section.tsx:8` link `min-h-11`; `version-compare.tsx:76` panel `overflow-hidden`. No rendered 44 px assertion exists in the tree | author-side live run, not independently re-run |
| C1342 | test, lint, build, test:db exit 0 on HEAD | run by me | `npm test` 2235 passed; lint 0; tsc 0; `npm run build` 0; test:db `agreement_builder` and `rls_isolation` PASS (full `npm run test:db` not run: only these two recipes) | PASS |
| C1343 | advisors: no new finding beyond `save_version_note` | mcp `get_advisors` security (read-only, run by me) | Only new `authenticated_security_definer_function_executable` entry is `public.save_version_note`; the rest (`save_agreement_term`, `set_*_active`, portal_*, automation_*, `outbox`, leaked passwords) are existing. The trigger function is in `private` and not listed | PASS |
| C1344 | live as demo owner: revise, reason and author, markers, compare | live, not independently re-run | Author-side live run (Handoff): AG-1044 revised, reason and "by owner", note saved, comparison "$3,241.75 → $3,700.00", totals $19,450.50 / $22,200.00 / +$2,749.50; AG-1052/AG-1048 markers. Code side checked: reader `agreements.ts:230-262` history and markers, `version-compare.tsx` fields; matches the claimed output. Not re-run by me (single-context rule) | author-side live run, not independently re-run |

## Coverage

Not recomputed (light). Gaps found while reading the plan against checks.md:

| Plan item | Finding |
| --- | --- |
| Landing door 5 (events with no `versionNo` fall back to the newest version at event time) | Has no check id and no Coverage row; `checks.md` says "3 one-way doors" while the plan lists 5. Tests exist and pass under the C1328 and C1329 names (`agreements.test.ts:574-594`: later and earlier event fallback, and a sent event older than every version not listed), but they are not claimed by any check |
| Landing door 4 (`before insert` trigger stamps `created_by`) | No check claims it. It is asserted in `agreement_builder.sql:798-804` (`C1321 author`, a direct insert naming uA is stamped uE) and indirectly by C1319/C1320. The `auth.uid()` null branch (definer or owner inserts keep a given value) is not asserted |
| `GET /agreements/[agreementId]` 404 | Covered: C1332 (`agreements.test.ts:299`) and the existing C741 |
| AC 1-15 | Every criterion has a check: AC1 C1319, AC2 C1320, AC3 C1322/C1323, AC4 C1324-C1326, AC5 C1327, AC6 C1328/C1333, AC7 C1329/C1330, AC8 C1331, AC9 C1332, AC10 C1334/C1335/C1338/C1339, AC11 C1336/C1339, AC12 C1338, AC13 C1337, AC14 C1340, AC15 C1341 |

Swept existing re-read: the `existing` constraints the Swept rows cite are present. C1321 relies on AD-060 (no update grant on `agreement_versions`, proven by the `42501` assertion). `save_version_note` locks the row `for update` before the draft check (migration) and is refused for non-drafts (C1325). Each writer runs in a single transaction. Sampling and level: the diff and domain checks are table-driven; the status-code, route and shape claims (C1319, C1324, C1325, C1332, C1338) each cross a boundary (database or page plus reader).

Superseded earlier assertions (`git diff 8dbc22b..HEAD` over the three files): adapted, not weakened, with one judgement call. The C1032 "a draft reads no notification" test now bars `notifications` and the `agreement.sent` lookup (`call.args[1] === "agreement.sent"`) but no longer every `events` read; the history read of `events` is now by design for every status, so the narrowing is justified. The events `eq` filters assertion became `.slice(-3)` and the `order` assertion `findLast`, both still pinning the same values. C727 page tests and composition C748 now carry the new signature (`get(id, versionNo?, compareNo?)`); the version fixtures gained fields.

## Gate

`npm test` (web/) - 111 files, 2235 passed, 0 failed. `npm run lint`, `npx tsc --noEmit`, `npm run build` exit 0. test:db `agreement_builder` and `rls_isolation` PASS.

Ranked gaps:
1. C1328 - `accepted` is named in the claim and the Coverage row but no test asserts an accepted event in a version's history list - `infrastructure/supabase/agreements.test.ts:545-553`.
2. C1324 and C1325 - hints `note_too_long` and `not_editable` are in the claims but not asserted; `tests.expect_error` checks SQLSTATE only - `agreement_builder.sql:819,832`.
3. Doors 4 and 5 (the trigger and the time-based event fallback) have tests but no check and no Coverage row; `checks.md` counts 3 doors against 5 in the plan.
4. C1327's SQL test replicates the migration's UPDATE rather than running the migration file (drift risk); the mcp count of 0 supports it for the live data.
5. C1340 uses a withdrawn status as the proxy for an inactive site; C1341 and C1344 are author-side live runs, not independently re-run.
