# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a criterion says two artifacts must agree, the proof must compare both directions, not only that each source value appears in the target.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `docs` · harmful: 0
- features: design-system-base
- evidence: checks.md C33 / AC 33 (docs)
- last seen: 2026-10-19T16:42:50Z

### L-002 - A 'handler is not invoked' claim needs a proof subject that actually has a handler; on an element without onClick the claim cannot fail.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web/ui` · harmful: 0
- features: design-system-base
- evidence: checks.md C17 / web/components/kanban/pipeline-view.tsx:53 (web/ui)
- last seen: 2026-10-19T16:42:51Z

### L-003 - State the starting database state in a seed check, and prove an idempotent seed on a database without its rows before the real run, since on conflict do nothing makes a later proof pass on old rows
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `seed` · harmful: 0
- features: catalog-seed
- evidence: verification.md gap: C12-C16 vs supabase/seed.sql:7-117 (seed)
- last seen: 2026-10-19T21:57:07Z

### L-004 - When a decision states a naming rule, list every name that breaks it in the same sentence, or the exception reads as a violation.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: domain-layer
- evidence: verification.md precision gap: AD-011 / plan door 4 vs agreement.revised (domain)
- last seen: 2026-10-23T22:03:05Z

### L-005 - A no-regression check must name the baseline commit it compares against, or it is only proven against the values written in the claim.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web/ui` · harmful: 0
- features: domain-layer
- evidence: verification.md precision gap: C34 'same counts and totals as before' (web/ui)
- last seen: 2026-10-23T22:03:05Z

### L-006 - When a page computes a link from route ids, assert the exact href per route with distinct ids in the fixture, never a prefix pattern.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `app pages` · harmful: 0
- features: record-forms
- evidence: C339 web/app/(app)/record-forms.test.ts:318 (app pages)
- last seen: 2026-10-26T19:27:11Z

### L-007 - When a check names a Server Action's result, write the action's own status-tagged state, not the store port's { ok } result it maps from.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web/app server actions` · harmful: 0
- features: import-upload
- evidence: checks.md C403 (web/app server actions)
- last seen: 2026-10-26T21:19:39Z

### L-008 - Define a failed request as a 4xx/5xx answer or a network error in live checks: Next drops Server Action and RSC streams with net::ERR_ABORTED after a 200.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `live validation` · harmful: 0
- features: import-upload
- evidence: checks.md C442 (live validation)
- last seen: 2026-10-26T21:19:40Z

### L-009 - When a check names several rendered parts for a role (pill and line), assert each part in that role's own render; a writer-view test does not prove the viewer view.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: import-parse
- evidence: web/components/imports/imports.test.ts:287 (C484) (components)
- last seen: 2026-10-26T22:35:12Z

### L-010 - Name the layer that owns each mapping in the claim (action vs component), and say in a live check whether Server Action responses aborted after a 200 are acceptable.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: import-parse
- evidence: C477, C499 (checks)
- last seen: 2026-10-26T22:35:12Z

### L-011 - When a check names a pill's tone, assert the tone attribute on the pill element itself, not only its label text.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: import-extract
- evidence: C543 web/components/imports/job-list.tsx:18 (round-1 fault 1) (components)
- last seen: 2026-10-27T15:28:56Z

### L-012 - When a port can fail by returning a failure value as well as by throwing, fake both shapes in the use-case failure table.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `application/use-cases` · harmful: 0
- features: import-extract
- evidence: C529 web/application/use-cases/extract-import.ts:56 (round-1 fault 2) (application/use-cases)
- last seen: 2026-10-27T15:28:56Z

### L-013 - Give every defensive early return in a use case one asserted case, or a regression that changes its answer passes unnoticed.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `application/use-cases` · harmful: 0
- features: import-extract
- evidence: web/application/use-cases/extract-import.ts:48,:67,:87 (round-1 gap 3) (application/use-cases)
- last seen: 2026-10-27T15:28:56Z

### L-014 - When a fix lands in a stateful client control, add a proof that imports that control, since props-only tests of its presentational child cannot see the fix.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: import-extract
- evidence: web/components/imports/extract-control.tsx:121 (AC 32, round-1 gap 4, still open at 6b61a9c) (components)
- last seen: 2026-10-27T15:28:57Z

### L-015 - Recount the numbered check ids before writing the check total in a checks header.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: import-extract
- evidence: .specs/features/import-extract/checks.md:6 (round-1 gap 6) (checks)
- last seen: 2026-10-27T15:28:57Z

### L-016 - When a check says a lint message names the module, assert the module specifier in the message, not the allowed folder.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `lint-boundaries` · harmful: 0
- features: import-extract
- evidence: C539 web/boundaries.test.ts:57 (round-1 gap 5) (lint-boundaries)
- last seen: 2026-10-27T15:29:02Z

### L-017 - When a view's control table depends on a flag the reader computes (editable), give the reader's rule its own labelled check, since a view test that builds the flag in its helper cannot fail when the reader is wrong.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: agreement-builder
- evidence: C716 web/components/agreements/agreements.test.ts:36 (fault F2) (components)
- last seen: 2026-10-27T20:50:10Z

### L-018 - Before naming a demo record in a live check that writes, confirm its current status allows the write, or name the write-authorised record in the claim.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `live validation` · harmful: 0
- features: cadence
- evidence: verification.md C1097 (checks.md Handoff Live: add/save not run, AG-1046 is sent) (live validation)
- last seen: 2026-10-30T20:55:00Z

### L-019 - When a check claims an order by a field the domain value does not carry, name the field's real carrier (array order) in the claim and give the fixture input out of that order, or the sort half cannot fail.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: seasonal-tasks
- evidence: verification.md precision gap: C1119 web/domain/agreement/seasonal.test.ts:148-151 (domain)
- last seen: 2026-10-30T21:30:57Z

