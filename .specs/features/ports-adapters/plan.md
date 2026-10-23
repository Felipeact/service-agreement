# Ports, Supabase adapters and composition root

## Problem

The domain machines decide whether an agreement or contract may move, but nothing records the
move. No code writes `agreements.status`, `events` or `outbox`, and the `outbox` table is closed
to the `authenticated` role (all privileges revoked), so the app acting as a signed-in user cannot
write it at all. M11 requires that every transition writes an event and an outbox row; n8n
(W1-W4) only ever learns about a transition through that outbox row.

The next items - the screens, then the portal (Phase 3) and signing (Phase 4) - each need to
"move this agreement". Without one write path, each would call Supabase from its page. PostgREST
gives no transaction across two HTTP calls, so a status update and its event written as two
requests can split: the agreement shows `sent` and no event exists, so W1 never emails the portal
link and nobody notices. Pages would also bind directly to the database client, so none of that
code can be tested without a live project, and any time-dependent rule (deal age, expiry) would
read `new Date()` inline and be untestable.

The source gives no user-facing evidence; this is foundation work the remaining Phase 1 items and
Phases 3-4 depend on.

When this ships, server code asks one use case to apply a command to an agreement or contract. It
gets back the new status and the recorded event id, or a typed refusal, and the status, the event
and the outbox row are written together or not at all.

## Flow

Reuses `applyAgreementCommand` / `applyContractCommand` as the only transition decision, the
`private.has_org_role` helper (AD-004) for authorization, and the existing `events`, `outbox` and
`agreement_versions` tables unchanged.

1. server code (Server Actions and route handlers in the next items) -> `web/composition` (door 1) -
   `getContainer()` builds a request-scoped Supabase client from the request cookies and wires the
   adapters into the use cases
2. `web/application/use-cases` (door 1) - `transitionAgreement({ agreementId, command })` loads the
   agreement through the `AgreementRepository` port (door 1): current status and latest version number
3. `web/domain/agreement` (exists) - decides; a refusal goes straight back to the caller and nothing is written
4. `AgreementRepository.commitTransition` -> `web/infrastructure/supabase` adapter (door 1) - calls
   `rpc("apply_agreement_transition")` (door 3) with the expected status and the event
5. `public.apply_agreement_transition` (door 3) - in one transaction: compare-and-set the status,
   insert the `events` row, insert the next `agreement_versions` row on `revise`, and call
   `private.enqueue_outbox` (door 4) to insert the `outbox` row; returns the event id
6. the adapter maps a SQLSTATE to a use-case error code (door 2)
7. out: `{ ok: true, status, eventId }` or `{ ok: false, error }`, and an `outbox` row with
   status `pending`, which the Phase 3 dispatcher reads

The contract path is the same, through `transitionContract`, `ContractRepository`,
`web/domain/contract` (exists) and `public.apply_contract_transition` (door 3).

`Clock` is a port in `web/application/ports` (door 1), with a system adapter and a fixed fake in
`web/infrastructure/clock`. The composition root wires it, and nothing in this change reads it yet.

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `transitionAgreement` / `transitionContract` - the use cases that load, decide and commit a transition; live in `web/application/use-cases` |
| domain | new term: `AgreementRepository`, `ContractRepository`, `Clock` - ports in `web/application/ports` |
| domain | existing term: `EventPublisher` (ROADMAP Phase 1 item 4) meant "the port that writes events"; it now means the outbound port that dispatches `outbox` rows to n8n, designed with its first adapter in Phase 3 (M12). On the write side, publishing is the `outbox` row that `commitTransition` writes. Nothing branches on the name today; only the ROADMAP line uses it, and it gets reworded |
| domain | existing term: the `DomainEvent.data` keys (`reason`, `versionNo`) become stored `events.payload` keys, which n8n reads (door 5) |
| stored data | nothing to migrate. The migration adds functions only, and no table, column or constraint changes. The demo org has no agreements or contracts yet, so no row predates the new path |
| tooling | new runtime dependencies `@supabase/supabase-js`, `@supabase/ssr`, `server-only`, and two env variables (door 6). `web/.env.local` stays untracked and `web/.env.example` is committed |
| tooling | `web/infrastructure/supabase/database.types.ts`, generated from the live schema with MCP `generate_typescript_types`; it is regenerated after each migration |
| tooling | `web/eslint.config.mjs` gains boundary rules for `application/**`, `infrastructure/**` and for `app/**`, `components/**` and `lib/**` (door 1). No file under `app/`, `components/` or `lib/` imports anything these rules forbid today |
| decisions | doors 1, 3, 4 and 5 reach past this feature, so each gets an `AD-NNN` in `.specs/STATE.md` |

## Relations

