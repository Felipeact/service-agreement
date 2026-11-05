# Activity timeline

## Problem

An agreement's story is spread across `events` rows, and the agreement page shows only part of it. The Versions section lists sent, viewed, accepted, refused and changes-requested per version (`versions-section.tsx`, AD-118). Everything else the system records about an agreement is invisible to staff: when a revision was made, that a proposal expired (W8), that it was withdrawn (by hand, or because its site was deactivated), that a renewal was created or drafted (W7). The refusal or change-request reason is visible only on the next version's note, and a refusal's reason is not shown anywhere. A staff member asked "what happened to AG-1004?" has to read each version's block and guess the order across versions. The roadmap gives no incident figure; the cost is staff reconstructing the sequence by hand before calling a customer.

When this ships, the agreement page has an **Activity** section: one list, newest first, of everything that happened to the agreement across all its versions, with who did it and why.

## Flow

Reuses the `events` read, `EVENT_KINDS`, `versionOfEvent` and the member-role lookup that `versionHistory` already does in `infrastructure/supabase/agreements.ts`; adds no write path and no migration.

1. `GET /agreements/[agreementId]` -> `app/(app)/agreements/[agreementId]/page.tsx` (exists) - unchanged; it already passes the detail to the view.
2. `AgreementReader` (exists, `ports/index.ts`) + `infrastructure/supabase/agreements.ts` (exists) - the events query widens to every agreement event type, and the result also carries `timeline: TimelineEntry[]`.
3. `domain/agreement` (exists, pure) - new pure `buildTimeline(events, versions)`: orders entries newest first, adds the synthetic "created" entry from version 1, resolves the version number and the actor label (door: none, placement).
4. `components/agreements/agreement-view.tsx` (exists) renders a new `ActivitySection` below `VersionsSection`.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `TimelineEntry` - one dated, attributed thing that happened to an agreement, lives in `domain/agreement` |
| domain | existing term: `VersionEvent` / the Versions history keeps its meaning and its five types; callers branching on it: `versions-section.tsx`, `agreement-view.tsx` tests. Nothing in it changes |
| stored data | nothing to migrate; `events` is read only |
| RLS / grants | none; members already select `events` of their org, and the adapter reads it as the member |
| deactivation | an agreement on an inactive site still renders its timeline (history stays readable) |
| docs | ROADMAP tick, CONTEXT.md (Agreement entry, build log) |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside` (the existing page route gains a section; no new route, no new query parameter).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| None | read-only view over `events`; `AgreementDetail.timeline` is an additive view-type field | A `timeline` table or a `version_no` column on `events`: `events` is append-only and is the source of truth (AD-017, AD-118), a copy could drift |

- Nothing else in this change is hard to reverse

## Criteria

### S1: See everything that happened to an agreement, in order (P1)

The Activity section lists one entry per event, across all versions, newest first.

**Acceptance Criteria**

1. The agreement page SHALL show an "Activity" section listing every `agreement.*` event of the agreement of these types: `sent`, `viewed`, `accepted`, `refused`, `changes_requested`, `revised`, `expired`, `withdrawn`, `renewed`, `renewal_drafted`, newest first.
2. The system SHALL label each entry: "Sent to customer", "Viewed by customer", "Accepted", "Refused", "Changes requested", "New version created", "Expired", "Withdrawn", "Renewed", "Renewal draft created".
3. The system SHALL add one "Created" entry, dated at version 1's creation, with its author's role.
4. WHEN an event names a version (the payload's `versionNo`, else the newest version existing when it was written, AD-118) THEN the system SHALL show "Version <n>" on that entry.
5. The system SHALL show on each entry its time as a medium date with a short time in America/Vancouver, as the Versions history does.
6. IF two entries have the same time THEN the system SHALL keep the order the events were written in (later event first).
7. IF an event's type is not in the list of AC 1 THEN the system SHALL leave it out and show no error.

**Independent test:** open an agreement that was sent, viewed, refused, revised, sent again and accepted and read the entries top to bottom.

### S2: Who and why (P1)

**Acceptance Criteria**

8. WHEN the event was written by a member THEN the system SHALL show the member's role in the org, as the Versions history does (AD-118).
9. WHEN the event's payload `via` is `portal` THEN the system SHALL show "customer" as the actor.
10. WHEN an event has no actor and no `via: portal` (`expired`, `renewed`, `renewal_drafted`) THEN the system SHALL show "automatic" as the actor.
11. WHERE a `refused` or `changes_requested` event carries a `reason` the system SHALL show it on the entry, wrapped, with no truncation.
12. WHERE a `withdrawn` event's `via` is `deactivation` the system SHALL show "Withdrawn · site deactivated".
13. WHERE a `renewed` or `renewal_drafted` event has `renewsAgreementId` equal to this agreement's renewed agreement, or `expired` carries `validUntil`, the system SHALL show that agreement's number, or "Valid until <date>", on the entry. WHERE the renewed agreement is not readable the system SHALL show the entry without it.

**Independent test:** open the demo agreement refused by the customer with a reason, and one withdrawn by deactivating its site.

### S3: States and access (P2)

**Acceptance Criteria**

14. WHEN an agreement has only its creation and no events THEN the system SHALL show the Activity section with the single "Created" entry.
15. IF the viewer is not in the agreement's org THEN the system SHALL return 404 (RLS, existing page behaviour).
16. WHILE the agreement's site is inactive the Activity section SHALL still render.
17. WHILE the viewport is 375 px the Activity section SHALL wrap long reasons and add no horizontal page scroll.
18. IF the events read fails THEN the page SHALL fail as it does for any other read error (the existing error boundary), not render a partial list.

**Independent test:** open a brand-new draft agreement, then an agreement of an inactive site, at 375 px.

## Out of scope

| Excluded | Why |
| --- | --- |
| Email sends and reminders (`notifications`) on the timeline | The roadmap item says "from `events`"; notifications are a second source and need their own labels |
| Link reissue and other actions with no event today | They write no `events` row; adding one is a write-path change, a separate item |
| Contract events (`contract.*`) | Phase 4 writes them; the list ignores unknown types (AC 7) so they can be added then |
| Timeline across agreements (a site or customer feed) | The roadmap item is per agreement |
| Removing the Versions section's per-version history | It is shipped and tested; the two views stay |
| Filtering, paging, exporting | Not asked; one agreement has a few dozen events at most |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Ordering | newest first | Activity feeds read newest first; the Versions history stays oldest first within a version (AD-118) | n |
| Repeated views | every `agreement.viewed` event is listed; the Versions history keeps its once-per-version rule | `portal_record_view` writes the first view of a link only, so a second view means a reissued link and is worth showing | n |
| Renewal agreement number | read from the page's existing `renews` / `renewedBy` links, not a new query | those links are already read and checked against the id | n |
| Event cap | no cap | an agreement has a few dozen events; the 500-row cap of AD-023 is far above | n |
| Component | new `activity-section.tsx` beside `versions-section.tsx` | one section per file, as the page already does | n |
| Check ids | next free after C1477 (contact-roles) | ids stay unique across features | n |

**Open questions:** none.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen agreement detail, Activity | empty state | AC 14 |
| screen agreement detail, Activity | loading state | existing `loading.tsx` |
| screen agreement detail, Activity | error state | AC 18 |
| screen agreement detail, Activity | unauthorised / other org | AC 15 |
| screen agreement detail, Activity | density and ordering | AC 1, 6 |
| screen agreement detail, Activity | destructive action confirms | n/a - the section has no action |
| screen agreement detail, Activity | mobile | AC 17 |

## Sources

- `ROADMAP.md:160` - the item's scope: "Agreement activity timeline from `events`".
- `.specs/STATE.md` AD-017, AD-118 - event payload keys, and how an event is tied to a version and an actor shown as a role.
