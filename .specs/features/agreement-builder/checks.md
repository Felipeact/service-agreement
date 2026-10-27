# Agreement builder: create an agreement for a site, price it with service lines, and keep its versions - checks

Profile: standard
Plan: `.specs/features/agreement-builder/plan.md`

57 checks in 5 slices plus doors and delivery · 7 one-way doors · 0 open

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C701:`).
  This feature numbers from C701, because earlier features own up to `C658:`. Proofs name the
  folder their test file sits in; the file inside it is the builder's call.
  - Pure domain code (the validator, the status label) is tested in `domain/agreement` with
    literal values.
  - The Supabase adapters are tested in `infrastructure/supabase` with the recording `stubClient`,
    which gains whatever chain methods the adapters use, each recorded.
  - Components are asserted with `renderToStaticMarkup`; a client control's state is passed as
    props to its presentational component, as the import features did (lesson L-014: a fix that
    lands in a stateful control gets a proof that imports that control).
  - Server Actions and the page are called directly with `@/composition`, `next/cache` and
    `next/navigation` mocked, as `app/(app)/import-review.test.ts` does.
- **test:db** - `npm run test:db agreement_builder` in `web/` (AD-026) runs `fixture.sql` and then
  the new `supabase/tests/agreement_builder.sql`, rolled back. The file joins `RECIPES` as
  `plain("agreement_builder")` and passes only when its last row is `agreement_builder: pass`. Each
  assertion is labelled with its check id. Fixture: org A owner `uA`, estimator `uE`, viewer `uV`;
  org B owner `uB`; `siteA`, `siteB`, `agrA` (`draft`, versions 1 and 2), `agrB`. The test file
  inserts further sites, agreements, versions and lines as the table owner (`auth.uid()` null),
  with the statuses each check needs.
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated count.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, in one signed-in context
  as the demo owner (memory: one context only). Not committed (AGENTS..md). A failed request is a
  4xx/5xx answer or a network error; Server Action and RSC streams aborted after a 200 are
  acceptable (lesson L-008).

Terms: "writer view" is a view rendered with role `estimator`, "viewer view" with role `viewer`.
"The RPC" is `public.create_agreement`; "the revise RPC" is `public.apply_agreement_transition`;
"the trigger" is `service_lines_frozen`; "the validator" is `validateServiceLine` in
`domain/agreement`; "the reader" is `AgreementReader`'s adapter; "the agreement store" and "the
line store" are the `AgreementStore` and `ServiceLineStore` adapters; "the agreement view" is the
presentational component the page renders; "the six actions" are `createAgreementAction`,
`addServiceLineAction`, `updateServiceLineAction`, `removeServiceLineAction`,
`reviseAgreementAction`, `withdrawAgreementAction`. The **status label** of an agreement is
`STAGE_META[pipelineStage(status, contract)].label`, or `Withdrawn` when the stage is null because
the agreement is `withdrawn`, or `Contract voided` when it is null because the contract is
`voided` (derived: AC 8 and 22 name "the stage label", and those two have no stage).

## Checks

### S1 - A writer starts an agreement for a site · ~12 files · ~30k

**C701** - the site register view renders a "New agreement" submit button posting
`createAgreementAction` with the site id when `liveAgreement` is null, in the writer view; the
viewer view with the same site renders no "New agreement" (AC 1, AC 24)
Proof: `npx vitest run components/sites -t "C701:"`

**C702** - the site register view, given `liveAgreement` `{ id, number: "AG-1048", status }`,
renders a link with `href` exactly `/agreements/<id>` and text `AG-1048 · In progress` for
`draft`, `AG-1048 · Sent to customer` for `sent`, `AG-1048 · In progress` for
`changes_requested`, in both the writer view and the viewer view, and no "New agreement" button,
table-driven over the 3 live statuses × 2 roles (AC 2)
Proof: `npx vitest run components/sites -t "C702:"`

**C703** - `SiteRegister.get` returns `liveAgreement` as the site's agreement whose status is
`draft`, `sent` or `changes_requested` (`{ id, number, status }`), and `null` when the site's only
agreements are `accepted`, `refused`, `expired` or `withdrawn` or it has none, table-driven over
the 7 statuses plus none (AC 2, door 7)
Proof: `npx vitest run infrastructure/supabase -t "C703:"`

**C704** - the RPC called by the estimator `uE` on a site of org A with no agreement returns an
id; that agreement has `status` `draft`, `site_id` the site, `org_id` org A, exactly one version
with `version_no` 1 and `snapshot` `{}`, 0 service lines, and no event row (AC 3, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C704`)

**C705** - `createAgreementAction` as a writer with a well-formed site id calls
`AgreementStore.create(siteId)` once and, on `{ ok: true, id }`, redirects to exactly
`/agreements/<id>` (AC 3)
Proof: `npx vitest run "app/(app)" -t "C705:"`

