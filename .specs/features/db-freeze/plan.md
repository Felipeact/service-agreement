# Database-level freeze

## Problem

When a company's subscription ends (`canceled`, `unpaid`, `incomplete_expired`), the workspace is meant to be read-only until the owner renews. Today only the app enforces that: `supabaseMemberDirectory.currentMember` swaps the member's role for `viewer` when `public.my_org_frozen()` is true (`web/infrastructure/supabase/auth.ts:64-74`). Every row-level policy and write function still asks `private.has_org_role`, which looks only at `memberships`. A frozen owner holds a valid session and the project's public API key, so a direct PostgREST or RPC call writes to the org's customers, agreements, imports and templates, and nothing in the database refuses it. The same applies to any new server action that forgets the member check.

The ROADMAP lists this as open: "Not built: database-level enforcement of the read-only state (the app layer enforces it today)". There is no incident or measured loss behind it; the cost is that a cancelled customer can keep using the product for free through the API, and "read-only" is a promise the database does not keep.

What changes for a user: nothing visible. A frozen owner who bypasses the app gets a refusal instead of a write, and an owner who renews is thawed with no extra step.

## Flow

Reuses the single gate every write already passes, `private.has_org_role` (init migration, 16 policies in `20261019174738_init.sql` and about 60 call sites in security-definer functions), and the status set already defined by `public.my_org_frozen()`. No call site changes except the few reads that must stay open.

1. A write enters (PostgREST insert/update/delete, or an RPC) -> RLS policy or write function (exists) calls `private.has_org_role(org, roles)`.
2. `private.has_org_role` (exists, body changes) returns false when the org is frozen, otherwise its current answer. It asks `private.org_is_frozen(org)` (new, door 1).
3. `private.org_is_frozen(org)` (new, door 1) reads `public.org_billing.status` for that org; no row means not frozen.
4. A handful of reads that use `has_org_role` today (billing row, pending invitations, usage) call `private.has_org_role_any_state` (new, door 2), the old body, so a frozen owner can still see Billing and renew.
5. out: a refused write raises what the function raises today when the role is missing (`42501`), or RLS returns the usual policy violation; the adapters already map both to `forbidden`.
6. Renewal: `private.apply_billing_event` (exists) sets `status = 'active'`; the next statement passes step 2. No code change there.

## Impact

| Front | What changes |
| --- | --- |
| domain | existing term: `has_org_role` meant "this user holds one of these roles in the org", now means "...and the org is not frozen". Branches on it today: 16 policies in init, every `if not has_org_role(...)` writer check, `org_billing_select`, `invitations_select`, the usage reader, `set_org_plan`, the signature and portal writers |
| domain | new term: frozen org = `org_billing.status in ('canceled','unpaid','incomplete_expired')`, lives in `private.org_is_frozen`; `my_org_frozen` and `ENDED_STATUSES` (`web/domain/billing/overview.ts`) must agree with it |
| stored data | nothing to migrate; no table or column changes. An org with no `org_billing` row (the demo org) stays unfrozen |
| behaviour | a frozen owner can no longer change members, templates, settings, logo or plan through the API; the app already blocked all of these |
| performance | each policy check gains one lookup on `org_billing` (primary key). Policies already wrap the call in `(select ...)`, so it runs once per statement |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. Error codes are the ones writers already raise.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. The freeze is part of `has_org_role`, not a new gate | `private.has_org_role(p_org, p_roles)` keeps its signature and returns `exists(membership with role) and not private.org_is_frozen(p_org)`; `private.org_is_frozen(p_org uuid) returns boolean` (`stable`, `security definer`, `search_path = ''`, not executable by `anon`) | A separate `has_org_write` swapped into every policy and function: fails open, because any writer added or missed keeps writing while frozen, and it means editing ~75 definitions across 30 migrations |
| 2. The reads that must survive a freeze | `private.has_org_role_any_state(p_org, p_roles)` is the current `has_org_role` body, same grants; used only by the read paths classified in the checks (known: `org_billing_select`, `invitations_select`, the usage reader) | Reading billing through `my_org_frozen`-style booleans only: the Billing page needs the real row (customer id, plan) and Stripe ids, and a frozen owner must reach Renew |

- Nothing else in this change is hard to reverse. Whether a customer may still accept or sign a frozen org's sent agreement is scope and lives in `Assumptions`.

