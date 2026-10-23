# Domain layer verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 247558f..17a17b6
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 36 checks were proven at `17a17b6` (HEAD). Every proof was run by the Verifier and is listed below. The tree was read-only, and `git status --porcelain` was empty before and after the run. Browser snapshots went to `.playwright-mcp/`, which git ignores (`.gitignore:2`).

## Binding sources

Step 1 is not required under `light`. Each source the plan names as binding was still opened and compared with the checks.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `supabase/migrations/20261019174738_init.sql:125` agreements status check (7) | yes | none: `web/domain/agreement/index.ts:4-12` has the same 7 values | - |
| `supabase/migrations/20261019174738_init.sql:167` contracts status check (5) | yes | none: `web/domain/contract/index.ts:4` has the same 5 values | - |
| ROADMAP.md Status model (lines 43-57) | yes | none: the 8 agreement transitions and 6 contract transitions match C1-C18. Refused is the only exit stage. Mapping withdrawn and voided to `null` is an approved plan assumption | - |
| `.specs/STATE.md` AD-001 | yes | none: stage keys and order match C19 | - |
| `.specs/STATE.md` AD-005 | yes | none: statuses are text checks, money is in `_cents`, and the TS machine owns transitions | - |

## Checks

Proof command for C1-C33 and C36 (run once from `web/`, exit 0, 6 files, 159 tests, each shown individually by the verbose reporter):
`npx vitest run --reporter=verbose domain lib/pipeline-stage`