**C706** - the RPC numbers agreements per org: on an org with no numbered agreement the new one is
`AG-1001`; on an org whose agreements are numbered `AG-1048`, `AG-1051`, `X-9` and null the new one
is `AG-1052`; a second call then gives `AG-1053`; org B holding `AG-5000` does not change org A's
next number (AC 4, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C706`)

**C707** - the constraint `agreements_org_id_number_key`: inserting a second `AG-1048` in org A
fails with `23505`; `AG-1048` in org B alongside org A's succeeds; two agreements with a null
number in one org succeed (AC 5, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C707`)

**C708** - the RPC's definition (`pg_get_functiondef`) takes
`pg_advisory_xact_lock(hashtextextended('agreement_number:' || ...` before it reads the highest
number, so two creates in one org serialise; the SQL suite runs one session and cannot race them,
so C707's constraint is the backstop that makes a lost race fail rather than duplicate (AC 5,
door 1)
Proof: `npm run test:db agreement_builder` (assertions `C708`)

**C709** - the index `agreements_one_live_per_site`: the RPC on a site that already has an
agreement in `draft`, `sent` or `changes_requested` fails with `23505` and adds no agreement; on a
site whose only agreement is `accepted`, `refused`, `expired` or `withdrawn` it succeeds,
table-driven over all 7 statuses (AC 6, door 2)
Proof: `npm run test:db agreement_builder` (assertions `C709`)

**C710** - the agreement store's `create` maps the RPC's errors: `23505` to `{ ok: false, code:
"open_exists", agreementId, number }` read from the site's live agreement, `P0002` to
`not_found`, `42501` to `forbidden`, any other error to `unavailable` with one `console.error`,
table-driven over the 4 cases (AC 6, AC 7, AC 25, AC 28)
Proof: `npx vitest run infrastructure/supabase -t "C710:"`

**C711** - `createAgreementAction` returns `{ status: "open_exists", agreementId, number }` when
the store answers `open_exists`, and the site register view given that state renders
`AG-1048 is already in progress for this site.` with a link whose `href` is exactly
`/agreements/<agreementId>` (AC 6)
Proof: `npx vitest run "app/(app)" -t "C711:"`
Proof: `npx vitest run components/sites -t "C711:"`

**C712** - `createAgreementAction` with a malformed site id (`"abc"`, `""`) returns
`{ status: "not_found" }` without calling the store; the RPC with a missing site id and with org
B's site as `uE` fails with `P0002` and adds no agreement (AC 7, AC 26)
Proof: `npx vitest run "app/(app)" -t "C712:"`
Proof: `npm run test:db agreement_builder` (assertions `C712`)

### S2 - A writer prices the draft with service lines · ~14 files · ~38k

**C713** - the agreement view given an agreement `AG-1052`, status `draft`, customer
`{ id: c1, name }`, site `{ id: s1, name }`, shown version 2 with lines `Preventive maintenance
visit` (4, 89,250 cents) and `Filter changes` (2, 15,000 cents) renders: `AG-1052`, the pill
`In progress`, a customer link with `href` `/customers/c1`, a site link with `href` `/sites/s1`,
`Version 2`, each line's description, visits `4` / `2`, cost `$892.50` / `$150.00`, annual
`$3,570.00` / `$300.00`, and `Total per year $3,870.00` with `Before tax` (AC 8)
Proof: `npx vitest run components/agreements -t "C713:"`

**C714** - the reader returns the shown version's lines ordered by `position`, then by
`created_at`, given stub rows out of that order (positions 2, 0, 1 and two lines at position 1
created 10:00 and 09:00) (AC 8)
Proof: `npx vitest run infrastructure/supabase -t "C714:"`

**C715** - the agreement view with an editable shown version and no lines renders `No service
lines yet.`; in the writer view it renders the add form with description value `Preventive
maintenance visit`, visits value `4` and an empty cost; in the viewer view it renders no form
(AC 9)
Proof: `npx vitest run components/agreements -t "C715:"`

**C716** - the agreement view renders "Add line", and "Edit" and "Remove" on each line, only for a
writer on the current version of a `draft` agreement: table-driven over 2 roles × 7 statuses ×
{current, past} version (28 cases), each case asserting all three labels present or all three
absent (AC 10, AC 22, AC 24)
Proof: `npx vitest run components/agreements -t "C716:"`

**C717** - as the estimator `uE`, on the current version of a `draft` agreement of org A, a line
insert, an update of its description and a delete each succeed and affect exactly 1 row (AC 11,
door 4)
Proof: `npm run test:db agreement_builder` (assertions `C717`)

