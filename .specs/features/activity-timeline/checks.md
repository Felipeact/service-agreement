# Activity timeline checks

Profile: light
Plan: `.specs/features/activity-timeline/plan.md`

19 checks in 3 slices plus delivery · 0 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1478:`). This feature numbers from
  C1478, because contact-roles owns up to `C1477:`.
  - Domain tests sit beside the code: `domain/agreement/timeline.test.ts`.
  - The reader is tested in `infrastructure/supabase/agreements.test.ts` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup` in `components/agreements/agreements.test.ts`.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- No migration and no SQL change, so no `test:db` proof is owed; `npm run test:db` still runs in delivery as a regression.

Terms:
- "the actor" of an entry is a role (owner, admin, estimator, viewer), `customer` or `automatic`, because no table holds
  member names (AD-118).
- "the customer" also acts on a `viewed` event, which `portal_record_view` writes with a null actor and no `via` (AD-069),
  so a `viewed` entry with no actor reads `customer`. This refines plan AC 9 and AC 10 and is not a new capability.

## Checks

### S1 - see everything that happened, in order · 5 files · ~90 KB · ~22k

**C1478** - `buildTimeline` labels each of the ten event types: `sent` "Sent to customer", `viewed` "Viewed by
customer", `accepted` "Accepted", `refused` "Refused", `changes_requested` "Changes requested", `revised` "New version
created", `expired` "Expired", `withdrawn` "Withdrawn", `renewed` "Renewed", `renewal_drafted` "Renewal draft created"
(AC 1, 2)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1478:"` in `web/` (table-driven over the 10 types)

**C1479** - `buildTimeline` adds one "Created" entry dated at version 1's creation, carrying the role of version 1's
author, or no actor when version 1 has none (AC 3)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1479:"` in `web/`

**C1480** - An entry carries the version number its event names: the `versionNo` the reader resolved, or none when the
event is older than every version (AC 4)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1480:"` in `web/`

**C1481** - Entries come newest first; two events at the same time come in the reverse of the order they were written,
and "Created" is last when it ties with an event (AC 1, 6)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1481:"` in `web/`

**C1482** - An event of a type outside the ten, such as `contract.completed`, makes no entry and no error (AC 7)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1482:"` in `web/`

**C1483** - `AgreementReader.get` returns `timeline` with one entry per `agreement.*` event of the ten types across all
versions, and the version of an event with no `versionNo` is the newest version that existed when it was written; the
Versions history of each version still lists only its five types (AC 1, 4, 7)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1483:"` in `web/`

**C1484** - The agreement page renders an "Activity" section whose entries read newest first, each with its label, its
version number where known, and its time as a medium date with a short time in America/Vancouver (AC 1, 2, 4, 5, 6)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1484:"` in `web/`

### S2 - who and why · 5 files · ~80 KB · ~20k

**C1485** - The actor of an entry is the member's role when the event has an actor, `customer` when `via` is `portal` or
the event is `viewed` with no actor, and `automatic` for an `expired`, `renewed` or `renewal_drafted` event with no actor
(AC 8, 9, 10)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1485:"` in `web/` (table-driven over the 4 cases)

**C1486** - The reader resolves the actor of a timeline entry from the org's memberships: an event written by a member
shows that member's role, and one whose actor is no longer a member shows no actor, not `automatic` (AC 8)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1486:"` in `web/`

**C1487** - A `refused` or `changes_requested` event with a `reason` carries it on its entry; an event of another type
whose payload holds a `reason` shows none; the page renders the reason with `break-words` and no truncation (AC 11)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1487:"` and
`npx vitest run components/agreements/agreements.test.ts -t "C1487:"` in `web/`

**C1488** - A `withdrawn` event with `via` `deactivation` is labelled "Withdrawn · site deactivated"; one without it is
labelled "Withdrawn" (AC 12)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1488:"` in `web/`

**C1489** - An `expired` event with `validUntil` `2026-12-01` shows "Valid until Dec 1, 2026"; a `renewed` or
`renewal_drafted` event whose `renewsAgreementId` is the id of the agreement this one renews shows "Renews AG-1004", and
one naming another id or an unreadable agreement shows no such text (AC 13)
Proof: `npx vitest run domain/agreement/timeline.test.ts -t "C1489:"` and
`npx vitest run infrastructure/supabase/agreements.test.ts -t "C1489:"` in `web/`

### S3 - states and access · 4 files · ~70 KB · ~15k

**C1490** - An agreement with one version and no events has a `timeline` of exactly one "Created" entry, and the page
renders the Activity section with that one entry (AC 14)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1490:"` and
`npx vitest run components/agreements/agreements.test.ts -t "C1490:"` in `web/`

**C1491** - As a member of another org and as a user in no org, `AgreementReader.get` of an org A agreement returns
`null`, and the page calls `notFound()` (AC 15, existing RLS and page)
Proof: `npm run test:db rls_isolation` (existing assertions on `agreements` and `events`) and
`npx vitest run "app/(app)/agreements.test.ts" -t "C1332:"` in `web/`

**C1492** - A withdrawn agreement renders the Activity section with its entries and no write control (AC 16)
Proof: `npx vitest run components/agreements/agreements.test.ts -t "C1492:"` in `web/`

**C1493** - At 375 px the Activity section, with a 400-character reason, has no horizontal page scroll
(`scrollWidth <= clientWidth`) (AC 17)
Proof: live (Playwright at 375 px, one signed-in context), result in the Handoff

