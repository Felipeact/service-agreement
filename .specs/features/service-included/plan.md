# Service included: generate what each agreement covers from the equipment on its site, and freeze it when the agreement leaves draft

## Problem

An agreement says what it costs but not what the customer gets. `/agreements/<id>` shows the service lines and the total per year, and nothing else. The site's equipment (up to 2,000 imported assets) and each equipment type's maintenance checklist (40 types, 174 tasks per org) are already in the database. Still, an estimator who wants to tell a customer "every RTU gets its filters replaced and belts tensioned" has to retype the checklists into a document outside the app. That document then drifts from the site register.

Nothing records what an agreement covered at the moment it went out. `agreement_versions.snapshot` is `{}` on all 12 demo agreements and on every version created since. When a checklist or the site's equipment changes later, a sent or accepted agreement has no record of what was promised.

The source (ROADMAP.md Phase 3 item 2, M6 "snapshotted into each agreement version", M7, and PRODUCT.md "Agreement anatomy") gives no user evidence or date. The agreement-builder plan assigned "Service included" and the equipment list in the version snapshot to this item.

When this ships, a draft agreement shows two new sections:

- **Service included:** one entry per equipment type on the site, such as "RTU, 12 units", followed by that type's checklist.
- **Equipment:** the site's assets grouped by type, with unit #, type/model and location.

When the agreement is sent or withdrawn, both sections freeze into that version. From then on the agreement shows what was true at that moment, whatever later happens to the site or the checklists. The PDF and the portal (items 3 and 4) render from the same data.

## Flow

This reuses the site register's grouping order (`groupAssets` in `web/components/sites/assets.ts`: types by name, units in natural order, no unit last), the existing `AgreementReader` and its `editable` rule, the `apply_agreement_transition` RPC (AD-015), and the `private.enqueue_outbox` pattern for a security definer helper called from an invoker RPC (AD-016).

1. `/agreements/[agreementId]` (exists) calls `AgreementReader.get` (exists). This hop is where the reader picks one of two sources, and its view type gains `serviceScope` (door 4).
2. If the shown version is `editable` (the current version of a `draft`), the reader calls `public.site_service_scope(site_id)` (door 2). That function reads, as the member, the site's assets, their types and those types' tasks, and returns the scope document (door 1).
3. Otherwise the reader reads `agreement_versions.snapshot` of the shown version (exists). `{}` means the scope was not recorded.
4. `parseServiceScope` (new, pure, in `web/domain/agreement`; its exact location is decided while building) turns the document into the ordered view. An unknown `schema` or a malformed document counts as not recorded and is logged.
5. `AgreementView` (exists) renders the "Service included" and "Equipment" sections below the service lines.
6. Freeze: `apply_agreement_transition` (exists, replaced with the same signature) runs on a transition whose expected status is `draft` (`agreement.sent`, `agreement.withdrawn`). In the same transaction, after the compare-and-set, it calls `private.freeze_agreement_version(agreement)` (door 3). That function writes the scope document into the agreement's highest version.
7. The migration backfills every version that is not editable and still has `{}` (door 5). `supabase/seed.sql` does the same for re-runs.

## Impact

