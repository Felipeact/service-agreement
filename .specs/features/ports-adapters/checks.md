# Ports, Supabase adapters and composition root - checks

Profile: light
Plan: `.specs/features/ports-adapters/plan.md`

29 checks in 5 slices · 6 one-way doors · 0 open, of which 0 block

## How proofs run

The same three proof kinds as `.specs/features/supabase-init/checks.md`:

- **sql** - `sql supabase/tests/transitions.sql#C<n>` is one MCP `execute_sql` call whose query is
  the text of `supabase/tests/fixture.sql` followed by the text of `supabase/tests/transitions.sql`.
  The block tagged `-- C<n>` asserts that check and raises `C<n>: <reason>` on failure. The file
  ends in `rollback` and a passing run returns one row, `transitions.sql: pass`. Fixture users:
  `uA` owner of org A, `uB` owner of org B, `uV` viewer in A, `uE` estimator in A; the test file
  adds an admin `uD` in A. `agrA` starts `draft` with versions 1 and 2; `conA` starts `pending_signature`.
- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1:`), so
  `-t "C1:"` matches that check alone.
- **mcp** / **shell** - one Supabase MCP call, or a command run from `web/`, that passes when it
  exits 0 or the stated value matches.

"Nothing written" means, measured before and after the call: the entity's `status` is unchanged,
and the `events` rows for that entity, the `outbox` rows for org A and the `agreement_versions`
rows for that agreement have the same counts (counted as table owner).

## Checks

### S1 - An agreement transition is recorded atomically · 6 files · ~45 KB · ~11k

**C1** - as each of `uA` (owner), `uD` (admin) and `uE` (estimator), with `agrA` reset to `draft`,
`apply_agreement_transition(agrA, 'draft', 'sent', 'agreement.sent', '{"from":"draft","to":"sent"}')`
returns a non-null `uuid` and `agrA.status` becomes `sent`; and `transitionAgreement` with `send`
over a fake repository at `draft` returns `{ ok: true, status: "sent", eventId }` with the id the
fake returned, after calling `commitTransition` once with expected status `draft` (AC 1, door 2)
Proof: `sql supabase/tests/transitions.sql#C1`
Proof: `npx vitest run application -t "C1:"`

**C2** - after C1's call as `uE`, exactly one `events` row has `id` equal to the returned uuid, with
`type` `agreement.sent`, `entity_type` `agreement`, `entity_id` `agrA`, `org_id` org A, `actor_id`
`uE`'s id and `payload` equal to `{"from":"draft","to":"sent"}` (AC 2, door 5)
Proof: `sql supabase/tests/transitions.sql#C2`

**C3** - after C1's call as `uE`, exactly one `outbox` row has `event_id` equal to the returned uuid,
with `org_id` org A and `status` `pending` (AC 3, door 4)
Proof: `sql supabase/tests/transitions.sql#C3`

**C4** - running `transitionAgreement` with `refuse` and reason `"  Over budget  "` on an agreement
at `sent`, through the Supabase adapter over a stubbed client, calls
`rpc("apply_agreement_transition", { p_agreement_id, p_expected_status: "sent", p_to_status: "refused", p_event_type: "agreement.refused", p_payload: { from: "sent", to: "refused", reason: "Over budget" } })`;
and the SQL function stores a given `p_payload` in `events.payload` unchanged (AC 4, door 5)
Proof: `npx vitest run infrastructure/supabase -t "C4:"`
Proof: `sql supabase/tests/transitions.sql#C4`

**C5** - with `agrA` at `changes_requested` and version 2's `snapshot` set to `{"k":2}`, calling
the function as `uE` with `'changes_requested', 'draft', 'agreement.revised', '{"from":"changes_requested","to":"draft","versionNo":3}'`
sets `agrA` to `draft`, inserts exactly one `agreement_versions` row for `agrA` with `version_no` 3
and `snapshot` `{"k":2}`, and stores `payload.versionNo` 3; and `transitionAgreement` with `revise`
over a fake repository whose `findById` returns `versionNo` 2 commits an event whose
`data.versionNo` is 3 (AC 5, door 5)
Proof: `sql supabase/tests/transitions.sql#C5`
Proof: `npx vitest run application -t "C5:"`

