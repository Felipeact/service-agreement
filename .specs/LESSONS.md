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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