## Criteria

### S1: A frozen org cannot write through the database (P1)

An owner, admin or estimator of a frozen org is refused on every write path, including the ones the app never exposes.

**Acceptance Criteria**

1. WHILE an org is frozen, WHEN a member with write role inserts, updates or deletes a row in any table whose policy uses `has_org_role`, THEN the system SHALL refuse it with a row-level-security violation and leave the row unchanged.
2. WHILE an org is frozen, WHEN a member calls a security-definer write function that checks `has_org_role` (agreements, service lines, imports, templates, members, contracts, settings, plan), THEN the system SHALL raise `42501` and change nothing.
3. WHILE an org is frozen, WHEN a member uploads or deletes an object in the `imports` or `logos` buckets, THEN the system SHALL refuse it.
4. WHILE an org is frozen, the system SHALL still return that org's rows to its members on every select policy.
5. The system SHALL treat an org with no `org_billing` row as not frozen.

**Independent test:** in a rolled-back SQL test, set the demo-like fixture org's `org_billing.status` to `canceled` and run one write per table and function as an owner.

### S2: A frozen owner can still see Billing and renew (P1)

**Acceptance Criteria**

6. WHILE an org is frozen, WHEN its owner or admin selects from `org_billing`, THEN the system SHALL return the row.
7. WHILE an org is frozen, WHEN its owner or admin selects pending `invitations` and the usage figures, THEN the system SHALL return them.
8. WHEN a `checkout.session.completed` carrying `sa_renew_org` is stored for a frozen org, THEN the system SHALL set `org_billing.status = 'active'` and the next write by a member SHALL succeed.
9. WHEN an event for a different org's subscription sets its status to `canceled`, THEN the system SHALL leave every other org writable.

**Independent test:** freeze the fixture org, read billing as owner, apply a renewal event, write a customer.

### S3: The same set of statuses everywhere (P2)

**Acceptance Criteria**

10. The system SHALL freeze exactly `canceled`, `unpaid` and `incomplete_expired`, and a test SHALL fail if `private.org_is_frozen`, `public.my_org_frozen` and `ENDED_STATUSES` disagree on any Stripe status in a listed set (`active`, `trialing`, `past_due`, `incomplete`, `paused`, `canceled`, `unpaid`, `incomplete_expired`).
11. IF a status outside that set arrives from Stripe, THEN the system SHALL leave the org writable.

**Independent test:** run the status list through all three.

## Out of scope

| Excluded | Why |
| --- | --- |
| Blocking the customer's accept, refuse, change request and signing on a frozen org's sent agreements | Customers did nothing wrong, and the portal and signing paths use tokens, not a member session. See Assumptions |
| Stopping n8n reminders and emails for a frozen org | Automation is separate from member writes; no product answer yet |
| Deleting or exporting a frozen org's data | Decision: nothing is deleted on freeze |
| Grace period for `past_due` | Stripe retries failed payments; the product freezes only on the ended statuses |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Portal and signing writes (token-based, no `auth.uid()`) | stay open while frozen | They do not call `has_org_role`; blocking a customer's acceptance harms a third party | n |
| Staff cannot change plan while frozen | `set_org_plan` is refused; renewal is the only way back | A canceled subscription has nothing to change; renewal swaps it | n |
| Error shown if the app is bypassed | the existing `forbidden` mapping | No new copy; the banner already explains the freeze | n |
| Members page is read-only while frozen | invite, role change and removal are refused | Consistent with "read-only until it renews" | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| database policies and RPCs | error shape and codes | AC 1, 2, 3 (existing codes, `42501` and policy violation) |
| database policies and RPCs | who may call, and what stays readable | AC 4, 6, 7 |
| `has_org_role` / `org_is_frozen` | rate limit, versioning | n/a - internal functions, no external caller |
| screen Billing | frozen owner's access | AC 6 |
| all existing screens | empty, loading, error, unauthorised states | n/a - no screen changes; the frozen banner and role swap already exist |

## Sources

- ROADMAP.md Phase 5, "Database-level freeze" and the frozen-workspace item (2026-11-13) - the requirement and the "Not built" note
- `supabase/migrations/20261113130000_frozen_workspace.sql` - the status set and `my_org_frozen`