| Front | What changes |
| --- | --- |
| domain | New term: **service scope**. This is the document listing each equipment type on a site, with that type's checklist and its assets. "Service included" is its checklist half and "Equipment" is its asset half. |
| domain | New term: **frozen version**. This is any version that is not the current version of a `draft`. It shows its stored scope and never today's site. |
| domain | Existing term: `agreement_versions.snapshot` was a `{}` placeholder and now holds the scope document. Callers today: the revise branch of `apply_agreement_transition` copies it into version n + 1. The copy is now harmless, because a draft shows its live scope and leaving draft overwrites the copy. `transitions.sql` C5 asserts that copy and stays true. |
| domain | Existing transition: `agreement.sent` and `agreement.withdrawn` from `draft` now also write the snapshot. Callers: `transitionAgreement` (withdraw from the agreement page; send has no caller until the portal item) and `supabase/tests/transitions.sql`. |
| stored data | Backfill, now: every version that is not the current version of a `draft` gets today's scope of its site. This covers the 10 non-draft demo agreements, AG-1048 version 1 and any withdrawn agreements. All data on the live project is fictitious demo data, so "today" stands in for "when it was sent". Drafts keep `{}`. |
| privileges | `revoke update on public.agreement_versions from authenticated`. No app code updates a version. Insert stays granted, because `rls_roles.sql` C13 pins it. `rls_isolation.sql` C4 expects `42501` on a cross-org update and still gets `42501`. `rls_roles.sql` C12 expected a viewer's update to affect 0 rows and now gets `42501`, so `agreement_versions` leaves C12's loop as `events` did, and C817 proves the refusal (user-approved 2026-10-27). |
| screens | `/agreements/<id>` gains "Service included" and "Equipment". No other screen changes. |
| ports | `AgreementDetail` gains `serviceScope`. The stub client and `agreements.test.ts` fixtures gain it too. |
| types | `database.types.ts` is regenerated, because the migration adds a new RPC. |
| decisions | Doors 1 to 5 reach past this feature, because the PDF, the portal and the contract read the snapshot. They get rows `AD-058`+ in STATE.md. |
| docs | `CONTEXT.md` M6/M7 sections and its Build log are updated, and ROADMAP Phase 3 item 2 is ticked. |
| security advisors | After the migration, `get_advisors` must still show only the two accepted findings. |

## Relations

`None - no stored-data shape change`. The snapshot column already exists on `agreement_versions`, one per version. What it holds is fixed by door 1, and who may write it by door 3.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /rest/v1/rpc/site_service_scope` (PostgREST, members only) | `p_site_id` | the scope document (door 1); for a site the caller cannot see, `{"schema":1,"types":[]}` | `200`, `401` anon |

The agreement page keeps its route and signature. Its new sections are criteria, not Surface rows.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. the scope document | `{"schema": 1, "takenAt": "<timestamptz ISO>", "types": [{"code": "RTU", "name": "RTU", "tasks": ["Replace filters", "..."], "assets": [{"unitNo": "RTU-1", "typeModel": "...", "location": "..."}]}]}`. Keys are camelCase (AD-017 style). Tasks keep checklist `position` order. Types and assets are ordered at render, not stored in order. `unitNo`, `typeModel` and `location` may be `null`. | **Two arrays (`serviceIncluded` and `equipment`).** Both group by the same types, so two copies could disagree. **Child tables per version.** Nothing queries into a frozen record, and the jsonb column already exists for exactly this. **Storing type or asset ids.** A deleted asset (AD-030) or type would leave dangling references in a record that must not change. |
| 2. one builder | `public.site_service_scope(p_site_id uuid) returns jsonb`: `language sql stable security invoker set search_path = ''`, executable by `authenticated` only. It contains every type with at least one asset on the site, and types with no tasks are included with `"tasks": []`. | A TypeScript builder for the draft plus a SQL one at freeze. They would be two implementations, and what the estimator reviewed could differ from what gets frozen. |
| 3. who writes a snapshot | `private.freeze_agreement_version(p_agreement_id uuid)`: security definer, `search_path = ''`. It requires `private.has_org_role(org, array['owner','admin','estimator'])`, else `42501`. It sets `snapshot = public.site_service_scope(site)` with `takenAt = now()` on the highest version, and is called only from `apply_agreement_transition` when `p_expected_status = 'draft'`. In addition, `revoke update on public.agreement_versions from authenticated`. | **A trigger keyed on `auth.uid()`.** The invoker RPC and a direct PATCH carry the same uid, so the trigger cannot tell them apart. **Freezing on `sent` only.** A withdrawn draft would then show today's site forever. **Leaving update granted.** Any writer could rewrite what a customer was sent. |
| 4. the view type | `AgreementDetail.serviceScope: { source: "live" \| "frozen"; takenAt: Date \| null; types: { code; name; tasks: string[]; assets: { unitNo; typeModel; location }[] }[] } \| { source: "not_recorded" }` | A separate `ServiceScopeReader` port. The page reads both in one request through the reader that already knows `editable`, and the PDF will read `AgreementDetail` too. |
| 5. backfill | In the migration: `update public.agreement_versions v set snapshot = <scope of the version's site>` for every version that is not the highest of a `draft` agreement and whose snapshot is still `'{}'`. `seed.sql` repeats it after its inserts, with the same `snapshot = '{}'` guard. | Leaving `{}` and showing "not recorded" on every demo agreement. The portal and PDF demos would then have nothing to render. Fictitious demo data makes today's scope a safe stand-in. |

