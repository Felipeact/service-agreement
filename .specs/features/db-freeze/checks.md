# Database-level freeze checks

Profile: ui
Plan: `.specs/features/db-freeze/plan.md`

16 checks in 3 slices · 2 one-way doors · 0 open

Proof commands: SQL checks run as `cd web && npm run test:db db_freeze` (new recipe `plain("db_freeze")` in `web/scripts/test-db/runner.mts`, file `supabase/tests/db_freeze.sql`; the file ends in rollback and raises on the first failed assertion, so exit 0 means every labelled assertion passed, and a check's label prefix `C56xx` names its assertions). TS checks run as `cd web && npx vitest run <file> -t "<name>"`. Expected values come from the plan, never read back from the migration.

Test fixture: `fixture.sql` has org A (owner uA, estimator uE, viewer uV) and org B (owner uB). The test adds an admin `uAd` to org A, and an `org_billing` row for A (status set per check) and, where stated, for B. Org B has no billing row unless a check says so.

## Checks

### S1 - A frozen org cannot write through the database · 1 migration, 1 test file · ~30 KB · ~8k

**C5601** - With org A's billing status `canceled`, `private.has_org_role(orgA, roles)` is false for uA (owner), uAd (admin), uE (estimator) and uV (viewer), each asked for its own role; with status `active` the same four calls are true (plan AC 1, 2)
Proof: `cd web && npm run test:db db_freeze` (assertions labelled `C5601 frozen <role>` and `C5601 active <role>`)

**C5602** - Frozen, as uA, an insert into each of 13 tenant tables that `tests.insert_sql` supports and members can insert into (`org_settings`, `customers`, `contacts`, `sites`, `asset_types`, `asset_type_tasks`, `assets`, `agreements`, `agreement_versions`, `service_lines`, `events`, `import_jobs`, `import_rows`) fails with `42501`; unfrozen, the same statement is not refused with `42501` on any of them and inserts a row on at least 10 of the 13 (the rest hit a unique constraint, which is past the policy) (plan AC 1). `contracts` is not in this set either: members have no insert path (`create_contract` writes it, covered by C5605), so the unfrozen insert is already `42501`. `memberships` is not in this set: its inserts go through RPCs and are refused for members whatever the billing status
Proof: `cd web && npm run test:db db_freeze` (assertions `C5602 insert <table>` and the control `C5602 control <table>`)

**C5603** - Frozen, as uA, an update and a `delete` on org A rows change 0 rows (or fail `42501`) on each of 13 tables of the write-policy set, and the unfrozen control changes at least 1 row on each of them (the test asserts 13 are exercised; `agreement_versions`, `contracts` and `events` have no member update or delete path, so the freeze adds nothing there); rows are unchanged afterwards (plan AC 1)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5603 update <table>`, `C5603 delete <table>`, `C5603 control <table>`)

**C5604** - Frozen, as uA, these write functions raise `42501` and change nothing: `create_agreement`, `save_service_line`, `create_invitation`, `set_member_role`, `save_contract_template`, `set_org_plan`; unfrozen, each passes the role check (plan AC 2)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5604 <function>`)

**C5605** - Every function in the write list (37 names in Coverage: 30 public, 7 private) contains a call to `private.has_org_role` in its source and none contains `has_org_role_any_state`, so C5601 is the gate each one goes through (plan AC 2; this is the level bridge for the functions C5604 does not call)
Proof: `cd web && npm run test:db db_freeze` (assertion `C5605 <function>` for each of 37)

**C5606** - Frozen, as uA, an insert into `storage.objects` for bucket `imports` and for bucket `logos` under org A's folder, and a delete of an existing such object, are each refused; the unfrozen control accepts them (plan AC 3)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5606 <bucket> insert`, `C5606 <bucket> delete`)

**C5607** - Frozen, as uA, `select count(*)` over each table in `tests.tenant_tables()` except `outbox` returns at least 1 for org A, as C10 does for a viewer (plan AC 4)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5607 read <table>`)

**C5608** - An org with no `org_billing` row is writable: as uB (org B, no billing row), an update of a customer changes 1 row and `private.org_is_frozen(orgB)` is false (plan AC 5)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5608 writable`, `C5608 not frozen`)