**C6** - over a fake repository, `transitionAgreement` returns the domain refusal unchanged and
calls `commitTransition` 0 times, for each of: `accept` at `draft` (`invalid_transition`),
`refuse` with `"   "` at `sent` (`reason_required`), and `refuse` with 2001 characters at `sent`
(`reason_too_long`) (AC 6)
Proof: `npx vitest run application -t "C6:"`

**C7** - as `uE`, with `agrA` at `draft`, a call with `p_expected_status` `sent` fails with
SQLSTATE `40001` and writes nothing; and repeating C1's successful `send` call a second time with
the same arguments fails with `40001`, leaving exactly one `agreement.sent` event for that pair of
calls (AC 7)
Proof: `sql supabase/tests/transitions.sql#C7`

**C8** - as `uE`, a call for `agrB` (org B) and a call for a uuid that names no agreement each fail
with SQLSTATE `P0002` and write nothing (AC 8)
Proof: `sql supabase/tests/transitions.sql#C8`

**C9** - as `uV` (viewer), a call on `agrA` with the correct expected status fails with SQLSTATE
`42501` and writes nothing (AC 9)
Proof: `sql supabase/tests/transitions.sql#C9`

**C10** - as `anon`, calling `apply_agreement_transition` and `apply_contract_transition` each
fails with SQLSTATE `42501` (AC 10)
Proof: `sql supabase/tests/transitions.sql#C10`

**C11** - `pg_get_function_identity_arguments` is exactly
`p_agreement_id uuid, p_expected_status text, p_to_status text, p_event_type text, p_payload jsonb`
for `apply_agreement_transition` and
`p_contract_id uuid, p_expected_status text, p_to_status text, p_event_type text, p_payload jsonb`
for `apply_contract_transition`; no overload of either exists (AC 11, door 3)
Proof: `sql supabase/tests/transitions.sql#C11`

**C12** - after the migration, as `uE`, `insert into public.outbox` fails with SQLSTATE `42501`,
and `has_table_privilege('authenticated', 'public.outbox', 'insert')` is false (AC 12, door 4)
Proof: `sql supabase/tests/transitions.sql#C12`

**C13** - in `pg_proc`, both `apply_*_transition` functions have `prosecdef = false` and
`proconfig` containing `search_path=""`; `private.enqueue_outbox` has `prosecdef = true` and the
same `search_path`; `has_function_privilege('anon', ..., 'execute')` is false for all three and
`has_function_privilege('authenticated', ..., 'execute')` is true for all three (door 3, door 4)
Proof: `sql supabase/tests/transitions.sql#C13`

### S2 - A contract transition is recorded atomically · 4 files · ~20 KB · ~5k

**C14** - as `uE`, `apply_contract_transition(conA, 'pending_signature', 'client_signed', 'contract.client_signed', '{"from":"pending_signature","to":"client_signed"}')`
returns a uuid, sets `conA` to `client_signed`, and inserts exactly one `events` row with that id,
`type` `contract.client_signed`, `entity_type` `contract`, `entity_id` `conA`, `actor_id` `uE` and
that payload, plus exactly one pending `outbox` row for it; and `transitionContract` with
`client_sign` over a fake repository returns `{ ok: true, status: "client_signed", eventId }`
(AC 13)
Proof: `sql supabase/tests/transitions.sql#C14`
Proof: `npx vitest run application -t "C14:"`

**C15** - on `conA`: a stale expected status as `uE` fails `40001`; a call for `conB` as `uE` and
for an unknown uuid fail `P0002`; a call as `uV` fails `42501`; each writes nothing (AC 14)
Proof: `sql supabase/tests/transitions.sql#C15`

### S3 - The adapters map database outcomes · 4 files · ~15 KB · ~4k

**C16** - for both the agreement and the contract Supabase adapters, a stubbed `rpc` error with
`code` `40001`, `P0002` and `42501` makes the use case return `ok: false` with code `conflict`,
`not_found` and `forbidden` respectively; the test is table-driven over the 6 rows (AC 15, door 2)
Proof: `npx vitest run infrastructure/supabase -t "C16:"`

**C17** - for both adapters, a stubbed `rpc` error with code `23505` and a stubbed request that
rejects with `TypeError("fetch failed")` each make the use case reject with an `Error` whose message
contains `23505` or `fetch failed` respectively (AC 16)
Proof: `npx vitest run infrastructure/supabase -t "C17:"`