- Nothing else in this change is hard to reverse. The copy, the layout, the disclosure behaviour and the render order are all app-side.

## Criteria

**Editable** means the current version of a `draft` agreement. **Frozen** means any other version. The order is the site register's order: types by name, units compared as numbers, no unit last.

### S1: A draft shows what it covers, live from the site (P1)

**Acceptance Criteria**

1. WHEN a member opens an editable version THEN the page SHALL show a "Service included" section listing, in order, each equipment type that has at least one asset on the site as `<type name>, <n> unit(s)`, followed by that type's tasks in checklist position order
2. WHEN a member opens an editable version THEN the page SHALL show an "Equipment" section that groups the site's assets by type in the same order, each with unit #, type/model and location, and shows "—" for an empty field
3. WHILE the version is editable the page SHALL reflect an asset added, edited or deleted on the site, or a checklist change, on the next load with no action on the agreement
4. IF an equipment type on the site has no tasks THEN "Service included" SHALL list the type with "No checklist for this type yet."
5. IF the site has no assets THEN both sections SHALL show "No equipment on this site yet." and, to writers, a link "Add equipment" to `/sites/<siteId>`
6. The system SHALL build the scope only through `public.site_service_scope`, as the signed-in member, and include no asset or type from another org or another site

**Independent test:** open demo draft AG-1046. Its site's types and tasks appear. Add an asset of a new type on the site, then reload: the type appears with its checklist.

### S2: Leaving draft freezes the scope into the version (P1)

**Acceptance Criteria**

7. WHEN an agreement moves from `draft` to `sent` or `withdrawn` THEN the system SHALL, in the same transaction as the status change, write the site's scope with `takenAt` into the agreement's highest version
8. IF the status change is refused (`40001` stale, `42501`, `P0002`) THEN the system SHALL write no snapshot
9. WHEN a member opens a frozen version THEN the page SHALL show "Service included" and "Equipment" from that version's snapshot, with "As recorded on <date>", whatever the site and checklists hold now
10. WHEN "Start version <n + 1>" creates a draft THEN version n + 1 SHALL show the live scope and version n SHALL keep its snapshot unchanged
11. IF a frozen version's snapshot is `{}` or fails to parse THEN the page SHALL show "Not recorded for this version." in both sections, and log a parse failure with `console.error`
12. IF a member sends `update` on `agreement_versions` through PostgREST THEN the database SHALL refuse it with `42501`
13. IF a frozen scope has no types THEN both sections SHALL show "No equipment was recorded for this version."

**Independent test:** in SQL as a writer, send a draft, then add an asset to its site. The sent version's snapshot is unchanged, and the page shows the old list with "As recorded on <date>".

### S3: Existing agreements have a scope to show (P2)

**Acceptance Criteria**

14. WHEN the migration runs THEN every version that is not the highest version of a `draft` agreement and whose snapshot was `{}` SHALL hold its site's scope, and no draft's current version SHALL change
15. WHEN `supabase/seed.sql` is re-run THEN it SHALL fill only frozen demo versions whose snapshot is `{}` and leave every other snapshot unchanged

**Independent test:** after the migration, open sent demo AG-1039. Both sections show its site's equipment with "As recorded on <migration date>".

### S4: The sections are readable at every width (P2)

**Acceptance Criteria**