None - no stored-data shape change. The new functions write rows into the existing `agreements`,
`agreement_versions`, `contracts`, `events` and `outbox` tables.

## Surface

PostgREST exposes every `public` function as an RPC route. Only this app calls them, but they
are reachable with any signed-in user's token, so the signature is reviewed here.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /rest/v1/rpc/apply_agreement_transition` | `p_agreement_id`, `p_expected_status`, `p_to_status`, `p_event_type`, `p_payload` | event id (`uuid`) | `200`; error body `code` SQLSTATE `40001` (stale status), `P0002` (not found or other org), `42501` (caller is not owner, admin or estimator; or anon) |
| `POST /rest/v1/rpc/apply_contract_transition` | `p_contract_id`, `p_expected_status`, `p_to_status`, `p_event_type`, `p_payload` | event id (`uuid`) | `200`; error body `code` SQLSTATE `40001`, `P0002`, `42501`, under the same conditions |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. the layer folders and the lint rules that keep them apart (every later feature copies them) | `web/application/ports/*.ts`, `web/application/use-cases/*.ts`, `web/infrastructure/{supabase,clock}/*.ts`, `web/composition/index.ts`. `no-restricted-imports` in `web/eslint.config.mjs`: `application/**` forbids `next*`, `react*`, `@supabase/*`, `@/lib`, `@/components`, `@/app`, `@/infrastructure`, `@/composition`; `infrastructure/**` forbids `react*`, `@/app`, `@/components`, `@/composition`; `app/**`, `components/**` and `lib/**` forbid `@/infrastructure` and `@supabase/*`. `web/composition/index.ts` starts with `import "server-only"` | adapters in `web/lib/` - `lib` already holds UI formatting and is imported by client components, so a Supabase import there would have no boundary a linter can check, and could end up in the browser bundle |
| 2. use-case result shape (every Server Action, route handler and the portal branch on it) | `type UseCaseResult<S> = { ok: true; status: S; eventId: string } \| { ok: false; error: { code: TransitionErrorCode \| "not_found" \| "conflict" \| "forbidden"; from?: S; command: string } }`. An unexpected infrastructure error (network, unmapped SQLSTATE) is thrown as an `Error` carrying the SQLSTATE | throwing for `conflict` / `forbidden` - the portal shows "someone already answered this" to a customer, so it is an expected outcome the type checker must see, the same reasoning as AD-011 |
| 3. one transaction per transition, through a security-invoker RPC with compare-and-set (the pattern every later state change copies: portal decisions, DocuSeal webhook, expiry) | `create function public.apply_agreement_transition(p_agreement_id uuid, p_expected_status text, p_to_status text, p_event_type text, p_payload jsonb) returns uuid language plpgsql security invoker set search_path = ''`. Role check `private.has_org_role(org_id, array['owner','admin','estimator'])` else `42501`; `update public.agreements set status = p_to_status, updated_at = now() where id = p_agreement_id and status = p_expected_status`, no row updated -> `40001`; `events.actor_id = auth.uid()`, never a parameter. `execute` revoked from `public` and `anon`, granted to `authenticated`. `apply_contract_transition` has the same shape against `public.contracts` | two PostgREST calls (update, then insert) - no transaction across HTTP requests, so a status can land with no event; a service-role client - bypasses RLS, breaking AD-004's one place that decides membership; `security definer` - would skip RLS on `agreements` and `events`, so org isolation would rest on hand-written checks inside the function |
| 4. the only writer of `outbox` rows | `private.enqueue_outbox(p_event_id uuid) returns void language sql security definer set search_path = ''` inserts `(org_id, event_id)` from that event row. `execute` granted to `authenticated`, reachable only from inside other functions because `private` is not exposed (AD-004). `outbox` privileges stay revoked | an `after insert on events` trigger - would enqueue every event, including non-transition events such as `agreement.viewed` (Phase 3) that n8n must not act on; granting `insert` on `outbox` to `authenticated` - any estimator token could enqueue an arbitrary email to a customer |
| 5. `events.payload` keys (n8n W1-W4 read them) | `{ "from": "<status>", "to": "<status>" }` plus `"reason"` on `refused` / `changes_requested` and `"versionNo"` on `revised` - the `DomainEvent` `from`, `to` and `data` keys, camelCase as in TypeScript | storing the whole `DomainEvent` - `type` and `entityType` already have their own columns, and two copies can disagree; snake_case keys - one name per concept across TS and n8n, and `data` is already camelCase (AD-011) |
| 6. runtime dependencies and env variable names (deploy config copies the names) | `@supabase/supabase-js` `2.118.0`, `@supabase/ssr` `0.12.7`, `server-only` `0.0.1`, pinned exact; `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase now issues publishable keys and the MCP exposes them (`get_publishable_keys`); `@supabase/auth-helpers-nextjs` - deprecated in favour of `@supabase/ssr` |

- Nothing else in this change is hard to reverse

## Criteria

### S1: An agreement transition is recorded atomically (P1)

A member moves an agreement and gets the status, the event and the outbox row together, or nothing.

**Acceptance Criteria**

1. WHEN an owner, admin or estimator of the org applies `send` to a `draft` agreement through `transitionAgreement` THEN the system SHALL set `agreements.status` to `sent` and return `{ ok: true, status: "sent", eventId }`
2. WHEN a transition is committed THEN the system SHALL insert exactly one `events` row with `type` equal to the domain event type, `entity_type` `agreement`, `entity_id` the agreement id, `actor_id` the caller's user id and `payload` `{"from":"draft","to":"sent"}` for a `send`
3. WHEN a transition is committed THEN the system SHALL insert exactly one `outbox` row with `event_id` equal to the returned `eventId`, the event's `org_id` and status `pending`
4. WHEN `refuse` with reason `"  Over budget  "` is committed THEN the `events.payload` SHALL be `{"from":"sent","to":"refused","reason":"Over budget"}`
5. WHEN `revise` is committed on a `changes_requested` agreement whose latest version is `n` THEN the system SHALL set status `draft`, insert one `agreement_versions` row with `version_no` `n + 1` and the `snapshot` of version `n`, and store `payload.versionNo` `n + 1`
6. IF the domain machine refuses the command THEN `transitionAgreement` SHALL return that refusal (`invalid_transition`, `reason_required` or `reason_too_long`) unchanged and SHALL NOT call `commitTransition`
7. IF the agreement's stored status no longer equals the status the use case read THEN the function SHALL raise SQLSTATE `40001`, the agreement, `events` and `outbox` SHALL be unchanged, and `transitionAgreement` SHALL return code `conflict`
8. IF the agreement does not exist or belongs to another org THEN `transitionAgreement` SHALL return code `not_found` and write nothing
9. IF the caller is a `viewer` of the org THEN the function SHALL raise SQLSTATE `42501`, write nothing, and `transitionAgreement` SHALL return code `forbidden`
10. IF the `anon` role calls `apply_agreement_transition` or `apply_contract_transition` THEN the call SHALL fail with SQLSTATE `42501`
11. The system SHALL set `events.actor_id` from `auth.uid()` inside the function; neither function SHALL take an actor parameter
12. IF an `authenticated` caller inserts into `outbox` directly THEN the insert SHALL still fail with SQLSTATE `42501`

**Independent test:** run the rolled-back SQL test for the two functions (fixture plus test file through MCP `execute_sql`), then the use-case unit tests.

### S2: A contract transition is recorded atomically (P1)

The same guarantee for the contract.

**Acceptance Criteria**

13. WHEN an owner, admin or estimator applies `client_sign` to a `pending_signature` contract through `transitionContract` THEN the system SHALL set `contracts.status` to `client_signed`, insert one `events` row with `type` `contract.client_signed`, `entity_type` `contract` and payload `{"from":"pending_signature","to":"client_signed"}`, insert one pending `outbox` row for it, and return `{ ok: true, status: "client_signed", eventId }`
14. IF the contract's status is stale, the contract is missing or in another org, or the caller is a `viewer` THEN `transitionContract` SHALL return `conflict`, `not_found` or `forbidden` respectively, and write nothing, as in AC 7-9

**Independent test:** the contract section of the same SQL test file, and the contract use-case unit test.

### S3: The adapters map database outcomes to use-case codes (P1)

**Acceptance Criteria**

15. WHEN the RPC returns an error with `code` `40001`, `P0002` or `42501` THEN the Supabase adapter SHALL map it to `conflict`, `not_found` or `forbidden`
16. IF the RPC returns an error with any other code, or the request itself fails THEN the adapter SHALL throw an `Error` whose message includes that code
17. WHEN `findById` selects no row THEN the agreement and contract adapters SHALL return `null`, and the use case SHALL return `not_found` without calling `commitTransition`
18. WHEN `findById` finds an agreement THEN the adapter SHALL return its status and the highest `version_no` of its versions, or `0` when it has none

**Independent test:** run the adapter unit tests against a stubbed Supabase client.

### S4: Clock (P2)

**Acceptance Criteria**

19. WHEN `systemClock.now()` is called THEN the system SHALL return a `Date` within 1000 ms of the real time
20. WHEN `fixedClock(d).now()` is called THEN the system SHALL return a `Date` equal to `d` on every call

**Independent test:** run the clock unit test.

### S5: The composition root and layer boundaries hold (P1)

**Acceptance Criteria**

21. The system SHALL export `getContainer()` from `web/composition/index.ts`, whose first statement is `import "server-only"`, returning `transitionAgreement`, `transitionContract` and `clock` already wired to the Supabase and system adapters
22. IF `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is unset THEN `getContainer()` SHALL throw an `Error` naming the missing variable
23. IF a file under `web/application/` imports `@supabase/*`, `next`, `react` or `@/infrastructure` THEN `npm run lint` SHALL exit non-zero naming that import
24. IF a file under `web/app/`, `web/components/` or `web/lib/` imports `@/infrastructure/*` or `@supabase/*` THEN `npm run lint` SHALL exit non-zero naming that import
25. WHEN `npm run build`, `npm run lint` and `npm test` run in `web/` THEN all three SHALL exit 0, and `/pipeline` SHALL render the same five columns, counts and totals as before
26. WHEN the migration has been applied THEN Supabase security advisors SHALL report no new finding for the two functions or `private.enqueue_outbox`