**C18** - for both use cases, a repository whose `findById` returns `null` makes the use case
return `ok: false` with code `not_found` and call `commitTransition` 0 times; and both Supabase
adapters' `findById` return `null` when the stubbed select returns no row (AC 17)
Proof: `npx vitest run application -t "C18:"`
Proof: `npx vitest run infrastructure/supabase -t "C18:"`

**C19** - the agreement adapter's `findById` returns `{ status: "sent", versionNo: 3 }` when the
stubbed select returns status `sent` with versions 1 and 3, and `versionNo` `0` when it returns no
versions (AC 18)
Proof: `npx vitest run infrastructure/supabase -t "C19:"`

### S4 - Clock · 2 files · ~1 KB · ~1k

**C20** - `systemClock.now()` returns a `Date` whose `getTime()` differs from `Date.now()` taken
around the call by at most 1000 ms (AC 19)
Proof: `npx vitest run infrastructure/clock -t "C20:"`

**C21** - `fixedClock(new Date("2026-10-23T12:00:00Z")).now()` returns a `Date` with that time on
each of three calls (AC 20)
Proof: `npx vitest run infrastructure/clock -t "C21:"`

### S5 - Composition root and boundaries · 8 files · ~25 KB · ~6k

**C22** - the first statement of `web/composition/index.ts` is `import "server-only";`, and with
both env variables set, `getContainer()` returns an object whose `transitionAgreement` and
`transitionContract` are functions and whose `clock.now()` returns a `Date` (AC 21, door 1)
Proof: `npx vitest run composition -t "C22:"`

**C23** - with `NEXT_PUBLIC_SUPABASE_URL` unset `getContainer()` rejects with an `Error` whose
message contains `NEXT_PUBLIC_SUPABASE_URL`, and with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` unset
it rejects with one containing `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (AC 22, door 6)
Proof: `npx vitest run composition -t "C23:"`

**C24** - ESLint run with the repo config over `application/x.ts` reports `no-restricted-imports`
for each of `next/headers`, `react`, `@supabase/supabase-js`, `@/lib/money`, `@/components/ui/button`,
`@/app/layout`, `@/infrastructure/clock`, `@/composition`, and reports none for `@/domain/agreement`
(AC 23, door 1)
Proof: `npx vitest run boundaries -t "C24:"`

**C25** - ESLint reports `no-restricted-imports` for `@/infrastructure/clock` and `@supabase/ssr`
in each of `app/x.tsx`, `components/x.tsx` and `lib/x.ts`; for `react`, `@/app/layout`,
`@/components/ui/button` and `@/composition` in `infrastructure/x.ts`; and reports none for
`@supabase/ssr` and `@/infrastructure/clock` in `composition/x.ts` (AC 24, door 1)
Proof: `npx vitest run boundaries -t "C25:"`

**C26** - `npm run build`, `npm run lint`, `npm test` and `npx tsc --noEmit` exit 0, and `/pipeline`
at 1440x900 shows In progress 3 · $35,880/yr, Sent to customer 3 · $33,450.50/yr, Accepted 2 ·
$27,700/yr, Completed 2 · $18,800/yr, Refused 2 · $0/yr (AC 25)
Proof: `npm run build`
Proof: `npm run lint`
Proof: `npm test`
Proof: `npx tsc --noEmit`
Proof: Playwright MCP live check of `/pipeline` at 375x812, 768x1024 and 1440x900 (AGENTS..md, not committed), reading the column headers from `browser_snapshot`

**C27** - after the migration, `get_advisors` with type `security` returns no lint whose
`metadata` or `detail` names `apply_agreement_transition`, `apply_contract_transition` or
`enqueue_outbox` (AC 26)
Proof: `mcp get_advisors(type: "security")` - no matching lint

