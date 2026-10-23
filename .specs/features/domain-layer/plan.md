# Domain layer: state machines, pipeline stage, money

## Problem

The database accepts any agreement or contract status in its `check` list, in any order: nothing
stops `draft` going straight to `accepted`, a `refused` agreement coming back to `sent`, or a
contract reaching `completed` without the client signing. AD-005 leaves transitions to "the TS
state machine", and that machine does not exist. The next items (ports and adapters, the
dashboard, the portal in Phase 3, signing in Phase 4) each need to answer "may this move happen,
and what event does it emit", and without one owner each would write its own `if` chain, with
the n8n workflows (W1-W4) binding to whatever event names the first one chose.

The board stage has the same gap. `web/lib/pipeline-stage.ts` holds the five stage keys
(AD-001), but nothing maps an agreement status plus a contract status to a stage, so the
`/pipeline` board can only show hand-labelled sample data. And money is a bare `number` of cents
everywhere: `visits_per_year × cost_per_visit_cents` and column totals are computed inline, where
a fractional or negative value, or a dollar amount passed as cents, goes through unnoticed.

The source gives no user-facing evidence; this is foundation work that the next Phase 1 items
and Phase 3-4 depend on.

When this ships, any caller asks one pure module whether a transition is allowed and gets the
new status plus the event to record, or a typed refusal; asks which stage a deal is at; and
does money arithmetic that refuses non-integer, negative or unsafe cents. Nothing persists yet.

## Flow

Reuses the stage keys already in `web/lib/pipeline-stage.ts` (moved, not copied) and the
existing `formatCad` in `web/lib/money.ts`, which stays the presentation formatter.

1. caller passes the current status and a command -> `web/domain/agreement` (door 1) - decides,
   returns `{ ok: true, status, event }` or `{ ok: false, error }` (door 3)
2. caller passes the current contract status and a command -> `web/domain/contract` (door 1) -
   same result shape
3. caller passes an agreement status and the contract status, if any ->
   `web/domain/pipeline` (door 1) - returns a `PipelineStage` or `null` (off the board); owns `PIPELINE_STAGES` (AD-001)
4. `web/lib/pipeline-stage.ts` (exists) - keeps only `STAGE_META` (labels, dot classes) and
   imports the stage keys from the domain