### S2 - A frozen owner can still see Billing and renew · 1 migration, 1 test file · ~8k

**C5609** - Frozen, as uA: `select` on `org_billing` returns 1 row; `select` on `invitations` returns the org's pending invitation; `list_invitations()` returns it; `org_usage()` returns a document whose `plan` is `starter`; the `logos` select policy returns an object of org A. As uE and uV (non-owners) the `org_billing` select returns 0 rows (plan AC 6, 7)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5609 <read>`)

**C5610** - The read set is exactly the five named objects: the objects whose definition mentions `has_org_role_any_state` are `org_billing_select`, `invitations_select`, `logos_select`, `list_invitations` and `org_usage`, and nothing else (denominator 5), so a new object defaults to frozen (Landing door 2)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5610 policies`, `C5610 functions`)

**C5611** - Inserting a `checkout.session.completed` event with `metadata.sa_renew_org` = org A and org A's customer id into `private.stripe_events` while A is `canceled` sets `org_billing.status` to `active`, and then uA's customer update changes 1 row (plan AC 8)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5611 status`, `C5611 write after renewal`)

**C5612** - With billing rows for A (`active`) and B (`active`), a `customer.subscription.deleted` event for B's subscription makes B refuse uB's customer update and leaves uA's update changing 1 row (plan AC 9)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5612 B refused`, `C5612 A writable`)

### S3 - The same set of statuses everywhere · 2 files · ~6 KB · ~3k

