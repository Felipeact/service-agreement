# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Pipeline stage keys are `in_progress`, `sent`, `accepted`, `completed`, `refused`, in that order; the Phase 1 domain layer owns them and the UI imports them | a stage spans agreement and contract statuses, so it cannot reuse either enum; UI, filters and later URL params bind to these names | active | 2026-10-19 |
| AD-002 | Colours, radii and shadows are read only through the Tailwind `@theme` role tokens in `web/app/globals.css`; no hex literal or default-palette class in components | one source of truth, and role names let customer-facing surfaces swap in the tenant accent | active | 2026-10-19 |

## Handoff

**Feature**: design-system-base
**Where**: C1-C35 built and proven by the author at `web@4d293fa`; independent Verifier pending
**In progress**: none
**Next step**: Verifier report in `.specs/features/design-system-base/verification.md`, then `validate_verification.py`
**Blockers**: none
**Uncommitted**: none after the docs commit; `.playwright-mcp/` captures are local only
**Branch**: development (outer), master (`web/`)
