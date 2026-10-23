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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