5. `web/domain/money` (door 1, door 5) - `Cents` construction, line annual total, sum
6. out: no persistence. The event returned in hop 1 and 2 is what the ports item will write to
   `events` and `outbox` (door 4)

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `AgreementCommand` - `send`, `accept`, `refuse`, `request_changes`, `revise`, `expire`, `withdraw`; lives in `web/domain/agreement` |
| domain | new term: `ContractCommand` - `client_sign`, `countersign`, `decline`, `void`; lives in `web/domain/contract` |
| domain | new term: `DomainEvent` - `{ type, entityType, from, to, data }`; the event a transition emits, written by the ports item |
| domain | new term: `Cents` - a branded non-negative safe integer; lives in `web/domain/money` |
| domain | existing term: `PipelineStage` / `PIPELINE_STAGES` moves from `web/lib/pipeline-stage.ts` to `web/domain/pipeline`. Who imports it today: `web/lib/sample-pipeline.ts`, `web/components/kanban/kanban-column.tsx`, `web/components/kanban/pipeline-view.tsx`, `web/components/ui/status-pill.tsx`. `web/lib/pipeline-stage.ts` re-exports both names, so those imports keep working unchanged |
| tooling | `vitest` added as a dev dependency with a `test` script in `web/package.json` (door 2); the roadmap's later "Vitest unit tests" item then extends it rather than introducing it |
| tooling | `@types/node` moves from `^20` to `^24.19.1` (the Node runtime here is v24): `vitest@5.0.3` declares `@types/node` `^22 \|\| >=24` as a peer and `npm install` refuses `^20`. Config is `web/vitest.config.mts` (the `@/` alias), ESM so Vite loads it natively |
| tooling | `web/eslint.config.mjs` gains an import restriction scoped to `web/domain/**` (door 1) |
| stored data | nothing to migrate - no table, column or row changes; the DB `check` lists already match the statuses here |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. The event type strings (door 4) are consumed by n8n later, but
nothing emits them until the ports item.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. a pure domain folder, and the rule that keeps it pure (every later port, adapter and use case copies it) | `web/domain/{agreement,contract,pipeline,money}/`, each with an `index.ts`; `web/eslint.config.mjs` sets `no-restricted-imports` on `domain/**/*.ts` forbidding `next*`, `react*`, `@supabase/*`, `@/lib/*`, `@/components/*`, `@/app/*` | domain code in `web/lib/` - `lib` already holds UI meta (`dotClass`) and formatting, so "pure" would be a convention with no boundary a linter can check |
| 2. test runner (new dev dependency; every later unit test uses it) | `vitest` in `devDependencies`, `"test": "vitest run"`, tests as `web/domain/**/*.test.ts` beside the code | `node:test` - no TS path alias (`@/`) resolution without a loader, and the roadmap already names Vitest |
| 3. transition result shape (every caller and the ports item branch on it) | `type TransitionResult<S> = { ok: true; status: S; event: DomainEvent } \| { ok: false; error: { code: "invalid_transition" \| "reason_required" \| "reason_too_long"; from: S; command: string } }` - never throws for a domain refusal | throwing an `Error` subclass - a refused move is an expected outcome the portal shows the customer, and a `throw` hides it from the type checker |
| 4. event type names (W1-W4 in n8n bind to them; `events.type` and `events.entity_type` store them) | `type` = `<entity>.<to-status>`: `agreement.sent`, `agreement.accepted`, `agreement.refused`, `agreement.changes_requested`, `agreement.expired`, `agreement.withdrawn`, `agreement.revised`; `contract.client_signed`, `contract.completed`, `contract.declined`, `contract.voided`. `entityType` = `agreement` \| `contract` | command names (`agreement.accept`) - the roadmap's W1-W4 triggers already read as past states (`agreement.sent`, `contract.completed`) |
| 5. money representation (every price, total and later invoice/CPI calculation uses it) | `type Cents = number & { readonly __brand: "Cents" }`, made only by `cents(n)`, which accepts a non-negative `Number.isSafeInteger` and throws `RangeError` otherwise | plain `number` - a dollar amount passes as cents with no type error; `bigint` - PostgREST returns `bigint` columns as JSON numbers and `Intl.NumberFormat` callers already take `number`, so every boundary would convert |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Agreement state machine (P1)

A caller can ask whether an agreement move is allowed and get the new status and event, or a typed refusal.

**Acceptance Criteria**

1. WHEN `send` is applied to `draft` THEN the system SHALL return `ok: true`, status `sent` and event type `agreement.sent`
2. WHEN `accept` is applied to `sent` THEN the system SHALL return status `accepted` and event type `agreement.accepted`
3. WHEN `refuse` with a reason is applied to `sent` THEN the system SHALL return status `refused` and event type `agreement.refused` whose `data.reason` is the reason trimmed of surrounding whitespace
4. IF `refuse` is applied with a reason that is empty after trimming THEN the system SHALL return `ok: false` with code `reason_required` and from `sent`
5. IF a `refuse` or `request_changes` reason is longer than 2000 characters after trimming THEN the system SHALL return `ok: false` with code `reason_too_long`
6. WHEN `request_changes` with a note is applied to `sent` THEN the system SHALL return status `changes_requested` and event type `agreement.changes_requested` whose `data.reason` is the trimmed note
7. IF `request_changes` is applied with a note that is empty after trimming THEN the system SHALL return `ok: false` with code `reason_required`
8. WHEN `revise` is applied to `changes_requested` at version `n` THEN the system SHALL return status `draft` and event type `agreement.revised` with `data.versionNo` equal to `n + 1`
9. WHEN `expire` is applied to `sent` THEN the system SHALL return status `expired` and event type `agreement.expired`
10. WHEN `withdraw` is applied to `draft` or to `sent` THEN the system SHALL return status `withdrawn` and event type `agreement.withdrawn`
11. IF any command is applied to a status not listed as its source in AC 1-10 THEN the system SHALL return `ok: false` with code `invalid_transition`, that `from` status and the command name, for every one of the 7 × 7 status-command pairs not listed
12. The system SHALL give every successful agreement event `entityType` `agreement`, `from` equal to the input status and `to` equal to the returned status