Every `-t "Cn:"` selector matched at least one test. Hit counts: C1 1, C2 1, C3 1, C4 2, C5 2, C6 1, C7 2, C8 2, C9 1, C10 2, C11 42, C12 8, C13 1, C14 1, C15 2, C16 2, C17 15, C18 6, C19 2, C20 12, C21 6, C22 4, C23 1, C24 13, C25 7, C26 1, C27 1, C28 6, C29 1, C30 4, C31 1, C32 6, C33 1, C36 1. C34 and C35 are proven by commands, not by named tests. A spot check confirmed the selector is precise: `npx vitest run domain/agreement -t "C1:"` gave 1 passed and 64 skipped, so `C1:` does not match `C11:`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | send on draft -> sent, `agreement.sent` | vitest batch, `C1:` 1 hit, pass | `web/domain/agreement/agreement.test.ts:39-41` - `expect(result.ok).toBe(true)`; `.toBe("sent")`; `.toBe("agreement.sent")` | PASS |
| C2 | accept on sent -> accepted | vitest batch, 1 hit | `web/domain/agreement/agreement.test.ts:46-47` - `expect(result.status).toBe("accepted")`; `expect(result.event.type).toBe("agreement.accepted")` | PASS |
| C3 | refuse trims reason | vitest batch, 1 hit | `web/domain/agreement/agreement.test.ts:51,54` - input `"  Over budget  "`; `expect(result.event.data.reason).toBe("Over budget")` | PASS |
| C4 | empty/blank refuse reason -> reason_required from sent | vitest batch, 2 hits (`""`, `"   "`) | `web/domain/agreement/agreement.test.ts:60-61` - `.toBe("reason_required")`; `expect(!result.ok && result.error.from).toBe("sent")` | PASS |
| C5 | 2000 accepted, 2001 -> reason_too_long, both commands | vitest batch, 2 hits (refuse, request_changes) | `web/domain/agreement/agreement.test.ts:65-69` - `` ` ${"a".repeat(2000)} ` `` gives `expect(atLimit.ok).toBe(true)`; `"a".repeat(2001)` gives `.toBe("reason_too_long")` | PASS |
| C6 | request_changes trims note | vitest batch, 1 hit | `web/domain/agreement/agreement.test.ts:74-76` - `.toBe("changes_requested")`; `.toBe("agreement.changes_requested")`; `data.reason` `.toBe("Add the boiler")` | PASS |
| C7 | empty/blank note -> reason_required | vitest batch, 2 hits | `web/domain/agreement/agreement.test.ts:82` - `expect(!result.ok && result.error.code).toBe("reason_required")` | PASS |
| C8 | revise v1->2, v3->4, status draft | vitest batch, 2 hits | `web/domain/agreement/agreement.test.ts:86-92` - rows `[1, 2]`, `[3, 4]`; `expect(result.event.data.versionNo).toBe(next)`; `.toBe("draft")`; `.toBe("agreement.revised")` | PASS |
| C9 | expire on sent -> expired | vitest batch, 1 hit | `web/domain/agreement/agreement.test.ts:97-98` - `.toBe("expired")`; `.toBe("agreement.expired")` | PASS |
| C10 | withdraw on draft and sent -> withdrawn | vitest batch, 2 hits | `web/domain/agreement/agreement.test.ts:103-104` - `.toBe("withdrawn")`; `.toBe("agreement.withdrawn")` | PASS |
| C11 | 41 refused pairs -> invalid_transition with from/command; table size 41 | vitest batch, 42 hits (1 size test + 41 rows) | `web/domain/agreement/agreement.test.ts:115` - `expect(refused).toHaveLength(41)`; `:122-124` - `.toBe("invalid_transition")`, `error.from` `.toBe(status)`, `error.command` `.toBe(type)` | PASS |
| C12 | 8 allowed moves emit entityType agreement, from, to | vitest batch, 8 hits | `web/domain/agreement/agreement.test.ts:130-132` - `entityType` `.toBe("agreement")`; `event.from` `.toBe(from)`; `event.to` `.toBe(to)` | PASS |
| C13 | client_sign -> client_signed | vitest batch, 1 hit | `web/domain/contract/contract.test.ts:29-30` - `.toBe("client_signed")`; `.toBe("contract.client_signed")` | PASS |
| C14 | countersign -> completed | vitest batch, 1 hit | `web/domain/contract/contract.test.ts:35-36` - `.toBe("completed")`; `.toBe("contract.completed")` | PASS |
| C15 | decline from both open statuses | vitest batch, 2 hits | `web/domain/contract/contract.test.ts:41-42` - `.toBe("declined")`; `.toBe("contract.declined")` | PASS |
| C16 | void from both open statuses | vitest batch, 2 hits | `web/domain/contract/contract.test.ts:47-48` - `.toBe("voided")`; `.toBe("contract.voided")` | PASS |
| C17 | 14 refused pairs incl. countersign on pending_signature | vitest batch, 15 hits | `web/domain/contract/contract.test.ts:59-60` - `toHaveLength(14)`; `toContainEqual(["pending_signature", "countersign"])`; `:67-69` - code, from, command | PASS |
| C18 | 6 allowed moves emit entityType contract, from, to | vitest batch, 6 hits | `web/domain/contract/contract.test.ts:75-77` - `entityType` `.toBe("contract")`; `.toBe(from)`; `.toBe(to)` | PASS |
| C19 | stage order; lib re-export is the same object | vitest batch, 2 hits (domain + lib) | `web/domain/pipeline/pipeline.test.ts:28` - `toEqual(["in_progress", "sent", "accepted", "completed", "refused"])`; `web/lib/pipeline-stage.test.ts:6` - `expect(PIPELINE_STAGES).toBe(domainStages)` | PASS |
| C20 | draft / changes_requested x every contract -> in_progress | vitest batch, 12 hits | `web/domain/pipeline/pipeline.test.ts:33` - `expect(pipelineStage(agreement, contract)).toBe(stage)` over table `:14` | PASS |
| C21 | sent x every contract -> sent | vitest batch, 6 hits | `web/domain/pipeline/pipeline.test.ts:33` over table `:15` | PASS |
| C22 | accepted with absent / pending / client_signed -> accepted | vitest batch, 4 hits (null, pending, client_signed, omitted argument) | `web/domain/pipeline/pipeline.test.ts:33` over `:17-19`; `:38` - `expect(pipelineStage("accepted")).toBe("accepted")` | PASS |
| C23 | accepted + completed -> completed | vitest batch, 1 hit | `web/domain/pipeline/pipeline.test.ts:33` over `:21` | PASS |
| C24 | refused / expired x every contract, accepted + declined -> refused | vitest batch, 13 hits | `web/domain/pipeline/pipeline.test.ts:33` over `:22` | PASS |
| C25 | withdrawn x every contract, accepted + voided -> null | vitest batch, 7 hits | `web/domain/pipeline/pipeline.test.ts:33` over `:23` | PASS |
| C26 | 42 distinct combinations | vitest batch, 1 hit | `web/domain/pipeline/pipeline.test.ts:45-46` - `expect(keys).toHaveLength(42)`; `expect(new Set(keys).size).toBe(42)` | PASS |
| C27 | cents(0), cents(1428050) | vitest batch, 1 hit | `web/domain/money/money.test.ts:8-9` - `expect(cents(0)).toBe(0)`; `expect(cents(1428050)).toBe(1428050)` | PASS |
| C28 | RangeError for 5 inputs, MAX_SAFE accepted | vitest batch, 6 hits | `web/domain/money/money.test.ts:12-13` - `[-1, 0.5, NaN, Infinity, MAX + 1]` with `toThrow(RangeError)`; `:17` - `expect(cents(MAX)).toBe(MAX)` | PASS |
| C29 | lineAnnualCents(4, 357000) = 1428000 | vitest batch, 1 hit | `web/domain/money/money.test.ts:21` - `expect(lineAnnualCents(4, cents(357000))).toBe(1428000)` | PASS |
| C30 | visits 0/-1/1.5 and overflow throw | vitest batch, 4 hits | `web/domain/money/money.test.ts:24-25` - `[0, -1, 1.5]` with `toThrow(RangeError)`; `:29` - `lineAnnualCents(2, cents(MAX))` `toThrow(RangeError)` | PASS |
| C31 | sumCents empty / sum / overflow | vitest batch, 1 hit | `web/domain/money/money.test.ts:33-35` - `.toBe(0)`; `.toBe(1428050)`; `toThrow(RangeError)` | PASS |
| C32 | 6 forbidden imports flagged in domain/, none in lib/ | vitest batch, 6 hits | `web/domain/purity.test.ts:30-32` - `expect(inDomain).toHaveLength(1)`; `toContain(specifier)`; `expect(await restrictedImports("lib/x.ts", specifier)).toHaveLength(0)` | PASS |
| C33 | no clock / randomness in domain sources | vitest batch, 1 hit | `web/domain/purity.test.ts:37,41` - `files.length` `toBeGreaterThanOrEqual(4)`; `expect(text.includes(forbidden), ...).toBe(false)` for each of the 4 tokens | PASS |
| C34 | build + lint exit 0; /pipeline columns unchanged | `npm run build` exit 0 (routes `/_not-found`, `/pipeline`); `npm run lint` exit 0; Playwright MCP live check on dev server port 3217 | `web/lib/pipeline-stage.ts:4` - `export { PIPELINE_STAGES, type PipelineStage } from "@/domain/pipeline"`. Snapshots at 1440x900 and 768x1024 show the column headers In progress 3 · $35,880/yr, Sent to customer 3 · $33,450.50/yr, Accepted 2 · $27,700/yr, Completed 2 · $18,800/yr, Refused 2 · $0/yr. At 375x812 the board is a tablist (`In progress 3`, `Sent to customer 3`, `Accepted 2`, `Completed 2`, `Refused 2`), and selecting each tab showed the same five headers and totals. `web/lib/sample-pipeline.ts` and `web/components/**` are unchanged in the diff | PASS |
| C35 | vitest 5.0.3 devDependency, test script, npm test green | `npm test` exit 0, 6 files, 159 passed | `web/package.json:10` - `"test": "vitest run"`; `web/package.json:23` - `"vitest": "5.0.3"`; `web/package-lock.json:7628` - `"version": "5.0.3"` | PASS |
| C36 | plain number is not Cents; tsc clean | `npx tsc --noEmit` exit 0; the test runs in the batch (1 hit) | `web/domain/money/money.test.ts:39-40` - `// @ts-expect-error ...` above `const amount: Cents = 100;`. `web/tsconfig.json:27` includes `**/*.ts`, so tsc covers the test file | PASS |

