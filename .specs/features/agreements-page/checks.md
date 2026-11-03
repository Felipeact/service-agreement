# Agreements page - checks

Profile: light
Plan: `.specs/features/agreements-page/plan.md`

21 checks in 2 slices plus delivery · 2 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1347:`). This feature numbers
  from C1347, because versioning owns up to `C1346:`.
  - Domain tests sit beside the code (`domain/agreement/list-filter.test.ts`, new file).
  - Adapters are tested in `infrastructure/supabase/readers.test.ts` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup` in `components/agreements/agreements-list.test.ts` (new file),
    `components/kanban/pipeline-view.test.ts` and `components/shell/nav-items.test.ts`.
  - Pages and the container fake are tested in `app/(app)/agreements-list.test.ts` (new file), in the style of
    `app/(app)/pipeline.test.ts`.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- No migration and no SQL test: the plan changes no stored shape, and RLS is untouched.

Terms:
- "status filter value" is one of seven names: the five `PIPELINE_STAGES` keys (`in_progress`, `sent`, `accepted`,
  `completed`, `refused`) plus `expired` and `withdrawn` (plan door 1). A stage key keeps the rows `pipelineStage`
  maps to it, so `refused` keeps refused and expired agreements and a declined contract; `expired` and `withdrawn`
  keep rows by agreement status alone.
- "the fixture rows" are agreements of one org in these states: `draft`, `changes_requested`, `sent`, `accepted` with
  no contract, `accepted` with a `completed` contract, `refused`, `expired`, `withdrawn` (8 rows).
- "writer" is a member with role owner, admin or estimator; `viewer` is the read-only role.
- Replaced assertions: the plan's `Impact` row authorizes replacing the claims "New agreement is disabled" (C118 in
  `pipeline-view.test.ts`, the same claim in design-system-base C17/C21 and staff-screens C118) and "Agreements has
  no href" (C156 in `nav-items.test.ts`). They are edited in the commit that changes the behaviour, and the commit
  message names them. No other test is edited.

## Checks

### S1 - browse and filter agreements · 9 files · ~110 KB · ~28k

**C1347** - `parseAgreementFilter` keeps `status` only when it is one of the seven status filter values, keeps `site`
only when it is a uuid, keeps `expiring` only when it is exactly `1`, and drops everything else to "no filter" without
throwing; an array-valued parameter keeps nothing (AC 6, door 1)
Proof: `npx vitest run domain/agreement/list-filter.test.ts -t "C1347:"` in `web/`

**C1348** - `matchesStatusFilter` over the fixture rows returns: `in_progress` -> the `draft` and `changes_requested`
rows; `sent` -> the `sent` row; `accepted` -> the `accepted` row with no contract; `completed` -> the `accepted`
row with a `completed` contract; `refused` -> the `refused` and `expired` rows; `expired` -> the `expired` row;
`withdrawn` -> the `withdrawn` row (AC 2, door 1)
Proof: `npx vitest run domain/agreement/list-filter.test.ts -t "C1348:"` in `web/`

**C1349** - `AgreementLister.list({})` returns one row per agreement of the org in any status, so all 8 fixture rows
including `withdrawn`, newest `updated_at` first, each with id, number, site name, customer name, status, latest
version number, annual total in cents, `updatedAt`, and `termEnd` (string or null) (AC 1, door 2)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1349:"` in `web/`

**C1350** - `list({ siteId })` returns only agreements of that site, and with a site that has none it returns `[]`
(AC 3)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1350:"` in `web/`

**C1351** - `list({ expiring: true }, today)` keeps an `accepted` agreement whose latest version `term_end` is `today`
or `today + 90 days` and drops one at `today - 1`, at `today + 91`, one with no `term_end`, and a `sent` agreement
with `term_end` inside the window; it reads the `term_end` of the latest version, not an older one (AC 4)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1351:"` in `web/`

**C1352** - `list` with `{ status: "sent", siteId, expiring: true }` returns only rows that satisfy all three, and a
row that fails any one is absent (AC 5)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1352:"` in `web/`

**C1353** - The list view renders each row as a link to `/agreements/{id}` showing its number, site, customer, a status
pill with the agreement status label, `v{n}`, and the annual total as `$4,000/yr`-style text; a row with `termEnd`
renders the date, and a row without one renders no placeholder (AC 1)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1353:"` in `web/`

**C1354** - With no rows and no filter the view renders "No agreements yet"; with rows removed by a filter it renders
`No agreements match` and a "Clear filters" link whose `href` is `/agreements`, and "No agreements yet" is absent (AC 7)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1354:"` in `web/`

**C1355** - The filter bar renders a labelled status `Select` whose selected option is the current `status`, a labelled
site `Select` listing the org's sites with the current `site` selected, and an "Expiring soon" control that is
pressed only when `expiring=1`; none of them is rendered with a bare `<select>` without a visible label (AC 2, 3, 4)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1355:"` in `web/`