**C5613** - For each of the 8 Stripe statuses `active`, `trialing`, `past_due`, `incomplete`, `paused`, `canceled`, `unpaid`, `incomplete_expired`, `private.org_is_frozen(orgA)` and, called as uA, `public.my_org_frozen()` are true exactly for `canceled`, `unpaid`, `incomplete_expired` (plan AC 10)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5613 org_is_frozen <status>`, `C5613 my_org_frozen <status>`)

**C5614** - `isEnded` is true for exactly `canceled`, `unpaid`, `incomplete_expired` over the same 8 statuses, and `ENDED_STATUSES` has those 3 members (plan AC 10)
Proof: `cd web && npx vitest run domain/billing/overview.test.ts -t "freeze status set"`

**C5615** - A status Stripe may add later (`something_new`) leaves org A writable: `org_is_frozen(orgA)` is false and `isEnded("something_new")` is false (plan AC 11)
Proof: `cd web && npm run test:db db_freeze` (assertion `C5615 unknown status`) and `cd web && npx vitest run domain/billing/overview.test.ts -t "unknown status"`

**C5616** - Landing door 1 and 2 literals: `private.org_is_frozen(uuid)` and `private.has_org_role_any_state(uuid, text[])` are `security definer`, `stable`, with `search_path=""`; `anon` cannot execute either (`42501`), `authenticated` can (they run inside policies the caller evaluates); `private.has_org_role(uuid, text[])` keeps its signature (door 1)
Proof: `cd web && npm run test:db db_freeze` (assertions `C5616 <function> <property>`)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| roles asked of the gate (4) | owner C5601 · admin C5601 · estimator C5601 · viewer C5601 | - |
| tenant tables inserted into (13) | org_settings C5602 · customers C5602 · contacts C5602 · sites C5602 · asset_types C5602 · asset_type_tasks C5602 · assets C5602 · agreements C5602 · agreement_versions C5602 · service_lines C5602 · events C5602 · import_jobs C5602 · import_rows C5602 | - |
| tables with a `has_org_role` write policy (16) | agreement_versions n/a - no member update or delete path, the freeze adds nothing · contracts n/a - same · events n/a - same · agreements C5603 · asset_type_tasks C5603 · asset_types C5603 · assets C5603 · contacts C5603 · customers C5603 · import_jobs C5603 · import_rows C5603 · org_settings C5603 · orgs C5603 · service_line_asset_types C5603 · service_lines C5603 · sites C5603 (table-driven; the test asserts all 13 are exercised) | - |
| storage buckets with write policies (2) | imports C5606 · logos C5606 | - |
| public write functions that gate on `has_org_role` (30) | add_catalog_draft C5605 · add_catalog_types C5605 · apply_agreement_transition C5605 · apply_contract_transition C5605 · archive_agreement_template C5605 · begin_signature_request C5605 · commit_import C5605 · complete_signature_request C5605 · contractor_signing_source C5605 · create_agreement C5604 · create_contract C5605 · create_invitation C5604 · create_task_library_type C5605 · customer_signing_link C5605 · fail_signature_request C5605 · import_allowance C5605 · record_extraction_chunk C5605 · reissue_portal_link C5605 · revoke_invitation C5605 · save_agreement_template C5605 · save_agreement_term C5605 · save_contract_template C5604 · save_service_line C5604 · save_task_library_type C5605 · save_version_note C5605 · set_asset_active C5605 · set_customer_active C5605 · set_member_role C5604 · set_org_plan C5604 · set_site_active C5605 | - |
| private helpers that gate on `has_org_role` (7) | assert_agreement_capacity C5605 · asset_types_code_frozen C5605 · freeze_agreement_version C5605 · issue_portal_link C5605 · library_type_for_write C5605 · pin_system_agreement_template C5605 · stamp_valid_until C5605 (same loop as the 30 public names; 37 in all) | - |
| read set kept open (5) | org_billing_select C5609 · invitations_select C5609 · logos_select C5609 · list_invitations C5609 · org_usage C5609; exactness C5610 | - |
| Stripe statuses (8) | active C5613 · trialing C5613 · past_due C5613 · incomplete C5613 · paused C5613 · canceled C5613 · unpaid C5613 · incomplete_expired C5613; TS side C5614 | - |
| status outside the set (1) | something_new C5615 | - |
| Stripe event types that move the status (3) | subscription.deleted C5612 · checkout.session.completed with `sa_renew_org` C5611 · subscription.updated to an ended status C5613 (status set through the table) | - |
| Landing doors (2) | door 1 C5601 · C5616 · door 2 C5609 · C5610 · C5616 | - |
| roles reading `org_billing` while frozen (3) | owner C5609 · estimator C5609 · viewer C5609 | - |

- 39 objects in `public` and `private` mention `has_org_role` on the hosted project today: 32 public (30 writes, 2 reads) and 7 private. C5605 loops the 37 writes and the test asserts that the count of functions mentioning `has_org_role` equals 39, so a function added later fails the test until it is classified.
- Claims naming an error code: C5602 and C5604 (`42501`), C5616 (`42501` for `anon`); each has a proof that crosses the boundary as the real role.
- C5604 proves 6 of the functions end to end; the other functions are proven only to share the gate (C5601 + C5605). That is a level gap stated, not hidden: a function that calls `has_org_role` inside a branch that is skipped would pass C5605.

## Test policy

Existing house pattern answers both questions for SQL: `supabase/tests/rls_roles.sql` proves policy decisions table-driven over `tests.tenant_tables()`, one assertion per member. The TS side is instrumentation plus one set check. No rows to add to the guidelines.

## Swept

- validation: C5613, C5615 (status set; unknown status stays writable)
- failure modes: C5604, C5605 (a refused write raises `42501` and changes nothing)
- idempotency: n/a - a replayed `customer.subscription.updated` or renewal event is already ignored by `status_event_at` ordering (existing, `20261113130000`); this change adds no writer
- authorization: C5601, C5609 (who is refused; who can still read billing)
- concurrency: n/a - the check is one statement-level lookup; a renewal landing mid-transaction is decided by the statement that reads `org_billing`, and the trigger already guards event order with `status_event_at` (existing)
- data lifecycle: C5611 (thaw on renewal), C5608 (no billing row, never frozen)
- dependency failure: n/a - no external call; the lookup is a primary-key read on `org_billing`
- state transitions: C5611, C5612 (active -> canceled -> active moves the gate)
- observability: n/a - refusals surface as the existing `forbidden` mapping and the frozen banner; no logging requirement in this change

## Handoff

- S1 = ~8k: one migration (`has_org_role` body, `org_is_frozen`, `has_org_role_any_state`, `my_org_frozen`, five read paths re-pointed) and one new test file, ~6 files, ~60 KB touched; S2 and S3 add tests to the same file plus one vitest block. Total ~25k, under the 150k budget - one builder
- Mechanism: one builder