**Independent test:** add a forbidden import to an `application/` file and to a component and run lint; build; open `/pipeline`; run `get_advisors`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Dispatching `outbox` rows to n8n (the outbound `EventPublisher`, HMAC signing, retries) | M12, Phase 3 with W1; it needs the n8n contract that W1 defines |
| Transitions made by the service role (DocuSeal webhook `client_sign`, n8n `expire`) | Phase 4 and Phase 3. The role check here admits members only, and those callers add their own path then |
| Read repositories for customers, sites, assets and settings | the screens item adds the repositories it reads, following door 1 |
| Login, sessions and `proxy.ts` | the next ROADMAP item (auth). Until it lands, `getContainer()` builds an anonymous client, so a transition from the app returns `forbidden` |
| Copying service lines into a revised version | Phase 3 agreement builder; this copies the version `snapshot` only |
| Enforcing the transition table in SQL | AD-005: the TS machine owns transitions. The RPC trusts `p_to_status`, as the table already trusts a direct `update` by an estimator |
| Wiring `/pipeline` to real data, deal age | the dashboard screen item; it will be `Clock`'s first reader |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| What `EventPublisher` means | publishing is the `outbox` row written inside `commitTransition`; no `EventPublisher` interface ships here, and the outbound dispatch port is designed with its n8n adapter in Phase 3. The ROADMAP line is reworded to say so | a separate `publish(event)` port would be a second write after the status update, which is exactly the split this feature prevents; an interface with no adapter and no caller would be guessed before W1 fixes its contract | y - approved with the plan |
| Which repositories ship | `AgreementRepository` and `ContractRepository` only (`findById`, `commitTransition`) | these are the only ones the write path needs; read repositories arrive with the screens that consume them, so their shape comes from a real caller | y - approved with the plan |
| `revise` and the new version's content | the new `agreement_versions` row copies the `snapshot` of version `n`; service lines are not copied | the draft starts from what the customer saw; line copying belongs with the Phase 3 builder that edits lines | y - approved with the plan |
| End-to-end proof through a real signed-in session | deferred to the auth item; here the SQL functions are proven with `tests.act_as` and the adapters against a stubbed client | no user can sign in until auth lands, and `tests.act_as` sets the same `request.jwt.claims` PostgREST sets | y - approved with the plan |
| Verification profile | `light` (AGENTS..md declares none) | skill default. `standard` would inject faults into the SQLSTATE mapping and the role check, which is the riskiest code here; worth raising if you want it | y - approved with the plan |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| RPC `apply_agreement_transition`, `apply_contract_transition` | error shape and codes | door 3, AC 7-10, 14 |
| RPC `apply_*_transition` | who may call it | AC 9, 10, 14 |
| RPC `apply_*_transition` | versioning | n/a - consumed only by this repo's adapter, which changes in the same commit as the function |
| RPC `apply_*_transition` | rate limits | n/a - authenticated members of one org only; portal rate limits are M15 in Phase 3 |
| RPC `apply_*_transition` | response shape | door 3 (`uuid` event id), AC 1 |
| module API `transitionAgreement` / `transitionContract` | error shape and codes | door 2, AC 6-9, 14-17 |
| module API `web/composition` | who may call it | AC 21 (`server-only`), AC 24 |
| `events.payload` (read by n8n later) | naming | door 5, AC 2, 4, 5, 13 |
| screen `/pipeline` | empty, loading, error states | existing - unchanged sample-data board; AC 25 proves nothing regresses |

## Sources

- ROADMAP.md, M11 ("every transition writes an event and an outbox row"), M12, and Phase 1 item 4
- `.specs/STATE.md` AD-004 (RLS helpers), AD-005 (TS machine owns transitions), AD-010 (pure domain), AD-011 (result and event names)
- `supabase/migrations/20261019174738_init.sql`: `events`, `outbox` and their grants