**C718** - `addServiceLineAction` as a writer with description `"  Preventive maintenance visit "`,
visits `"4"` and cost `"$892.50"` calls `ServiceLineStore.add(agreementId, { description:
"Preventive maintenance visit", visitsPerYear: 4, costPerVisitCents: 89250 })` once, calls
`revalidatePath("/agreements/<agreementId>")`, and returns `{ status: "saved" }` (AC 11)
Proof: `npx vitest run "app/(app)" -t "C718:"`

**C719** - the line store's `add` reads the agreement's highest `version_no`, inserts into that
version with `org_id` taken from the version row read under RLS, and `position` one more than
the version's highest position (0 for an empty version); the recorded insert payload has exactly
the keys `org_id`, `agreement_version_id`, `position`, `description`, `visits_per_year`,
`cost_per_visit_cents` (AC 11, AC 29, door 7)
Proof: `npx vitest run infrastructure/supabase -t "C719:"`

**C720** - the validator, table-driven: description `""`, `"   "` and 201 characters are refused
with a description message, 1 and 200 characters (after trimming) are accepted and returned
trimmed; visits `""`, `"0"`, `"366"`, `"4.5"`, `"abc"` are refused with a visits message, `"1"` and
`"365"` give 1 and 365; cost `""`, `"-5"`, `"abc"`, `"1.234"`, `"1,23"`, `"1,000,000"` are refused
with a cost message, `"0"` gives 0, `"892.50"` gives 89250, `"$1,234.5"` gives 123450,
`"999,999.99"` gives 99999999; an input bad in all three fields returns all three messages (AC 12,
AC 13)
Proof: `npx vitest run domain/agreement -t "C720:"`

**C721** - `addServiceLineAction` and `updateServiceLineAction` with a cost of `"abc"` return
`{ status: "invalid", errors }` with a `costPerVisit` message and do not call the store; the line
form given that state renders the message under the cost field, linked by `aria-describedby`
(AC 13)
Proof: `npx vitest run "app/(app)" -t "C721:"`
Proof: `npx vitest run components/agreements -t "C721:"`