**Independent test:** run the agreement test file; it walks every one of the 49 status-command pairs.

### S2: Contract state machine (P1)

The same for a contract: the client signs before the tenant countersigns.

**Acceptance Criteria**

13. WHEN `client_sign` is applied to `pending_signature` THEN the system SHALL return status `client_signed` and event type `contract.client_signed`
14. WHEN `countersign` is applied to `client_signed` THEN the system SHALL return status `completed` and event type `contract.completed`
15. WHEN `decline` is applied to `pending_signature` or `client_signed` THEN the system SHALL return status `declined` and event type `contract.declined`
16. WHEN `void` is applied to `pending_signature` or `client_signed` THEN the system SHALL return status `voided` and event type `contract.voided`
17. IF any command is applied to a status not listed as its source in AC 13-16 THEN the system SHALL return `ok: false` with code `invalid_transition`, for every one of the 5 × 4 status-command pairs not listed (so `countersign` on `pending_signature` is refused)
18. The system SHALL give every successful contract event `entityType` `contract`, `from` equal to the input status and `to` equal to the returned status

**Independent test:** run the contract test file; it walks all 20 pairs.

### S3: Pipeline stage (P1)

One function says which board column a deal is in.

**Acceptance Criteria**

19. The system SHALL export `PIPELINE_STAGES` from `web/domain/pipeline` as exactly `["in_progress", "sent", "accepted", "completed", "refused"]` in that order, and `web/lib/pipeline-stage.ts` SHALL re-export the same array object
20. WHEN the agreement is `draft` or `changes_requested` THEN the stage SHALL be `in_progress`
21. WHEN the agreement is `sent` THEN the stage SHALL be `sent`
22. WHEN the agreement is `accepted` and the contract is absent, `pending_signature` or `client_signed` THEN the stage SHALL be `accepted`
23. WHEN the agreement is `accepted` and the contract is `completed` THEN the stage SHALL be `completed`
24. WHEN the agreement is `refused` or `expired`, or it is `accepted` and the contract is `declined` THEN the stage SHALL be `refused`
25. WHEN the agreement is `withdrawn`, or it is `accepted` and the contract is `voided` THEN the stage SHALL be `null` (not on the board)
26. IF a contract status is given with an agreement status other than `accepted` THEN the system SHALL return the stage from the agreement status alone (AC 20-21, 24-25)

**Independent test:** run the pipeline test file over all 7 × 6 agreement/contract combinations (5 contract statuses plus absent).

### S4: Money in integer cents (P1)

Money arithmetic that cannot silently take a fraction, a negative or an unsafe integer.

**Acceptance Criteria**

27. WHEN `cents(n)` is called with a non-negative safe integer THEN the system SHALL return `n` typed as `Cents` (`cents(0)` -> `0`, `cents(1428050)` -> `1428050`)
28. IF `cents(n)` is called with a negative number, a non-integer, `NaN`, `Infinity` or a value above `Number.MAX_SAFE_INTEGER` THEN the system SHALL throw a `RangeError`
29. WHEN `lineAnnualCents(visitsPerYear, costPerVisit)` is called THEN the system SHALL return their product as `Cents` (`4`, `357000` -> `1428000`)
30. IF `visitsPerYear` is not an integer of at least 1, or the product is above `Number.MAX_SAFE_INTEGER` THEN `lineAnnualCents` SHALL throw a `RangeError`
31. WHEN `sumCents(list)` is called THEN the system SHALL return the sum as `Cents`, and `0` for an empty list; IF the sum is above `Number.MAX_SAFE_INTEGER` THEN it SHALL throw a `RangeError`