**C1356** - The `/agreements` page reads `searchParams`, passes the parsed filter and the Vancouver business day to the
lister, and renders the view; an invalid `status` yields the same rows as no `status` (AC 1, 6)
Proof: `npx vitest run "app/(app)/agreements-list.test.ts" -t "C1356:"` in `web/`

**C1357** - A signed-out member opening `/agreements` or `/agreements/new` is redirected to `/login` and no lister
is called (AC 10)
Proof: `npx vitest run "app/(app)/agreements-list.test.ts" -t "C1357:"` in `web/`

**C1358** - `MAIN_NAV` "Agreements" has `href` `/agreements`, and the sidebar marks it active for `/agreements` and
`/agreements/ag-1` and not for `/pipeline` (AC 8)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1358:"` in `web/`

### S2 - start an agreement from the board and the list · 8 files · ~75 KB · ~20k

**C1359** - The Pipeline header for a writer renders "New agreement" as a link (`<a>`) with `href` `/agreements/new`
and no `disabled` attribute; the empty-board view does the same (AC 11)
Proof: `npx vitest run components/kanban/pipeline-view.test.ts -t "C1359:"` in `web/`

**C1360** - For `viewer`, neither the Pipeline header nor the `/agreements` header renders "New agreement" (AC 15)
Proof: `npx vitest run components/kanban/pipeline-view.test.ts -t "C1360:"` and
`npx vitest run components/agreements/agreements-list.test.ts -t "C1360:"` in `web/`

**C1361** - `SiteLister.listActive` returns the active sites of the org with their customer name and, per site, its
live agreement (`draft`, `sent` or `changes_requested`) as id and number or null; an inactive site is absent; an
`expired` or `refused` agreement is not a live agreement (AC 12)
Proof: `npx vitest run infrastructure/supabase/readers.test.ts -t "C1361:"` in `web/`

**C1362** - The new-agreement form renders a labelled `Select` with one option per site that has no live agreement,
grouped under its customer name; a site with a live agreement is absent from the `Select` and renders as a link
`AG-n` to `/agreements/{id}` (AC 12)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1362:"` in `web/`

**C1363** - Submitting the form with a chosen site calls the existing `createAgreementAction` with that `siteId` once,
and the page for a `viewer` renders a forbidden panel and no form (AC 13, 15)
Proof: `npx vitest run "app/(app)/agreements-list.test.ts" -t "C1363:"` in `web/`

**C1364** - When `createAgreementAction` returns `open_exists`, the form shows the existing agreement's link
`AG-n`, and when it returns a `site_inactive` failure it shows the `messageFor` text for that failure; the action
itself and `messageFor` are not changed (AC 14)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1364:"` in `web/`

**C1365** - With no eligible site the page renders an empty panel with a link to `/customers`, and no `Select` (AC 16)
Proof: `npx vitest run components/agreements/agreements-list.test.ts -t "C1365:"` in `web/`

### Delivery · ~8k

**C1366** - The `/agreements` list at 375 px has no horizontal scroll, every control and row link is at least 44 px
high, and a filtered URL (`?status=sent&expiring=1`) shows only matching rows with the filter controls reflecting
them; at 768 and 1440 px the same page renders without overlap (AC 9)
Proof: live (Playwright at 375, 768 and 1440 px, one signed-in context), result in the Handoff

**C1367** - As the demo estimator, "New agreement" on Pipeline opens `/agreements/new`, choosing a fictitious demo site
creates a draft and lands on `/agreements/{id}`, and returning to `/agreements` lists it with status Draft (AC 11, 12, 13)
Proof: live (Playwright at 1440 px, one signed-in context), result in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| door 1: status filter values (7) | in_progress C1348 · sent C1348 · accepted C1348 · completed C1348 · refused C1348 · expired C1348 · withdrawn C1348 | - |
| door 1: filter parameters (3) | status C1347 · site C1347 · expiring C1347 | - |
| door 2: `AgreementLister` fields (9) | id C1349 · number C1349 · site C1349 · customer C1349 · status C1349 · version C1349 · annual cents C1349 · updated C1349 · term end C1349 | - |
| door 2: `SiteLister` fields (3) | customer name C1361 · live agreement C1361 · inactive excluded C1361 | - |
| fixture rows (8) | draft C1348 · changes_requested C1348 · sent C1348 · accepted no contract C1348 · accepted completed C1348 · refused C1348 · expired C1348 · withdrawn C1348, C1349 | - |
| expiring boundaries (5) | today C1351 · today+90 C1351 · today-1 C1351 · today+91 C1351 · no term end C1351 | - |
| `GET /agreements` statuses (2) | 200 C1356 · 307 to `/login` C1357 | - |
| `GET /agreements/new` statuses (3) | 200 C1362 · 307 to `/login` C1357 · forbidden panel for viewer C1363 | - |
| roles for "New agreement" (4) | owner C1359 · admin C1359 · estimator C1359 · viewer C1360 | - |
| plan `Observable` states (7) | empty C1354 · no match C1354 · unauthorised C1357 · ordering C1349 · density C1353 · new empty C1365 · new unauthorised C1363 | - |
| create outcomes on the form (3) | created C1363 · open_exists C1364 · site_inactive C1364 | - |

