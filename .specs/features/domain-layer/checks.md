# Domain layer checks

Profile: light
Plan: `.specs/features/domain-layer/plan.md`

36 checks in 5 slices · 5 one-way doors · 0 open, of which 0 block

Proofs run from `web/`. Every test name starts with its check id and a colon (`C1:`), so
`-t "C1:"` matches that check alone (`C1:` is not a substring of `C11:`).

## Checks

### S1 - Agreement state machine · 2 files · ~8 KB · ~2k

**C1** - `send` on `draft` returns `ok: true`, status `sent`, event type `agreement.sent` (AC 1)
Proof: `npx vitest run domain/agreement -t "C1:"`

**C2** - `accept` on `sent` returns status `accepted`, event type `agreement.accepted` (AC 2)
Proof: `npx vitest run domain/agreement -t "C2:"`

**C3** - `refuse` with reason `"  Over budget  "` on `sent` returns status `refused`, event type `agreement.refused`, `data.reason` `"Over budget"` (AC 3)
Proof: `npx vitest run domain/agreement -t "C3:"`

**C4** - `refuse` with reason `""` and with `"   "` on `sent` returns `ok: false`, code `reason_required`, from `sent` (AC 4)
Proof: `npx vitest run domain/agreement -t "C4:"`

**C5** - a reason of 2000 characters after trimming is accepted and one of 2001 returns code `reason_too_long`, for both `refuse` and `request_changes` (AC 5)
Proof: `npx vitest run domain/agreement -t "C5:"`

**C6** - `request_changes` with note `" Add the boiler "` on `sent` returns status `changes_requested`, event type `agreement.changes_requested`, `data.reason` `"Add the boiler"` (AC 6)
Proof: `npx vitest run domain/agreement -t "C6:"`

**C7** - `request_changes` with note `""` and with `"   "` returns `ok: false`, code `reason_required` (AC 7)
Proof: `npx vitest run domain/agreement -t "C7:"`

**C8** - `revise` on `changes_requested` at version 1 returns status `draft`, event type `agreement.revised`, `data.versionNo` 2; at version 3 returns `data.versionNo` 4 (AC 8)
Proof: `npx vitest run domain/agreement -t "C8:"`

**C9** - `expire` on `sent` returns status `expired`, event type `agreement.expired` (AC 9)
Proof: `npx vitest run domain/agreement -t "C9:"`

**C10** - `withdraw` on `draft` and on `sent` each return status `withdrawn`, event type `agreement.withdrawn` (AC 10)
Proof: `npx vitest run domain/agreement -t "C10:"`

**C11** - each of the 41 status-command pairs outside the 8 allowed returns `ok: false`, code `invalid_transition`, `from` equal to the input status and `command` equal to the command name; the test asserts the table has 41 rows (AC 11, door 3)
Proof: `npx vitest run domain/agreement -t "C11:"`

**C12** - each of the 8 allowed agreement transitions emits an event with `entityType` `agreement`, `from` the input status and `to` the returned status (AC 12)
Proof: `npx vitest run domain/agreement -t "C12:"`

### S2 - Contract state machine · 2 files · ~5 KB · ~1k

**C13** - `client_sign` on `pending_signature` returns status `client_signed`, event type `contract.client_signed` (AC 13)
Proof: `npx vitest run domain/contract -t "C13:"`

**C14** - `countersign` on `client_signed` returns status `completed`, event type `contract.completed` (AC 14)
Proof: `npx vitest run domain/contract -t "C14:"`

**C15** - `decline` on `pending_signature` and on `client_signed` each return status `declined`, event type `contract.declined` (AC 15)
Proof: `npx vitest run domain/contract -t "C15:"`

**C16** - `void` on `pending_signature` and on `client_signed` each return status `voided`, event type `contract.voided` (AC 16)
Proof: `npx vitest run domain/contract -t "C16:"`

**C17** - each of the 14 status-command pairs outside the 6 allowed, `countersign` on `pending_signature` among them, returns `ok: false`, code `invalid_transition`, with `from` and `command`; the test asserts the table has 14 rows (AC 17)
Proof: `npx vitest run domain/contract -t "C17:"`

**C18** - each of the 6 allowed contract transitions emits an event with `entityType` `contract`, `from` the input status and `to` the returned status (AC 18)
Proof: `npx vitest run domain/contract -t "C18:"`