16. The page SHALL show each type in "Equipment" as a disclosure headed `<type name> · <n>` and closed by default, and "Service included" fully expanded
17. The page SHALL render both sections with no horizontal page scroll at 375, 768 and 1440 px, with touch targets of at least 44 px (AGENTS..md)
18. IF a viewer opens the agreement THEN both sections SHALL show with no "Add equipment" link

**Independent test:** open the 336-asset Brookhaven site's agreement at 375 px. The Equipment groups are closed and open on tap.

## Out of scope

| Excluded | Why |
| --- | --- |
| Editing Service included per agreement (excluding types, editing tasks) | The user chose generated only on 2026-10-27. Changes go through the site's assets or the org's checklists. |
| A checklist editing screen | M6 "editable per tenant" is its own item. Today checklists change by SQL only. |
| Per-task frequency (quarterly vs annual) | It is not in the catalog. CONTEXT.md lists it as "Not yet". |
| Linking service lines to equipment types | Lines stay free-form (agreement-builder, 2026-10-27). |
| The PDF and the portal rendering the scope | Items 3 and 4. They read `AgreementDetail.serviceScope`. |
| Stopping a writer from inserting an extra version directly | This is pre-existing and pinned by `rls_roles.sql` C13. It belongs to a later hardening pass, not to this item. |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Can Service included be edited per agreement | Generated only | User chose the recommendation, 2026-10-27 | y |
| When the scope freezes | Live while editable, frozen in the transaction that leaves `draft` | User chose the recommendation, 2026-10-27. Withdraw from draft freezes too, so a withdrawn draft does not follow the site. | y |
| Equipment list in this item | Included: the same document, grouped by type | The agreement-builder plan assigned both to item 2, and they come from one read | n |
| Types with no tasks | Shown, with "No checklist for this type yet." | The customer still sees that the equipment is covered | n |
| Backfill timestamp | `takenAt` = migration time for backfilled versions | Only fictitious demo data exists, and the real send time is unknown | n |
| Size | No cap on assets in the scope. A 2,000-asset site makes a document of about 300 KB. | AD-050 already reads 2,000 rows for a job, and a cap would drop equipment from a contract | n |
| Equipment groups closed by default | Closed. Service included stays open. | The checklist is what a reviewer reads; 336 rows would bury it | n |

**Open questions:** none. Everything is resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/agreements/<id>` sections | empty state | AC 5 (live), AC 13 (frozen with no types) |
| screen `/agreements/<id>` sections | loading state | n/a: the page's existing `loading.tsx` already covers it, because the scope is read in the same request |
| screen `/agreements/<id>` sections | error state | AC 11 (not recorded or malformed). An unexpected read error throws as today, which leads to the `(app)` error boundary (AD-023). |
| screen `/agreements/<id>` sections | unauthorised | AC 18. Other orgs get a 404 and signed-out users are redirected to `/login` (existing behaviour). |
| screen `/agreements/<id>` sections | density and ordering | AC 1, 2, 16 |
| screen `/agreements/<id>` sections | destructive action confirms | n/a: the sections have no actions |
| collection: types and assets | grouping, naming, ordering, duplicates, the exception | AC 1, 2 (grouping and order). Two assets with the same unit # both appear, because the site register allows it. AC 4 covers the exception (a type with no tasks). |
| RPC `site_service_scope` | error shape and codes | Surface row: another org's site returns an empty `types` array and is never an error |
| RPC `site_service_scope` | who may call it | AC 6; `anon` has no execute |
| RPC `site_service_scope` | versioning, rate limits | Versioned by `schema: 1` (door 1). No rate limit: it is a read behind a staff session. |
| copy: "As recorded on <date>" | what the reader does next | AC 9: it tells the reader that the site may have changed since |

## Sources

- ROADMAP.md Phase 3 item 2, M6, M7; PRODUCT.md "Agreement anatomy"
- `.specs/features/agreement-builder/plan.md` Out of scope (assigns Service included and the equipment list to this item)
- STATE.md AD-005, AD-015, AD-016, AD-017, AD-023, AD-030, AD-050, AD-055