**C28** - `web/package.json` `dependencies` declares `@supabase/supabase-js` `2.118.0`,
`@supabase/ssr` `0.12.7` and `server-only` `0.0.1` with no range prefix; `web/.env.example`
contains the keys `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; and
`git check-ignore web/.env.local` exits 0 (door 6)
Proof: `npx vitest run boundaries -t "C28:"`
Proof: `git check-ignore web/.env.local`

**C29** - the migration file is `supabase/migrations/<version>_transition_rpcs.sql`, where
`<version>` equals the version `list_migrations` reports for `transition_rpcs` (AD-006)
Proof: `mcp list_migrations()` - an entry named `transition_rpcs` whose version matches the file name


## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /rest/v1/rpc/apply_agreement_transition` statuses (4) | `200` C1 · `40001` C7 · `P0002` C8 · `42501` C9, C10 | - |
| `POST /rest/v1/rpc/apply_contract_transition` statuses (4) | `200` C14 · `40001` C15 · `P0002` C15 · `42501` C15, C10 | - |
| caller roles (6) | owner C1 · admin C1 · estimator C1 · viewer C9, C15 · member of another org C8, C15 · anon C10 | - |
| use-case error codes, door 2 (6) | `invalid_transition` C6 · `reason_required` C6 · `reason_too_long` C6 · `not_found` C16, C18 · `conflict` C16 · `forbidden` C16 | - |
| SQLSTATE -> code mapping, 3 codes × 2 adapters (6) | C16, table-driven over all 6 | - |
| unexpected failure kinds, 2 × 2 adapters (4) | agreement unmapped code C17 · agreement rejected request C17 · contract unmapped code C17 · contract rejected request C17 | - |
| `events.payload` shapes, door 5 (3) | `{from,to}` C2, C14 · `+reason` C4 · `+versionNo` C5 | - |
| rows a transition writes (4) | entity status C1, C14 · `events` C2, C14 · `outbox` C3, C14 · `agreement_versions` on revise C5 | - |
| "nothing written" conditions (4) | stale C7, C15 · not found / other org C8, C15 · viewer C9, C15 · domain refusal C6 | - |
| function attributes, doors 3-4, 3 functions × 3 (9) | C13, table-driven over all 9 (security mode, `search_path`, execute grants for each function) | - |
| lint boundary sources, door 1 (5) | `application` C24 · `infrastructure` C25 · `app` C25 · `components` C25 · `lib` C25 | - |
| startup config: Supabase env (1 assembly) | `getContainer()` C22, C23 - tests reach adapters through stubs, never the env | - |
| dependencies and env names, door 6 (5) | `@supabase/supabase-js` C28 · `@supabase/ssr` C28 · `server-only` C28 · `NEXT_PUBLIC_SUPABASE_URL` C23, C28 · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` C23, C28 | - |
| doors (6) | 1 C22, C24, C25 · 2 C1, C16 · 3 C7, C11, C13 · 4 C3, C12, C13 · 5 C2, C4, C5 · 6 C23, C28 | - |

- Claims naming a status or response shape: C1, C7-C10, C14-C17 - the SQL proofs cross the
  function boundary as the `authenticated` / `anon` roles PostgREST uses; the adapter proofs cross
  the `rpc` call through a stub, and the live adapter-to-PostgREST path is proven with the auth item
  (plan Assumptions)
- No other check claims more than the cases its proof exercises

## Swept

- validation: C6 - every domain refusal returns before any write; C23 for missing configuration
- failure modes: C7, C8, C9, C15 - a failed call writes none of the rows (one plpgsql function, one transaction); C17 - an unexpected error throws instead of returning a false success
- idempotency: C7 - repeating a successful call fails `40001` and leaves one event, so a retried commit cannot enqueue a second email
- authorization: C1, C8, C9, C10, C12, C15
- concurrency: C7, C15 - compare-and-set on the expected status; of two racing calls only one matches the row
- data lifecycle: n/a - nothing is archived or deleted; `events` stays append-only (supabase-init C28)
- dependency failure: C17 - a failed request to Supabase rejects with its cause
- state transitions: C6 here, and the domain-layer checks C1-C18 that decide every move
- observability: C2, C14 - each recorded transition carries its actor, from and to in `events`; no logging requirement beyond the audit log

## Handoff

- S1-S5 touch one new migration (~6 KB), one new SQL test file (~10 KB) read with `fixture.sql`
  (~11 KB), about 14 new TS files across `application/`, `infrastructure/`, `composition/` with
  tests (~35 KB), `eslint.config.mjs`, `package.json`, `vitest.config.mts`, the domain files read
  for types (~7 KB), and the `CONTEXT.md`, `ROADMAP.md` and `STATE.md` edits (~30 KB read): about
  100 KB, roughly 25k tokens, under the 150k budget - one builder

- **Boundary:** C1-C29 closed at `8fb5bcd` (one builder)
- **Settled mid-build:** domain-layer C32's control file moved from `lib/x.ts` to `composition/x.ts`, because `lib/` now forbids `@supabase/*` (user's choice; recorded in the domain-layer checks)
- **Abandoned:** none