**C1494** - IF the `events` read fails THEN `AgreementReader.get` rejects, and no partial timeline is returned (AC 18)
Proof: `npx vitest run infrastructure/supabase/agreements.test.ts -t "C1494:"` in `web/`

### Delivery - regressions and the live run

**C1495** - `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` and `npm run test:db` all exit 0 on `HEAD`
(every AC)
Proof: those commands in `web/`, results in the Handoff

**C1496** - Live, as the demo owner: an agreement that was sent, viewed, refused, revised, sent and accepted shows
those entries newest first with actors and the refusal reason, at 1440 and 768 px, and a new draft shows only "Created"
(AC 1, 2, 4, 8, 9, 11, 14)
Proof: live (Playwright at 1440 and 768 px, one signed-in context), result in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| event types listed (10) | sent C1478 · viewed C1478 · accepted C1478 · refused C1478 · changes_requested C1478 · revised C1478 · expired C1478 · withdrawn C1478 · renewed C1478 · renewal_drafted C1478 | - |
| entries read by the reader (2) | the ten event types C1483 · created C1479, C1490 | - |
| actor kinds (4) | member role C1485, C1486 · customer via portal C1485 · customer on a viewed C1485 · automatic C1485 | - |
| entry details (4) | reason C1487 · site deactivated C1488 · valid until C1489 · renews C1489 | - |
| ordering cases (3) | newest first C1481 · tie reversed C1481 · created last on a tie C1481 | - |
| `GET /agreements/[agreementId]` statuses (2) | 200 C1484 · 404 C1491 | - |
| plan `Observable` states with a check (5) | empty C1490 · error C1494 · unauthorised C1491 · ordering C1481 · mobile C1493 | - |

- Observable rows with no check of their own: loading (existing `loading.tsx`), destructive action (n/a in the plan)
- Claims naming a status code, route or response shape: C1491, C1484 - each has a proof that crosses the page
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1482 (an unknown type is dropped), C1489 (an unreadable renewed agreement shows no number), C1487 (a reason on another type shows none); payload keys are read defensively as unknown
- failure modes: C1494 (a failed read rejects), C1486 (a departed member shows no actor)
- idempotency: n/a - read-only, no write path
- authorization: C1491 (other org and no org), existing - `events` select policy for org members
- concurrency: n/a - read-only; two events at one instant keep their write order (C1481)
- data lifecycle: C1492 (an inactive site's agreement stays readable), C1480 (an event older than every version)
- dependency failure: C1494 (the only dependency is the database read)
- state transitions: n/a - no transition is added; C1478 lists the transitions' events as they were written
- observability: C1483 (the timeline is the event log made visible); n/a - no new logging requirement

## Out of scope

Carried by the plan: emails and reminders, link reissue, contract events, a cross-agreement feed, removing the Versions
history, filtering and paging.

## Handoff

- Read set, measured with `wc -c`: `infrastructure/supabase/agreements.ts` (~22 KB), its test (~35 KB), `ports/index.ts`
  (~30 KB), `agreement-view.tsx` (~12 KB), `versions-section.tsx` (~4 KB), `agreements.test.ts` components (~40 KB),
  `domain/agreement/index.ts` and `term.ts`. About 145 KB, ~36k tokens.
- Slice estimates in the headers: S1 ~22k, S2 ~20k, S3 ~15k, delivery ~8k. About 65k against the 150k budget, so one
  builder; the cut, had one been needed, falls after S1.
- Mechanism: one builder (under the budget, no ask)
- No migration, so nothing is applied to `gnxebrtcpbujhvcamtoe`. The live run C1496 reads demo data and, to make a refused
  and revised agreement, may decide one demo agreement; that is the only mutation and is owed an ask if the data lacks one.

- **Boundary:** C1478-C1496 closed at the build commit that carries this paragraph (feature base `8d798db`)
- **Proof runs (2026-11-04):** `npm test` 2500 passed; `npm run lint`, `npx tsc --noEmit` and `npm run build` clean; `npm run test:db` 21 passed, 0 failed (no SQL change, regression only).
- **C1493 and C1496 (live, one signed-in context, `next start` on port 3210 from the new build, because the existing dev server on port 3000 did not pick up the change and was not stopped):** AG-1044 at 1440 px showed Created, Viewed by customer, Changes requested with the customer's reason "Please add a spring visit", and New version created (Version 2, owner); at 768 px `scrollWidth 753 = clientWidth 753`; at 375 px `360 = 360`, and with the reason replaced in the DOM by a 463-character string the page stayed `360 = 360` and the section's right edge was 344. AG-1052 showed Created, Sent to customer (owner), two Viewed by customer, Accepted (customer); AG-1056 (withdrawn) showed Withdrawn (owner) and Created. No console errors or warnings. The section has no link or button, so there is no touch target to measure. The 463-character reason was a DOM substitution, not stored data, since no demo agreement carries a long reason.
- **Settled mid-build:** (1) `AgreementDetail.timeline` is optional in the type so the ten fixtures that build an `AgreementDetail` need no edit, as contact-roles did; the reader always sets it and the view skips an absent or empty one. (2) The check C1483's "ten types" are asked of the database in one `in` list shared with the Versions history; the history still keeps its five through `EVENT_KINDS`. (3) A `viewed` event with no actor reads `customer` (checks Terms).
- **Abandoned:** a second `events` query for the timeline, since the history's read already fetches the rows.
- **Not seen live:** an `expired`, `renewed` or `renewal_drafted` entry, a refusal reason and "site deactivated" on real data; the demo rows hold none. They are proven by C1478, C1485, C1487-C1489 only.
