# Versioning - checks

Profile: light
Plan: `.specs/features/versioning/plan.md`

28 checks in 3 slices plus delivery · 5 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/` (`npm test`). Every test name starts with its check id and a colon (`C1319:`). This
  feature numbers from C1319, because deactivation owns up to `C1318:`.
  - Domain tests sit beside the code (`domain/agreement/*.test.ts`).
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Server Actions are tested in `app/(app)/agreements.test.ts` with the container fake.
  - Components are asserted with `renderToStaticMarkup` in `components/agreements/agreements.test.ts`.
- **test:db** means `npm run test:db agreement_builder` in `web/`, rolled back, run after the migration is applied to
  `gnxebrtcpbujhvcamtoe`. Assertions go into `supabase/tests/agreement_builder.sql`, labelled with their check id. No new
  recipe; the builder reads the runner for any pinned counts before adding assertions.
- **mcp** means a Supabase MCP `execute_sql` or `get_advisors` call on that project; query and result go in the Handoff.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.

Terms:
- "the author" of a version is shown as the role of `created_by` in the agreement's org (owner, admin, estimator,
  viewer), because no table holds member names or emails; `null` shows no author. This refines plan AC 6's "actor" and
  is not a new capability.
- "the fixture" is `fixture.sql` org A (uA owner, uE estimator, uV viewer; uB owner of org B; uX in no org), with the
  `tests.ab_*` helpers of `agreement_builder.sql`.

## Checks

### S1 - see why a version exists and who made it · 7 files · ~120 KB · ~30k

**C1319** - `apply_agreement_transition` with `agreement.revised` as uE on an agreement in `changes_requested` whose
latest `agreement.changes_requested` event has reason `Too expensive` creates version 2 with `created_by = uE` and
`reason = 'Too expensive'` (AC 1, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C1319`)

**C1320** - `create_agreement` as uE creates version 1 with `created_by = uE` and `reason` null (AC 2, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C1320`)

**C1321** - `reason` and `created_by` of a version cannot be written by `authenticated` directly: an `update` on
`agreement_versions` as uA raises `42501` (door 1, AD-060)
Proof: `npm run test:db agreement_builder` (assertions `C1321`)

**C1322** - `AgreementReader.get` returns, per version, `reason` (string or null) and `author` (the role of
`created_by`, or null) (AC 3)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1322:"` in `web/`

**C1323** - A version with reason `Too expensive` renders that text next to its number; a version with a null reason
renders no reason element and no placeholder text (AC 3)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1323:"` in `web/`

**C1324** - `save_version_note(agreement, 'Added boiler')` as uE on a `draft` agreement stores `reason = 'Added boiler'`
on its current version; a 500-character note is stored; a 501-character note raises `23514` with hint `note_too_long`
and leaves the stored value unchanged (AC 4)
Proof: `npm run test:db agreement_builder` (assertions `C1324`)

**C1325** - `save_version_note` raises `55000` with hint `not_editable` on an agreement that is not `draft`, and `42501`
for uV (AC 4)
Proof: `npm run test:db agreement_builder` (assertions `C1325`)

**C1326** - The note Server Action trims the note and, on a 501-character note, returns a field error on `note`
without calling the writer; on success it calls the writer once (AC 4)
Proof: `npx vitest run "app/(app)/agreements.test.ts" -t "C1326:"` in `web/`

**C1327** - After the migration, every version that follows an `agreement.changes_requested` event has `reason` equal
to that event's `payload.reason`; every `agreement.revised` event's version has `created_by` equal to the event's
`actor_id`; every other `created_by` and `reason` is null (AC 5, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C1327`, on rows built with the pre-migration shape by
inserting events and versions as the table owner and running the backfill statement) and mcp `execute_sql`: the
count of versions with `created_by` null where an `agreement.revised` event exists for them is 0

### S2 - per-version history and markers · 5 files · ~100 KB · ~25k

**C1328** - `AgreementReader.get` returns for each version its events in time order (oldest first) with `type`
(`sent`, `viewed`, `accepted`, `refused`, `changes_requested`), time and actor (`staff` role, or `customer` for the
portal) matched on `payload.versionNo`; an event of another version is not in it (AC 6)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1328:"` in `web/`

**C1329** - With events `agreement.sent` (v1), `agreement.changes_requested` (v1), `agreement.revised` (v2),
`agreement.sent` (v2), `agreement.accepted` (v2), the reader marks `sentVersion = 2` and `acceptedVersion = 2`; with
only the first two events, `sentVersion = 1` and `acceptedVersion = null` (AC 7, door 3)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1329:"` in `web/`

**C1330** - The version list renders a "Sent" marker on the version `sentVersion` names and an "Accepted" marker on
`acceptedVersion`, and no marker on the others (AC 7)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1330:"` in `web/`

**C1331** - A version with no events renders "Not sent yet" in its history, and a version with events renders no such
text (AC 8)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1331:"` in `web/`

**C1332** - As uB (org B) and as uX, `AgreementReader.get` for an org A agreement returns `null`, and the page calls
`notFound()` (AC 9, existing RLS)
Proof: `npm run test:db rls_isolation` (existing assertions on `agreements`, `agreement_versions` and `events`) and
`npx vitest run "app/(app)/agreements.test.ts" -t "C1332:"` in `web/`

**C1333** - A `viewed` event is shown once per version: two `agreement.viewed` events for the same version render one
"Viewed" row (AC 6, A4)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1333:"` in `web/`

### S3 - compare two versions · 8 files · ~110 KB · ~28k

**C1334** - `diffVersions(a, b)` marks a position present in `b` only as `added`, present in `a` only as `removed`,
and present in both with a different description, `costPerVisitCents`, `visitsPerYear`, `visitMonths` or covered
equipment type codes as `changed`, listing exactly the fields that differ with old and new values (AC 10, door 2)
Proof: `npx vitest run domain/agreement/version-diff.test.ts -t "C1334:"` in `web/` (table-driven over the 3 kinds and
the 5 fields)

**C1335** - Two lines that differ only in the order of their equipment or the order of their months are not `changed`
(AC 10)
Proof: `npx vitest run domain/agreement/version-diff.test.ts -t "C1335:"` in `web/`

**C1336** - `diffVersions` returns `totalFromCents`, `totalToCents` and `deltaCents = totalToCents - totalFromCents`;
for lines of 4 × 12 500 and 2 × 30 000 cents against 4 × 13 000 and no second line, `deltaCents` is `-58000` (110 000 -> 52 000) (AC 11)
Proof: `npx vitest run domain/agreement/version-diff.test.ts -t "C1336:"` in `web/`

**C1337** - `diffVersions` of two versions with identical lines returns no `added`, `removed` or `changed` entries and
`deltaCents = 0`; the comparison panel renders "No differences" for it (AC 13)
Proof: `npx vitest run domain/agreement/version-diff.test.ts -t "C1337:"` and
`npx vitest run components/agreements/agreements.test.ts -t "C1337:"` in `web/`

**C1338** - `AgreementReader.get(id, 2, 1)` returns `compare` holding the lines of version 1 and its number alongside
the shown version 2; `compare` is null when the compare number equals the shown number, is missing, names no version,
or is not a whole number (AC 10, 12)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1338:"` and
`npx vitest run "app/(app)/agreements.test.ts" -t "C1338:"` in `web/` (the page parses `?compare=` like `?version=`)

**C1339** - The comparison panel renders, per changed line, the old and new value of each differing field, a removed
line with its old values and an added line with its new ones, and both annual totals with the signed change as
dollars and cents (AC 10, 11)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1339:"` in `web/`

**C1340** - An agreement of an inactive site renders the comparison and the history with no write control (AC 14)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1340:"` in `web/`

**C1341** - At 375 px the comparison and history have no horizontal page scroll (`scrollWidth <= clientWidth`) and
every control is at least 44 px tall (AC 15)
Proof: live (Playwright at 375 px, one signed-in context), result in the Handoff

### Doors found while building (added after Verifier round 1)

**C1345** - Door 4: an insert into `agreement_versions` by a signed-in member is stamped `created_by = auth.uid()` even when the row names another user, and an insert with no signed-in user keeps the `created_by` it names (door 4)
Proof: `npm run test:db agreement_builder` (assertions `C1345`)

**C1346** - Door 5: an event with no `versionNo` belongs to the newest version whose `created_at` is not after the event's, and one older than every version is listed on none; the latest such `agreement.sent` or `agreement.accepted` sets `sentVersion` or `acceptedVersion` (door 5)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1346:"` in `web/`, with the sent-event cases `C1328:` (no versionNo) and `C1329:` (older than every version) in the same file

### Delivery - regressions, data and the live run

**C1342** - `npm test`, `npm run lint`, `npm run build` and `npm run test:db` all exit 0 on `HEAD` (every AC)
Proof: those four commands in `web/`, results in the Handoff

**C1343** - mcp `get_advisors` security after the migration shows no new finding beyond the new `save_version_note`
function in the `authenticated_security_definer_function_executable` group (door 1)
Proof: mcp `get_advisors` (security), result in the Handoff

**C1344** - Live, as the demo owner: an agreement with a requested change is revised, the page shows version 2 with the
customer's reason and the author role, "Sent" and "Accepted" markers sit on the right versions, and `?compare=1` on
version 2 shows the line differences and the annual change (AC 1, 3, 6, 7, 10, 11)
Proof: live (Playwright at 1440 and 768 px, one signed-in context), result in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| door 1: `created_by` + `reason` on `agreement_versions` (4) | written at revise C1319 · written at create C1320 · not directly writable C1321 · backfill C1327 | - |
| door 2: `diffVersions` line kinds (3) | added C1334 · removed C1334 · changed C1334 | - |
| door 2: compared fields (5) | description C1334 · price per visit C1334 · visits per year C1334 · visit months C1334 · equipment C1334 | - |
| door 4: author stamped by the database (2) | signed-in insert C1345 · no user keeps the value C1345 | - |
| door 5: event with no `versionNo` (3) | newest version at the time C1346 · older than every version C1346 · staff-written decision C1346 | - |
| door 3: markers derived from events (2) | sent C1329 · accepted C1329 | - |
| `GET /agreements/[agreementId]` statuses (2) | 200 C1338 · 404 C1332 | - |
| `compare` parameter values that show no comparison (4) | equals shown C1338 · missing C1338 · unknown version C1338 · not a number C1338 | - |
| history event types (5) | sent C1328 · viewed C1328, C1333 · accepted C1328 · refused C1328 · changes_requested C1328 | - |
| `save_version_note` outcomes (4) | stored C1324 · 500 accepted C1324 · 501 refused C1324 · not draft C1325 | - |
| `relations`: `agreement_versions` -> `events` by `versionNo` (1) | C1328 | - |
| `relations`: `agreement_versions` -> author by `created_by` (1) | C1322 | - |
| plan `Observable` states with a check (5) | empty C1331 · error C1338 · unauthorised C1332 · ordering C1328 · mobile C1341 | - |

- Observable rows with no check of their own: loading (existing `loading.tsx`), destructive action (n/a in the plan)
- Claims naming a status code, route or response shape: C1319, C1324, C1325, C1332, C1338 - each has a proof that
  crosses the boundary (a database call, or the page and the reader together)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1324 (note length 500/501), C1338 (the `compare` values), C1326 (action trims and rejects)
- failure modes: C1324 (an over-long note leaves the stored value unchanged); C1327 (a version with no recoverable
  author keeps null, no error); existing - each writer is one transaction
- idempotency: C1333 (a repeated view event renders once); `save_version_note` is a plain set, so repeating it stores the
  same value; n/a - no retried write path is added
- authorization: C1321 (no direct write), C1325 (viewer refused), C1332 (other org and no org)
- concurrency: n/a - `save_version_note` locks the agreement row `for update` before it checks `draft`, so it cannot
  interleave with a Send (AD-015 pattern); the claim is proven by C1325 refusing once the status has left `draft`;
  no new shared counter
- data lifecycle: C1327 (backfill of existing versions), C1340 (inactive records stay readable)
- dependency failure: n/a - no external call
- state transitions: C1325 (the note is editable only in `draft`), C1319 (`revise` creates the version), C1329 (markers
  follow the events)
- observability: C1328 (history is the event log made visible); n/a - no new logging requirement

## Out of scope

Carried by the plan: diffing term dates, valid-until and seasonal tasks; restoring a version; the activity timeline;
comparison in the portal or PDF; diffing the "Service included" snapshot.

## Handoff

- Read set, measured with `wc -c` before the build over the files the slices touch: the latest `apply_agreement_transition`
  and `create_agreement` migrations, `agreement_builder.sql`, `ports/index.ts`, `infrastructure/supabase/agreements.ts`
  and its test, `agreement-view.tsx`, the agreement page, `agreement-actions.ts` and `agreements.test.ts`, the component
  tests, and `domain/agreement/index.ts`. To be measured and written here by the builder as its first line.
- Slice estimates are in the slice headers: S1 ~30k, S2 ~25k, S3 ~28k, delivery ~10k. About 93k against the 150k budget,
  so one builder; the cut, had one been needed, falls after S1 where the surface moves from the database to the reader.
- Mechanism: one builder (under the budget, no ask)
- **Asks before build (blast radius):** applying the migration to `gnxebrtcpbujhvcamtoe` through mcp `apply_migration`
  (the test:db proofs need it, and it backfills existing rows), and the live run C1344, which revises and decides a demo
  agreement.

- **Boundary:** C1319-C1344 closed at the docs commit that carries this paragraph (code commits `8be8516`, `3ae8609`, and the sent-event fix)
- **Proof runs (2026-11-03):** `npm run test:db` 19 passed, 0 failed (agreement_builder carries C1319-C1321, C1324, C1325, C1327). `npm test` 111 files, 2235 tests passed. `npm run lint`, `npx tsc --noEmit` and `npm run build` clean.
- **C1327 (mcp `execute_sql`):** versions with an `agreement.revised` event naming them and an actor, and `created_by` null: 0 (19 versions, 1 with an author, 0 with a reason).
- **C1343 (mcp `get_advisors` security, 2026-11-03):** the only new finding is `save_version_note` in `authenticated_security_definer_function_executable`; the others are the existing ones.
- **C1341 and C1344 (live, dev server on port 3202 from the working tree, one signed-in context):** at 375 px AG-1048 with `?version=2&compare=1` has `scrollWidth 360 = clientWidth 360` and no link or button under 44 px; at 768 px `753 = 753`. AG-1044 was revised from `changes_requested`: version 2 appeared with the customer's reason "Please add a spring visit" in its note, "by owner" in the list, and after "Save note" the note read "Spring visit added at the customer request" (database: version 2 `reason` and `created_by` set, version 1 null). After editing the line to $3,700.00 the comparison read "Per visit: $3,241.75 → $3,700.00", Version 1 $19,450.50, Version 2 $22,200.00, Change +$2,749.50. AG-1052 showed "Sent" and "Accepted" on version 1 with Sent, Viewed and Accepted events; AG-1048 showed "Sent" on version 2 and "Not sent yet" on version 1. No console errors on the current build.
- **Settled mid-build:** (1) C1336's example arithmetic was wrong in the approved check: 110 000 to 52 000 is -58 000, not -8 000; I corrected the value and the proof asserts -58 000. (2) The Compare control is a link per version, not the select of assumption A3, because the existing agreement view test C715 says a viewer sees no `<form`. (3) Live run: `send_agreement` writes `agreement.sent` with `{from, to}` and no `versionNo`, so door 3 as approved could not mark a staff-sent version; Landing door 5 (time-based fallback) was added before the fix, and an unlisted case (a sent event older than every version) is not listed. (4) Door 4 (trigger) was added for the author, and `save_version_note` is a definer because `authenticated` has no update on `agreement_versions`. (5) The author is shown as a role, since no table holds member names.
- **Superseded earlier assertions (not weakened, adapted to the new signature):** agreements adapter test "the detail carries ... versions" now lists `reason`, `author`, `events`; C1032 "reader asks for the customer_link notification" takes the last three `events` filters and the last `order` (the history query runs first); C1032 "a draft reads no notification" still bars `notifications` and the `agreement.sent` lookup but no longer bars every `events` read; C727 page tests expect `get(AGR, n, undefined)`; composition C748 pins `get(id, versionNo?, compareNo?)`; fixtures of `AgreementDetail` and `AgreementActions` gained the new fields.
- **Abandoned:** a Compare form with a select (see 2); an events-only author (no table of names exists).
- **Open, non-failing:** the stale `next start` on port 3201 (the proposal-expiry/deactivation build) is still running. Staff-side `agreement.accepted` or `refused` events have no `versionNo` and take the time-based fallback. Demo data: AG-1044 now has version 2 with a note and a changed price.

- **Verifier round 1 (FAIL, 22/26):** (1) C1328 named `accepted` but no test listed one: `C1328: an accepted event is listed ...` added. (2) C1324 and C1325 named hints but asserted only the SQLSTATE: assertions `C1324 hint` and `C1325 hint` added to `agreement_builder.sql`. (3) Doors 4 and 5 had no check: C1345 and C1346 and their Coverage rows added (additive, no approved check edited). (4) C1327 runs a copy of the migration's UPDATE, not the file; kept, since a migration cannot be replayed in a rolled-back recipe, and the live count of 0 stands. C1341 and C1344 stay author-side live runs. `agreement_builder` passes; `agreements.test.ts` 68 passed.