**C722** - the line store's `add` on a version holding 50 lines returns `{ ok: false, code:
"too_many" }` and records no insert; `addServiceLineAction` returns `{ status: "too_many" }`; the
line form given that state renders `An agreement version can have at most 50 lines.` (AC 14)
Proof: `npx vitest run infrastructure/supabase -t "C722:"`
Proof: `npx vitest run "app/(app)" -t "C722:"`
Proof: `npx vitest run components/agreements -t "C722:"`

**C723** - the remove prompt for a line `Filter changes` renders `Remove Filter changes?`, a
submit button "Remove" inside the form that posts `removeServiceLineAction` with the line id, and
a "Cancel" button of `type="button"` outside that form's submit path (AC 15)
Proof: `npx vitest run components/agreements -t "C723:"`

**C724** - `removeServiceLineAction` as a writer calls `ServiceLineStore.remove(lineId)` once and
returns `{ status: "removed" }`; `updateServiceLineAction` with valid fields calls
`ServiceLineStore.update(lineId, value)` once and returns `{ status: "saved" }` (AC 11, AC 15)
Proof: `npx vitest run "app/(app)" -t "C724:"`

**C725** - the reader computes each line's `annualCents` as visits × cost and `shown.annualCents`
as their sum: lines (4, 89,250) and (2, 15,000) give 357,000, 30,000 and 387,000; a version with
no lines gives 0 (AC 16)
Proof: `npx vitest run infrastructure/supabase -t "C725:"`

### S3 - Versions are a record, and a requested change starts the next one · ~8 files · ~20k

**C726** - the agreement view given versions 1, 2 and 3 (current 3) renders them in the order 3,
2, 1, each with its creation date formatted `en-CA` medium in `America/Vancouver` (as the import
job list), `Current` beside version 3 only, and links with `href` exactly `/agreements/<id>?version=3`,
`?version=2`, `?version=1`; given one version it renders no version list (AC 17)
Proof: `npx vitest run components/agreements -t "C726:"`

**C727** - the reader `get(id, 1)` on an agreement with versions 1 and 2 returns `shown.versionNo`
1, `shown.current` false and version 1's lines; `get(id)`, `get(id, 9)` and `get(id, 0)` return
version 2 with `current` true; the page passes `?version` `"abc"`, `"1.5"` and `""` to the reader
as no version (AC 18)
Proof: `npx vitest run infrastructure/supabase -t "C727:"`
Proof: `npx vitest run "app/(app)" -t "C727:"`

**C728** - the agreement view showing version 1 of 3 renders `Version 1 of 3, read-only` and none
of "Add line", "Edit", "Remove" in the writer view of a `draft` agreement (AC 18)
Proof: `npx vitest run components/agreements -t "C728:"`

**C729** - the agreement view renders "Start version <n + 1>" (`Start version 3` for current
version 2) only in the writer view of a `changes_requested` agreement, table-driven over 7 statuses
× 2 roles (AC 19, AC 24)
Proof: `npx vitest run components/agreements -t "C729:"`

**C730** - the revise RPC as `uE` on an agreement in `changes_requested` whose version 1 holds 2
lines (positions 0 and 1) moves it to `draft`, creates version 2 holding 2 lines equal to version
1's in `description`, `visits_per_year`, `cost_per_visit_cents` and `position`, with new ids; version
1 still holds exactly its 2 original lines with their original ids and values (AC 20, door 5)
Proof: `npm run test:db agreement_builder` (assertions `C730`)

**C731** - `reviseAgreementAction` as a writer calls `transitionAgreement({ agreementId, command:
{ type: "revise" } })` once and on `ok` redirects to exactly `/agreements/<agreementId>` (AC 20)
Proof: `npx vitest run "app/(app)" -t "C731:"`

**C732** - the agreement view renders "Withdraw" only in the writer view of a `draft` or `sent`
agreement, table-driven over 7 statuses × 2 roles; the withdraw prompt for `AG-1052` renders
`Withdraw AG-1052? It leaves the pipeline and frees the site for a new agreement.` with a submit
"Withdraw" posting `withdrawAgreementAction` and a "Cancel" of `type="button"` (AC 21, AC 24)
Proof: `npx vitest run components/agreements -t "C732:"`

**C733** - `withdrawAgreementAction` as a writer calls `transitionAgreement({ agreementId,
command: { type: "withdraw" } })` once and on `ok` returns `{ status: "withdrawn" }` (AC 21)
Proof: `npx vitest run "app/(app)" -t "C733:"`

**C734** - the status label, table-driven: `draft` `In progress`, `changes_requested` `In
progress`, `sent` `Sent to customer`, `accepted` `Accepted, awaiting signature`, `accepted` with a
`completed` contract `Completed`, `refused` `Refused`, `expired` `Refused`, `withdrawn`
`Withdrawn`, `accepted` with a `voided` contract `Contract voided`; and the agreement view of a
non-`draft` agreement renders `<status label>, read-only` (`Sent to customer, read-only`) (AC 8,
AC 22)
Proof: `npx vitest run domain/agreement -t "C734:"`
Proof: `npx vitest run components/agreements -t "C734:"`

### S4 - Only the latest draft changes, and only writers change it · ~10 files · ~22k

**C735** - the trigger, as `uE`, table-driven over insert, update and delete: on a line of an older
version of a `draft` agreement each fails with `55000`; on the current version of an agreement in
`sent`, `accepted`, `refused`, `changes_requested`, `expired` or `withdrawn` each fails with
`55000`; as the table owner (no `auth.uid()`) an insert on a `sent` agreement's version succeeds
(AC 23, door 4)
Proof: `npm run test:db agreement_builder` (assertions `C735`)

**C736** - the trigger after a status change in the same session: as `uE`, after
`apply_agreement_transition` moves a `draft` agreement to `withdrawn`, an update of its current
version's line fails with `55000`; after a revise, an update of version n's line fails with
`55000` and version n + 1's succeeds; the trigger function reads the agreement `for share`
(`pg_get_functiondef`) (AC 23, door 4)
Proof: `npm run test:db agreement_builder` (assertions `C736`)

**C737** - the line store maps `55000` to `{ ok: false, code: "locked" }` for `add`, `update` and
`remove`; the three line actions pass `locked` through as `{ status: "locked" }`; the line form
and the remove prompt given that state render `This version can no longer be changed.` (AC 23)
Proof: `npx vitest run infrastructure/supabase -t "C737:"`
Proof: `npx vitest run "app/(app)" -t "C737:"`
Proof: `npx vitest run components/agreements -t "C737:"`

**C738** - as the viewer `uV`: the RPC fails with `42501` and adds no agreement; a line insert
fails with `42501`, and an update and a delete of org A's current draft line affect 0 rows (AC 25)
Proof: `npm run test:db agreement_builder` (assertions `C738`)

**C739** - each of the six actions called with a viewer member returns `{ status: "forbidden" }`
and calls no store and no `transitionAgreement`, table-driven over the 6 actions (AC 25)
Proof: `npx vitest run "app/(app)" -t "C739:"`

**C740** - the agreement page as a viewer renders none of "New agreement", "Add line", "Edit",
"Remove", "Start version", "Withdraw" for a `draft` agreement with lines (AC 24)
Proof: `npx vitest run "app/(app)" -t "C740:"`

**C741** - not found: each of the six actions with a malformed id (`"abc"`) returns
`{ status: "not_found" }` without calling a store, table-driven over the 6; the line store's
`update` and `remove` with a well-formed id that matches no row return `not_found`; the reader
returns `null` for a malformed id and for no row, and the page calls `notFound()` for both (AC 26)
Proof: `npx vitest run "app/(app)" -t "C741:"`
Proof: `npx vitest run infrastructure/supabase -t "C741:"`

**C742** - as `uE` of org A: org B's agreement, versions and lines read 0 rows; an update and a
delete of org B's line affect 0 rows; a line insert into org B's version fails (`42501` or
`23503`); the revise RPC on org B's agreement fails with `P0002` (AC 26)
Proof: `npm run test:db agreement_builder` (assertions `C742`)

**C743** - `reviseAgreementAction` and `withdrawAgreementAction` return `{ status: "conflict" }`
when `transitionAgreement` answers `conflict`, `{ status: "invalid_transition" }` when it answers
`invalid_transition`, and `{ status: "not_found" }` for `not_found`; the agreement view given
`conflict` renders `This agreement changed meanwhile. Reload to see it.` (AC 27)
Proof: `npx vitest run "app/(app)" -t "C743:"`
Proof: `npx vitest run components/agreements -t "C743:"`

**C744** - unexpected failures: the line store's `add`, `update` and `remove` and the agreement
store's `create` map an unexpected error (and an unexpected error on any read they make first) to
`unavailable` with exactly one `console.error`; every write action passes it through as
`{ status: "unavailable" }`; the line form given that state renders `We couldn't save this. Try
again.` (AC 28, lesson L-012)
Proof: `npx vitest run infrastructure/supabase -t "C744:"`
Proof: `npx vitest run "app/(app)" -t "C744:"`
Proof: `npx vitest run components/agreements -t "C744:"`

**C745** - member client only: the new adapters are built from the same request client as every
other store in `getContainer()`, and `grep -rEi "service_role|SERVICE_ROLE" web/infrastructure
web/composition web/app` finds 0 lines; `addServiceLineAction` given a form that also carries
`orgId` and `org_id` fields calls the store with exactly `(agreementId, value)` (AC 29)
Proof: `npx vitest run composition -t "C745:"`
Proof: `npx vitest run "app/(app)" -t "C745:"`
Proof: shell `grep -rEic "service_role" infrastructure composition app | grep -v ":0" | wc -l` prints `0`

### S5 - The agreement is reachable from where it shows up · ~4 files · ~8k

**C746** - the pipeline view given three cards with ids `a1`, `a2`, `a3` renders each card as a
link with `href` exactly `/agreements/a1`, `/agreements/a2`, `/agreements/a3` (AC 30, lesson L-006)
Proof: `npx vitest run components/kanban -t "C746:"`

**C747** - the customer detail view given agreements `g1` and `g2` renders each row as a link with
`href` exactly `/agreements/g1` and `/agreements/g2` (AC 31, lesson L-006)
Proof: `npx vitest run components/customers -t "C747:"`

### Doors and delivery · ~12 files · ~20k

**C748** - the ports exist with door 7's shapes: `AgreementReader`, `AgreementStore`,
`ServiceLineStore` and `SiteView.liveAgreement` in `application/ports`, and `npx tsc --noEmit`
exits 0 with a type test that assigns door 7's literal result shapes to them (door 7)
Proof: shell `npx tsc --noEmit`
Proof: `npx vitest run composition -t "C748:"`

**C749** - `getContainer()` exposes `agreementReader`, `agreementStore` and `serviceLineStore`
(composition)
Proof: `npx vitest run composition -t "C749:"`

**C750** - the page `/agreements/[agreementId]` reads `searchParams` in a child inside
`<Suspense>` (AD-022) and `npx next build` exits 0; `npm run lint` exits 0 (door 6)
Proof: shell `npx next build`
Proof: shell `npm run lint`

**C751** - the revise RPC keeps its grants: `anon` cannot execute it (`42501`), and `anon` cannot
execute the RPC; `has_function_privilege('authenticated', 'public.create_agreement(uuid)',
'execute')` is true (door 3, door 5)
Proof: `npm run test:db agreement_builder` (assertions `C751`)

**C752** - the migration file is `supabase/migrations/<version>_agreement_builder.sql`, where
`<version>` is the version `list_migrations` reports for `agreement_builder` (AD-006)
Proof: mcp `list_migrations` compared with `ls ../supabase/migrations`

**C753** - `database.types.ts` equals `generate_typescript_types` after the migration, apart from
the file's header (types)
Proof: mcp `generate_typescript_types`, diff recorded in the Handoff

**C754** - `get_advisors` type `security` reports exactly `rls_enabled_no_policy` on
`public.outbox` and `auth_leaked_password_protection` (security advisors)
Proof: mcp `get_advisors`

**C755** - every SQL recipe passes, now 15 with `agreement_builder`: the earlier recipes keep every
assertion (fixtures rearranged, not assertions), and `demo_seed` (SEED_BODY run twice) passes with
the trigger in place (Impact: tests, seed)
Proof: shell `npm run test:db`

**C756** - live, as the demo owner, at 1440, 768 and 375 px with touch: on a site with no live
agreement, "New agreement" opens `/agreements/<id>` showing the next `AG-<n>` and `Version 1`;
adding "Preventive maintenance visit, 4, $892.50" and "Filter changes, 2, $150" shows `Total per
year $3,870.00`; `/pipeline` shows the card in "In progress" with $3,870 and the card opens the
agreement; on demo AG-1048 "Start version 2" shows the copied line editable and `?version=1`
read-only; Remove and Withdraw confirm before acting; no horizontal page scroll, no touch target
under 44 px at 768 and 375, 0 console errors on a clean load, no failed request (S1-S5)
Proof: live, recorded in the Handoff

**C757** - docs: `CONTEXT.md` "Service agreement (M7, M8)" names `/agreements/[agreementId]`,
`create_agreement` and `service_lines_frozen`, and has a dated Build log line for this feature;
ROADMAP Phase 3 item 1 is `[x]`; `STATE.md` has `AD-051` onwards for doors 1 to 7
Proof: shell `grep -c "create_agreement\|service_lines_frozen\|/agreements/\[agreementId\]" ../CONTEXT.md` prints at least `3`
Proof: shell `grep -c "\[x\] Agreement builder" ../ROADMAP.md` prints `1`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| page `GET /agreements/[agreementId]` statuses (3) | `200` C713 · C740 · `404` C741 · login redirect existing `MemberGate` (staff-screens) · C756 | - |
| `createAgreementAction` states (5) | redirect C705 · `open_exists` C711 · `forbidden` C739 · `not_found` C712 · `unavailable` C744 | - |
| `addServiceLineAction` states (7) | `saved` C718 · `invalid` C721 · `too_many` C722 · `locked` C737 · `forbidden` C739 · `not_found` C741 · `unavailable` C744 | - |
| `updateServiceLineAction` states (6) | `saved` C724 · `invalid` C721 · `locked` C737 · `forbidden` C739 · `not_found` C741 · `unavailable` C744 | - |
| `removeServiceLineAction` states (5) | `removed` C724 · `locked` C737 · `forbidden` C739 · `not_found` C741 · `unavailable` C744 | - |
| `reviseAgreementAction` states (5) | redirect C731 · `conflict` C743 · `invalid_transition` C743 · `forbidden` C739 · `not_found` C743 · C741 | - |
| `withdrawAgreementAction` states (5) | `withdrawn` C733 · `conflict` C743 · `invalid_transition` C743 · `forbidden` C739 · `not_found` C743 · C741 | - |
| agreement statuses at "live" (7) | C703, C709, table-driven over all 7 | - |
| statuses at the line controls, 7 × 2 roles × 2 versions (28) | C716, table-driven over all 28 | - |
| statuses at "Start version", 7 × 2 roles (14) | C729, table-driven over all 14 | - |
| statuses at "Withdraw", 7 × 2 roles (14) | C732, table-driven over all 14 | - |
| status labels (9) | C734, table-driven over all 9 | - |
| trigger cases (6) | older version C735 · 6 non-draft statuses C735 · non-member write C735 · after withdraw C736 · after revise C736 · current draft accepted C717 | - |
| numbering cases (4) | empty org C706 · after highest C706 · non-matching ignored C706 · other org ignored C706 | - |
| number uniqueness (3) | duplicate refused C707 · other org allowed C707 · nulls allowed C707 | - |
| validator edges (23) | C720, table-driven over all 23 | - |
| `create` adapter mapping (4) | C710, table-driven over all 4 | - |
| line store outcomes (6) | ok C719 · `too_many` C722 · `locked` C737 · `not_found` C741 · `unavailable` C744 · `forbidden` via RLS refusal C739 · C738 | - |
| version selection (6) | `1` C727 · none C727 · `9` C727 · `0` C727 · `abc` C727 · `1.5` C727 | - |
| roles (3 kinds) | writer C704 · C717 · viewer C738 · C739 · C740 · other org C712 · C742 | - |
| alert copy (6) | `open_exists` C711 · too many C722 · `locked` C737 · `conflict` C743 · `unavailable` C744 · invalid C721 | - |
| confirm prompts (2) | remove C723 · withdraw C732 | - |
| links (5 places) | site live link C702 · open_exists link C711 · pipeline card C746 · customer row C747 · version links C726 | - |
| Landing doors (7) | door 1 C706 · C707 · C708 · door 2 C709 · C710 · door 3 C704 · C712 · C738 · C751 · door 4 C735 · C736 · C717 · door 5 C730 · C751 · door 6 C705 · C750 · C756 · door 7 C703 · C719 · C748 · C749 | - |
| entities and relations (4) | `sites` -> `agreements` at most one live C709 · `agreements` -> `agreement_versions` C704 · C730 · `agreement_versions` -> `service_lines` C730 · C719 · `orgs` -> `agreements` number C706 · C707 | - |
| startup config: container assembly (1 place) | `getContainer()` C749 · C745 | - |

- Claims naming an action's answer are proven by calling the Server Action itself; C756 crosses the
  real browser and database.
- Claims about RLS, the constraints, the trigger and both RPCs are proven in SQL as the role in
  question; the stub proofs prove only each adapter's calls and mapping.
- C708 proves the advisory lock is taken; the suite runs one session and cannot race two creates.
  C707 proves a lost race fails rather than duplicates.

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the RPC, the revise RPC, the trigger, the reader, both stores) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (the validator, the status label, the agreement view's control rules) | one at its own layer | one asserted case per row of the decision table |
| Entry point that decides nothing beyond validation (the six actions, the page) | one at the boundary | accepted input, each rejected input, each error path |
| Instrumentation (the container wiring, presentational prompts) | none of its own | covered by its consumer's proof |

Evidence:

- the validator: 3 fields, 23 edges -> decides
- the status label: 9 cases over status × contract -> decides
- the RPC: 3 SQLSTATE outcomes, the numbering rule (4 cases) -> decides
- the trigger: 7 statuses, latest-or-not, member-or-not, 3 operations -> decides
- the agreement view: controls over 2 roles × 7 statuses × 2 versions -> decides
- the line store: 6 outcomes -> decides
- closest analogues: `import_rows_frozen` (C637), `commit_import` (C627-C631), `ImportRowStore` (C636, C647), `validateAsset` (record-forms), each proven at its own layer

Cost: about 40 proofs at their own layer across about 10 files. Without these rows, the control
table and the trigger are proven only by the live run that crosses three of their cases.

## Swept

- validation: C720 (field bounds and money parsing), C721 (messages, no write), C722 (50-line cap), C727 (version parameter), C741 (non-uuid ids)
- failure modes: C744 (unexpected errors become `unavailable`, nothing written), C704 (create writes agreement and version in one transaction), C730 (revise copies in the same transaction)
- idempotency: C709 (a repeated create answers `open_exists` instead of a second agreement), C711
- authorization: C738, C739 (viewers refused in SQL and in the app), C742 (other org), C745 (member client only, org never from the request)
- concurrency: C708 (advisory lock on numbering) with C707 (constraint backstop), C709 (two creates on one site), C735, C736 (trigger against a line write racing a withdraw or revise), C743 (stale status on revise or withdraw)
- data lifecycle: C730 (past versions and their lines are kept unchanged), C735 (past versions frozen); no deletion of agreements exists; nothing to backfill (Impact)
- dependency failure: C744 (database failure); n/a for external services - the builder calls no service but Supabase
- state transitions: C731 (revise), C733 (withdraw), C743 (refused moves), C736 (line writes follow the status)
- observability: C744 (`console.error` on each unexpected failure); version `created_at` records when each version started; the existing events record revise and withdraw; no metric or tracing requirement

## Handoff

- Read set measured with `wc -c` before building (ports, readers and their tests, records and
  supabase index adapters, stub client, composition and its test, record and import actions and
  their tests, the site page and register view and tests, the kanban and customer views and tests,
  the review view as a pattern, domain agreement and money, `lib/money`, `lib/pipeline-stage`, the
  transition and import-review migrations, `fixture.sql`, `transitions.sql`, `rls_roles.sql`,
  `rls_isolation.sql`, `domain_constraints.sql`, the test-db runner, `CONTEXT.md`, `STATE.md`,
  `ROADMAP.md`): 309,988 bytes, about 77k tokens. `database.types.ts` about 9k more.
- Written: migration and `agreement_builder.sql` ~18 KB; validator and status label with tests
  ~8 KB; reader, two stores, site register change, stub changes and tests ~26 KB; actions, page and
  tests ~22 KB; agreement view, line form, prompts, site/kanban/customer changes and tests ~40 KB;
  fixture rearrangement, runner entry, docs ~8 KB. Total ~122 KB, about 31k tokens.
- Live validation (C756): about 40k tokens of snapshots.
- Per slice (each with its share of reading): S1 ~30k + migration ~10k, S2 ~38k, S3 ~20k, S4
  ~22k, S5 ~8k, doors and delivery ~20k, live ~40k, plus the shared read set.
- S1-S2 with the shared read set: about 95k. S3 enters at about 115k, S4 at about 137k, S5 at
  about 145k, doors and delivery at about 157k, and the live run brings it to about 197k against
  the 150k budget. Over the budget.
- Proposed cut, where the surface changes: batch 1 = S1-S4 plus the migration, the SQL suite, the
  ports and the composition (C701-C745, C748, C749, C751, C755), about 137k; batch 2 = S5, build,
  lint, MCP proofs, docs and the live run (C746, C747, C750, C752-C757), about 60k with its own
  smaller read set. Batches run sequentially, the second only on green.
- Production-data note: the migration goes to the live project through MCP `apply_migration`, and
  C756 creates a demo agreement and revises AG-1048 in the live demo org; both need the user's
  go-ahead at that step.
- Earlier exact pins that change: the runner tests (15 recipes, 17 SQL files); `fixture.sql`
  `insert_sql('agreements')` and `insert_sql('service_lines')` and any test inserting a second
  `draft` agreement on one site or a member line on version 1 of `agrA`; `SiteView` expectations
  gaining `liveAgreement`; `KanbanCard` and customer-row markup tests if they match the outer
  element.
- Derived copy not in a numbered AC, flagged for review in the diff: the status labels `Withdrawn`
  and `Contract voided` (C734); `Current` beside the current version (C726).

- Mechanism: handoff (user choice, 2026-10-27): batch 1 = C701-C745, C748, C749, C751, C755; batch 2 = C746, C747, C750, C752-C757, only on green.
- Pre-migration live check (batch 1, 2026-10-27, read-only `execute_sql` on `gnxebrtcpbujhvcamtoe`): 12 agreements,
  0 with a null number, 0 orgs with a repeated `number`, 0 sites with two agreements in `draft` / `sent` /
  `changes_requested`. Doors 1 and 2 apply to the live data without a backfill.
- **Boundary (batch 1):** at `ab5f570` the vitest and shell proofs of C701-C703, C705, C710, C711, C713-C716,
  C718-C729, C731-C734, C737, C739-C741, C743-C745, C748, C749 pass (`npm test` 54 files / 1223 tests, `npm run
  lint` clean, `npx tsc --noEmit` exit 0, the C745 grep prints 0). The SQL proofs C704, C706-C709, C712, C717,
  C730, C735, C736, C738, C742, C751 pass only in a dry run: the migration is NOT applied. Dry run (2026-10-27): every
  recipe run through the runner against `SUPABASE_DB_URL` with
  `supabase/migrations/20261027200000_agreement_builder.sql` spliced in after `fixture.sql`, each ending in rollback:
  15 passed, 0 failed (`agreement_builder: pass` included). Without the migration the 14 older recipes still pass on
  the rearranged fixtures and `agreement_builder` fails (`create_agreement` does not exist). C755 stays pending until
  the migration is applied and `npm run test:db` runs on it.
- **Settled mid-build:** amounts on the agreement page use a new `formatCadExact` (always two decimals), because
  C713 pins `$150.00` / `$3,870.00` and `formatCad` drops whole-dollar decimals; the pipeline keeps `formatCad`. The
  stage labels moved to `STAGE_LABELS` in `domain/pipeline` (`STAGE_META` reads them) so the status label (C734)
  lives in `domain/agreement` without a `lib` import. The migration file carries a placeholder version
  `20261027200000`; batch 2 renames it to the version `apply_migration` records (AD-006, C752). Fixtures rearranged,
  no assertion changed: `fixture.sql` puts `lineA`/`lineB` on version 2 (the current one), `insert_sql('agreements')`
  inserts `withdrawn`, `insert_sql('service_lines')` aims at the agreement's latest version via
  `tests.latest_version`; `domain_constraints.sql` C16 gives each status its own site; `rls_isolation.sql` C5's
  cross-org probe is `withdrawn` so the FK, not door 2's index, answers; the runner pins move to 15 recipes and 17
  files. The trigger checks both the old and the new version of an update and looks a version up in the row's own
  org (a version of another org passes to RLS / the FK). Line actions take `(id, formData)` and their controls wrap
  them, as the import actions do; update and remove revalidate `/agreements/[agreementId]`. Revise and withdraw
  answer `unavailable` (logged) when the transition throws. "Posting `createAgreementAction` with the site id"
  (C701) is proven in `app/(app)` (the site page passes `createAgreementAction.bind(null, siteId)`); static markup
  cannot name a Server Action. The dry run used the project's own runner over `SUPABASE_DB_URL` rather than pasting
  each recipe into `execute_sql`: same database, same transaction-and-rollback, nothing persisted.
- **Abandoned:** a temporary table for C730's "version 1 before" snapshot (a role switch cannot be relied on to read
  another role's temp table; it is `tests.ab_rev_v1` now); reading `old`/`new` in one `union all` inside the trigger
  (replaced by explicit `tg_op` branches); asserting "no service_role" inside `composition.test.ts` (the line itself
  made the C745 grep count 1).