### S3 - Pipeline stage · 3 files · ~5 KB · ~1k

**C19** - `PIPELINE_STAGES` from `web/domain/pipeline` equals `["in_progress", "sent", "accepted", "completed", "refused"]`, and the `PIPELINE_STAGES` exported by `web/lib/pipeline-stage.ts` is the same object (`toBe`) (AC 19)
Proof: `npx vitest run domain/pipeline -t "C19:"`
Proof: `npx vitest run lib/pipeline-stage -t "C19:"`

**C20** - `draft` and `changes_requested`, each with every contract value, give `in_progress` (AC 20, AC 26)
Proof: `npx vitest run domain/pipeline -t "C20:"`

**C21** - `sent`, with every contract value, gives `sent` (AC 21, AC 26)
Proof: `npx vitest run domain/pipeline -t "C21:"`

**C22** - `accepted` with contract absent, `pending_signature` or `client_signed` gives `accepted` (AC 22)
Proof: `npx vitest run domain/pipeline -t "C22:"`

**C23** - `accepted` with contract `completed` gives `completed` (AC 23)
Proof: `npx vitest run domain/pipeline -t "C23:"`

**C24** - `refused` and `expired`, each with every contract value, and `accepted` with contract `declined`, give `refused` (AC 24, AC 26)
Proof: `npx vitest run domain/pipeline -t "C24:"`

**C25** - `withdrawn`, with every contract value, and `accepted` with contract `voided`, give `null` (AC 25, AC 26)
Proof: `npx vitest run domain/pipeline -t "C25:"`

**C26** - the C20-C25 tables together cover all 42 agreement × contract combinations (7 × (5 + absent)) exactly once; the test asserts 42 distinct rows (AC 26)
Proof: `npx vitest run domain/pipeline -t "C26:"`

### S4 - Money in integer cents · 2 files · ~3 KB · ~1k

**C27** - `cents(0)` returns `0` and `cents(1428050)` returns `1428050` (AC 27)
Proof: `npx vitest run domain/money -t "C27:"`

**C28** - `cents` throws `RangeError` for `-1`, `0.5`, `NaN`, `Infinity` and `Number.MAX_SAFE_INTEGER + 1`, and accepts `Number.MAX_SAFE_INTEGER` (AC 28)
Proof: `npx vitest run domain/money -t "C28:"`

**C29** - `lineAnnualCents(4, cents(357000))` returns `1428000` (AC 29)
Proof: `npx vitest run domain/money -t "C29:"`

**C30** - `lineAnnualCents` throws `RangeError` for visits `0`, `-1` and `1.5`, and for `2` × `cents(Number.MAX_SAFE_INTEGER)` (AC 30)
Proof: `npx vitest run domain/money -t "C30:"`

**C31** - `sumCents([])` returns `0`, `sumCents([cents(1428000), cents(50)])` returns `1428050`, and `sumCents([cents(Number.MAX_SAFE_INTEGER), cents(1)])` throws `RangeError` (AC 31)
Proof: `npx vitest run domain/money -t "C31:"`

### S5 - The layer stays pure · 5 files · ~6 KB · ~2k

**C32** - ESLint run with the repo config over `domain/x.ts` reports `no-restricted-imports` for each of `next/link`, `react`, `@supabase/supabase-js`, `@/lib/money`, `@/components/ui/button`, `@/app/layout`, and reports none of them for the same imports in `composition/x.ts` (AC 32, door 1). Amended 2026-10-23 by ports-adapters, with the user's approval: the control was `lib/x.ts`, which now forbids `@supabase/*`; the claim (forbidden in `domain/`, allowed outside it) is unchanged
Proof: `npx vitest run domain/purity -t "C32:"`

**C33** - no non-test `.ts` file under `web/domain/` contains `Date.now`, `new Date(`, `Math.random` or `crypto` (AC 33)
Proof: `npx vitest run domain/purity -t "C33:"`

**C34** - `npm run build` and `npm run lint` exit 0, and `/pipeline` at 1440x900 shows the five columns In progress 3 · $35,880/yr, Sent to customer 3 · $33,450.50/yr, Accepted 2 · $27,700/yr, Completed 2 · $18,800/yr, Refused 2 · $0/yr (AC 34)
Proof: `npm run build`
Proof: `npm run lint`
Proof: Playwright MCP live check of `/pipeline` at 375x812, 768x1024 and 1440x900 (AGENTS..md, not committed), reading the column headers from `browser_snapshot`