### L-020 - Run the plain npm test command a check names before claiming it; a suite that passes only with a longer timeout is a failing gate until the config says so.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `web/vitest` · harmful: 0
- features: renewal
- evidence: C1216 (web/vitest)
- last seen: 2026-11-02T22:18:03Z

### L-021 - When a check names a comparison such as runIndex < 6, assert the operator as well as both operands.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `automation/n8n` · harmful: 0
- features: renewal
- evidence: web/n8n-workflows.test.ts:382 (automation/n8n)
- last seen: 2026-11-02T22:18:03Z

### L-022 - When a check says the latest version, select the highest version_no in the assertion rather than any version.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `supabase/tests` · harmful: 0
- features: renewal
- evidence: supabase/tests/demo_seed.sql:247 (supabase/tests)
- last seen: 2026-11-02T22:18:03Z

### L-023 - When a check names a pill's tone, assert the tone attribute on the pill element itself, not only its label text.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: proposal-expiry
- evidence: C1261 - web/components/kanban/pipeline-view.test.ts:189 (components)
- last seen: 2026-11-02T22:58:05Z

### L-024 - State a date window in the same calendar the code compares with, and build the test's dates from that same expression.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `supabase/tests` · harmful: 0
- features: proposal-expiry
- evidence: C1249 - supabase/tests/outbox_dispatch.sql:1201 vs migration 20261102222043_proposal_expiry.sql:417 (supabase/tests)
- last seen: 2026-11-02T22:58:05Z

### L-025 - When a check names an error hint as well as a SQLSTATE, assert the hint too, since expect_error compares the SQLSTATE only.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `supabase/tests` · harmful: 0
- features: proposal-expiry
- evidence: C1231 - supabase/tests/customer_portal.sql:937 (supabase/tests)
- last seen: 2026-11-02T22:58:05Z

### L-026 - Put a filter or decision a page computes for a component into a named function and test it there; a component test fed pre-filtered props cannot fail on it
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `app pages` · harmful: 0
- features: deactivation
- evidence: C1278 (round 1), web/app/(app)/assets/[assetId]/edit/page.tsx:25 (app pages)
- last seen: 2026-11-03T17:57:30Z

### L-027 - Give each branch of a status-dependent label its own asserted case, not only the one the live run happens to cross
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `components` · harmful: 0
- features: deactivation
- evidence: C1294, web/app/(app)/sites/[siteId]/edit/page.tsx:34 (components)
- last seen: 2026-11-03T17:57:30Z

### L-028 - When a check says per C<n>, assert every side effect C<n> asserts, not only the status change
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `sql tests` · harmful: 0
- features: deactivation
- evidence: C1296, supabase/tests/record_forms.sql (sql tests)
- last seen: 2026-11-03T17:57:31Z

### L-029 - Read the real event payload (the writing RPC or a live row) before deriving anything from events.payload: agreement.sent carries no versionNo, and unit tests built on an assumed payload passed anyway.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase events, infrastructure/supabase` · harmful: 0
- features: versioning
- evidence: checks.md C1329 / agreements.ts versionOfEvent (supabase events, infrastructure/supabase)
- last seen: 2026-11-03T19:54:53Z

### L-030 - When a check names a hint or message, assert the hint text; tests.expect_error compares the SQLSTATE only.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase/tests` · harmful: 0
- features: versioning
- evidence: verification.md round 1 C1324/C1325 (supabase/tests)
- last seen: 2026-11-03T19:54:53Z

### L-031 - When a check names a concrete value that depends on the fixture (versionNo 2), build the fixture so a hard-coded default cannot produce it, and assert that value.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `supabase/tests` · harmful: 0
- features: contract-generation
- evidence: C1601 transitions.sql:388 (round 1) (supabase/tests)
- last seen: 2026-11-05T20:32:26Z

### L-032 - A static-markup test cannot see the server and client boundary: run every new Server Component page once in the real app before calling it done, and never call a function exported from a use-client file in a server component.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `web/ui` · harmful: 0
- features: contract-generation
- evidence: live run 2026-11-05, contract page crash (termSummary from a use-client file) (web/ui)
- last seen: 2026-11-05T20:32:27Z

### L-033 - When a check says exactly the body, assert equality of the trimmed body, not toContain, or a second method on the port still passes.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `lint-boundaries` · harmful: 0
- features: contract-generation
- evidence: C1647 web/boundaries.test.ts:83 (round 1) (lint-boundaries)
- last seen: 2026-11-05T20:32:27Z

### L-034 - A test that renders a client-only component to static markup sees only its server placeholder, so assert the props handed to it by walking the element tree, and pin the mounted branch with a mocked hook in its own test.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web/ui` · harmful: 0
- features: signature-provider
- evidence: web/components/signing/signing-view.tsx:96 (web/ui)
- last seen: 2026-11-06T18:47:34Z

### L-035 - Every early-return branch of a use case needs its own asserted answer, because the happy-path tests never reach it and a changed code passes the whole suite.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `application` · harmful: 0
- features: signature-provider
- evidence: web/application/use-cases/signing.ts:46 (application)
- last seen: 2026-11-06T18:47:35Z

### L-036 - A table constraint that an RPC guard refuses first is never reached by RPC tests, so write the statement straight to the table as its owner and assert the constraint name.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `database` · harmful: 0
- features: signature-provider
- evidence: checks.md C1722, supabase/tests/transitions.sql (database)
- last seen: 2026-11-06T18:47:35Z

### L-037 - A proof line must name the file that holds the test; a -t filter that matches nothing exits 0 and reads as a green proof.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: signature-provider
- evidence: checks.md C1701 (specs)
- last seen: 2026-11-06T18:47:36Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