## Level and sampling

- No claim names a status code, route or response shape (the plan's Surface is `None`), so there is no level gap. The pure-function proofs sit at the right level.
- C11, C17 and C20-C26 are table-driven over the full sets: 41 refused agreement pairs, 14 refused contract pairs and 42 pipeline combinations. The verbose output shows every row, so no claim covers more cases than its proof runs.
- Coverage was not recomputed (not required under `light`). I spot-joined the 11 event types against door 4 and the 3 error codes against door 3, and each has a passing proof.

## Swept rows marked existing (re-read in code)

- failure modes (C11, C17): a refusal is a returned value, never a throw. Confirmed at `web/domain/agreement/index.ts:52-58` (`fail(...)` returns `{ ok: false, error }`) and `web/domain/contract/index.ts:25-27`. The domain modules contain no `throw`. `cents` throws only for money, and door 5 allows that.
- idempotency (C11): re-applying a command to the status it produced is refused. The test output includes the rows `sent with send is invalid_transition` and `accepted with accept is invalid_transition` (`web/domain/agreement/agreement.test.ts:118`).
- observability (C12, C18): every event carries `from` and `to`. Confirmed at `web/domain/agreement/index.ts:73` and `web/domain/contract/index.ts:31`.
- validation and state transitions: covered by the check rows above.
- Rows marked `n/a` are approved policy and were not re-read.

## Findings (none fail the feature)

1. Misleading test titles (cosmetic) in C12 and C18. In `web/domain/agreement/agreement.test.ts:127` and `web/domain/contract/contract.test.ts:72`, the title has four `%s` placeholders for three values, so it prints e.g. "draft with send emits an agreement event from sent to undefined". The assertions are correct, but the titles misstate the transition.
2. Precision gap in the decisions, not the checks. AD-011 (written by this feature) states event `type` = `<entity>.<to-status>`, but `agreement.revised` ends in `draft`. Door 4 and C8 name `agreement.revised` explicitly, so the code and checks agree with the plan. The rule's wording in AD-011 and door 4's header has one exception it does not mention.
3. Precision gap in C34. "Same counts and totals as before" is proven against literal values in the claim. The pre-change board at 247558f was not rendered. The equivalence rests on `sample-pipeline.ts` and `components/**` being untouched in the diff, plus the literal match. The claim also names only 1440x900, while its proof names three viewports. At 375x812 the totals show only for the selected tab.
4. Minor precision gap in C36. The claim says "passing a plain number where Cents is expected", but the test assigns to a `Cents` variable rather than passing an argument. The type check is the same, so the check holds.
5. Minor precision gap in C26. The test proves 42 distinct keys, not membership in the cross-product. Completeness follows only because the row types bound the key space to 7 x 6 = 42.
6. Stale name in the checks.md Handoff: it says `vitest.config.ts`, but the file is `web/vitest.config.mts`, as the plan's Impact states.
7. Fault injection was not run (not required under `light`), so this report does not show whether any assertion would survive a wrong implementation.

## Gate

`npm test` (from `web/`) - 159 passed, 0 failed (6 files). `npx tsc --noEmit` exit 0. `npm run lint` exit 0. `npm run build` exit 0.