**C35** - `web/package.json` declares `vitest` `5.0.3` in `devDependencies` and `"test": "vitest run"`, and `npm test` runs the domain test files and exits 0 (door 2)
Proof: `npm test`

**C36** - passing a plain `number` where `Cents` is expected is a type error (an `@ts-expect-error` line in the money test fails `tsc` if the error disappears), and `npx tsc --noEmit` exits 0 (door 5)
Proof: `npx tsc --noEmit`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| allowed agreement transitions (8) | `draft·send` C1 · `sent·accept` C2 · `sent·refuse` C3 · `sent·request_changes` C6 · `changes_requested·revise` C8 · `sent·expire` C9 · `draft·withdraw` C10 · `sent·withdraw` C10 | - |
| refused agreement status × command pairs (41) | C11, table-driven over all 41 (49 pairs minus the 8 above) | - |
| allowed contract transitions (6) | `pending_signature·client_sign` C13 · `client_signed·countersign` C14 · `pending_signature·decline` C15 · `client_signed·decline` C15 · `pending_signature·void` C16 · `client_signed·void` C16 | - |
| refused contract status × command pairs (14) | C17, table-driven over all 14 (20 pairs minus the 6 above) | - |
| event types, door 4 (11) | `agreement.sent` C1 · `agreement.accepted` C2 · `agreement.refused` C3 · `agreement.changes_requested` C6 · `agreement.revised` C8 · `agreement.expired` C9 · `agreement.withdrawn` C10 · `contract.client_signed` C13 · `contract.completed` C14 · `contract.declined` C15 · `contract.voided` C16 | - |
| error codes, door 3 (3) | `invalid_transition` C11, C17 · `reason_required` C4, C7 · `reason_too_long` C5 | - |
| reason bound (4 edges) | empty C4, C7 · whitespace only C4, C7 · 2000 C5 · 2001 C5 | - |
| pipeline agreement × contract (42) | C26, table-driven over all 42 (rows from C20-C25) | - |
| pipeline stage outputs (6) | `in_progress` C20 · `sent` C21 · `accepted` C22 · `completed` C23 · `refused` C24 · `null` C25 | - |
| `cents` rejected inputs (5) | negative C28 · non-integer C28 · `NaN` C28 · `Infinity` C28 · above max safe C28 | - |
| money overflow points (3) | `cents` C28 · `lineAnnualCents` product C30 · `sumCents` total C31 | - |
| forbidden import roots, door 1 (6) | `next` C32 · `react` C32 · `@supabase/*` C32 · `@/lib` C32 · `@/components` C32 · `@/app` C32 | - |
| doors (5) | 1 C32 · 2 C35 · 3 C11 · 4 C1 · 5 C28, C36 | - |
| stage-key importers from Impact (4) | `sample-pipeline.ts` C34 · `kanban-column.tsx` C34 · `pipeline-view.tsx` C34 · `status-pill.tsx` C34 (build typechecks every importer) | - |

- No claim names a status code, route or response shape: Surface is `None`
- No other check claims more than the cases its proof exercises

## Swept

- validation: C4, C5, C7, C27, C28, C30, C31
- failure modes: C11, C17 - a refused move is a returned value, never a throw (door 3)
- idempotency: C11 - re-applying a command to the status it produced (`send` on `sent`, `accept` on `accepted`) is `invalid_transition`; dedup of a retried write is the ports item
- authorization: n/a - role checks are out of scope in the plan; RLS already decides who writes `agreements` and `contracts`
- concurrency: n/a - pure functions with no shared state; guarding the status write against a concurrent change is the ports item
- data lifecycle: n/a - nothing is stored, archived or deleted
- dependency failure: n/a - no external dependency; C32 keeps it so
- state transitions: C1-C18, C20-C26
- observability: C12, C18 - every event carries `from` and `to`, which the events table keeps as the audit trail; no logging requirement in this layer

## Handoff

- S1-S5 ≈ 7k tokens (about 27 KB of new and touched files: 4 domain modules with tests, `lib/pipeline-stage.ts`, `eslint.config.mjs`, `package.json`, `vitest.config.ts`, `CONTEXT.md` and `ROADMAP.md` edits), all in `web/`, under the 150k budget - one builder