**Independent test:** run the money test file.

### S5: The layer stays pure (P1)

**Acceptance Criteria**

32. IF a file under `web/domain/` imports `next`, `react`, `@supabase/*` or anything under `@/lib`, `@/components` or `@/app` THEN `npm run lint` in `web/` SHALL exit non-zero naming that import
33. The system SHALL contain no read of the clock (`Date.now`, `new Date()`) and no randomness (`Math.random`, `crypto`) in any non-test file under `web/domain/`
34. WHEN `npm run build` and `npm run lint` run in `web/` after the move THEN both SHALL exit 0, and `/pipeline` SHALL render the same five columns with the same counts and totals as before

**Independent test:** add a `import "react"` line to a domain file and run lint; grep the domain folder for clock and random reads; build and open `/pipeline`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Writing events and outbox rows, repositories, `Clock`, `EventPublisher` | the next ROADMAP item (ports and Supabase adapters) |
| Who may run each command (role checks) | authorization is RLS today and the use-case layer later; the machine decides only whether the move is valid |
| Expiry timing (how many days until `sent` expires) and reminder timing | n8n W1/W5 and Phase 3 own timing; the machine only allows `sent -> expired` |
| Deal age for the dashboard | a function of a stored timestamp and `Clock`, so it lands with the ports item or the dashboard screen |
| Tax, discounts, CPI adjustment, currency other than CAD | Phase 3 builder and Phase 6; nothing here divides or rounds |
| Wiring `/pipeline` to real data | the dashboard screen item |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Stage for agreements and contracts that end without a signature (AC 24-25) | customer-side endings (`refused`, `expired`, contract `declined`) show in Refused; contractor-side endings (`withdrawn`, contract `voided`) leave the board (`null`) | AD-001 fixes five stages with Refused as the only exit; showing a deal the contractor pulled under "Refused" would misstate why it ended | y - approved with the plan |
| `request_changes` needs a note (AC 7) | yes, required, like a refusal reason | W3 sends the estimator "the reason"; a change request with no text gives them nothing to revise | y - approved with the plan |
| Reason length bound (AC 5) | 2000 characters after trimming | long enough for a paragraph of portal feedback, short enough for an email body in W3 | y - approved with the plan |
| `changes_requested` on the board | In progress, as the sample data already shows ("Changes requested" pill on an In progress card) | matches the existing board and the status model's "returns to draft" | y - approved with the plan |
| Verification profile | `light` (AGENTS..md declares none) | skill default; `standard` would inject faults into the transition table, which pays off here if you want it | y - approved with the plan |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| module API `web/domain/*` (called by later code) | error shape and codes | door 3, AC 4, 5, 7, 11, 17, 28 |
| module API `web/domain/*` | who may call it | n/a - an in-process pure function; authorization is out of scope |
| module API `web/domain/*` | versioning, rate limits | n/a - in-repo module with no external consumer |
| event names (consumed by n8n later) | naming | door 4, AC 1-3, 6, 8-10, 13-16 |
| screen `/pipeline` | empty, loading, error states | existing - unchanged sample-data board; AC 34 proves nothing regresses |

## Sources

- ROADMAP.md, Status model and Phase 1 item 3: the statuses, transitions and pipeline stages
- `.specs/STATE.md` AD-001 (stage keys) and AD-005 (text statuses, `_cents` money, the TS machine owns transitions)
- `supabase/migrations/20261019174738_init.sql`: the `check` lists the domain statuses must equal