- Observable rows with no check of their own: loading (a new `loading.tsx`, rendered by the framework; C1366 sees it
  while the page loads), error (the existing `app/(app)/error.tsx` boundary applies unchanged), destructive action
  (n/a in the plan), API versioning and rate limits (n/a in the plan)
- Claims naming a status code, route or response shape: C1356, C1357, C1358, C1359, C1363 - each has a proof that
  crosses the page or the link, not only a helper
- Criterion AC 9 is proven only by the live run C1366 (a viewport claim a static render cannot settle)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1347 (every filter parameter, malformed values dropped), C1351 (window boundaries)
- failure modes: C1364 (create failure shown with the existing message); a reader error throws to the existing error
  boundary, unchanged
- idempotency: C1364 (`open_exists` shows the existing agreement instead of a second one)
- authorization: C1357 (signed out), C1360 and C1363 (viewer); RLS on `agreements` and `sites` is unchanged and still
  scopes both listers to the member's org
- concurrency: existing - `create_agreement` locks the site and the partial unique index `agreements_one_live_per_site`
  decide a race; C1364 proves the loser sees `open_exists`
- data lifecycle: n/a - the listers only read, and no stored shape changes; inactive and terminal rows stay readable
  by C1349 and C1361
- dependency failure: n/a - only Supabase, through the existing client
- state transitions: n/a - creation goes through the unchanged `create_agreement`; no transition is added
- observability: n/a - no read path in this codebase logs, and the plan adds no logging requirement

## Out of scope

Carried by the plan: pagination and text search, bulk actions and export, the Sites & equipment, Imports and Task
library pages, any change to the Pipeline board's rules or `?view=expiring`.

## Handoff

- Read set, measured with `wc -c` before this was written: `ports/index.ts` 32.7 KB, `readers.ts` 16.4 KB,
  `readers.test.ts` 24.6 KB, `composition/index.ts` 9.5 KB, `pipeline-view.tsx` 5.3 KB, `pipeline-view.test.ts` 9.1 KB,
  `pipeline/page.tsx` 1.2 KB, `agreement-actions.ts` 9.2 KB, `state.ts` 3.2 KB, `customers-view.tsx` 4.9 KB (pattern),
  `new-agreement.tsx` 1.8 KB, `domain/agreement/index.ts` 12.1 KB, `nav-items.ts` and its test 1.2 KB,
  `pipeline.test.ts` 1.7 KB: 133 KB, about 33k tokens, plus the new files.
- Slice estimates are in the slice headers: S1 ~28k, S2 ~20k, delivery ~8k. About 56k against the 150k budget, all in
  one surface (the web app, no migration) - one builder, no ask.
- Mechanism: one builder.
- Before the last commit the builder also runs `npm test`, `npm run lint` and `npx tsc --noEmit` in `web/` and reviews
  `git diff <feature base>..HEAD -- "*.test.ts"` against the Terms (only the listed assertions replaced). This is a
  hygiene gate, not a check, because a green suite settles no single claim.

- **Boundary:** C1347-C1365 closed at `c9d31f2`; C1366 run live (below); C1367 partly
- **Settled mid-build:**
  - `site_inactive` from `create_agreement` is mapped by the existing adapter to `unavailable`, so C1364 proves the `unavailable` message (the form lists only active sites, so this is a race).
  - The adapter applies the site filter and the newest-first order itself as well as asking the database, so its output holds under the stub.
  - `businessDay` moved from `pipeline/page.tsx` to `lib/business-day.ts` to share it.
  - A withdrawn row renders a neutral pill, not a Refused-stage dot (found in the live run).
- **Live C1366:** `/agreements` at 375, 768 and 1440 px, one signed-in context: no horizontal scroll; `?status=accepted&expiring=1` lists 1 row (AG-1035, term end 2026-11-22) with the controls reflecting it. Controls and rows are at least 44 px below 1024 px (the only smaller boxes are the text labels above the selects and the 16 px checkbox inside its 44 px label); 34 px at 1440 px by design. Console: no errors.
- **Live C1367, partly:** Pipeline "New agreement" is a link to `/agreements/new`, which shows the grouped picker and the three sites with an agreement in progress (AG-1044, AG-1057, AG-1051) as links. Pressing "Create agreement" writes a row to the demo org and was not run; it needs your go-ahead.
- **Abandoned:** nothing.

