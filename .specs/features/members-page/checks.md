# Members page checks

Profile: light
Plan: `.specs/features/members-page/plan.md`

55 checks in 5 slices plus delivery · 4 one-way doors · 1 open, 1 blocks go-live (the dashboard configuration, plan Open question 1)

## How proofs run

- **vitest** runs from `web/`. Every test name starts with its check id and a colon (`C1497:`). This feature numbers from
  C1497, because activity-timeline owns up to `C1496:`.
  - Domain tests sit beside the code: `domain/members/index.test.ts`.
  - The use case is `application/use-cases/invite-member.test.ts`, with fakes for its two ports.
  - Adapters are tested in `infrastructure/supabase/members.test.ts` with the recording `stubClient` (`client.rpc` is its
    mock).
  - Components are asserted with `renderToStaticMarkup` in `components/members/members.test.ts`; a stateful control is
    imported itself, not only its presentational child (L-014).
  - Pages and Server Actions are `app/(app)/members.test.ts`, mocking `@/composition` as `task-library.test.ts` does.
- **sql** means `npm run test:db members` in `web/`. The recipe `members` (fixture.sql then `supabase/tests/members.sql`)
  is added to `RECIPES`; each assertion is labelled with its check id (`tests.ok('C1497 ...')`). Where a check names a
  hint as well as a SQLSTATE, the test reads the hint, because `tests.expect_error` compares the SQLSTATE only (L-025,
  L-030). `rls_roles` is the existing recipe.
- **live** means an author-side Playwright run in one signed-in context (memory: playwright-single-context) at 375, 768
  and 1440 px, recorded in the Handoff.
- The migration is applied to project `gnxebrtcpbujhvcamtoe` before the `sql` proofs can run (AD-006, AD-026: the suite
  runs against that project inside rolled-back transactions). That is a change to a remote database, so it is owed an
  explicit go-ahead at the moment the build reaches it (Handoff).

Terms:
- "a manager" is an owner or an admin; "a live invitation" is one with `accepted_at` null and `expires_at` in the future.
- "the seven functions" are `list_members`, `list_invitations`, `create_invitation`, `revoke_invitation`,
  `set_member_role`, `remove_member` and `accept_invitations` (plan Landing 3 and 4).
- Rule order inside `set_member_role` and `remove_member`: caller not a manager (`42501`), target not in the caller's org
  (`P0002`), an admin touching an owner or granting Owner (`owner_only`), a change that would remove the org's only owner
  (`last_owner`), the caller's own row (`self`). This refines plan AC 27 and AC 29 and is not a new capability: it is what
  makes `last_owner` reachable, because a sole owner acting on themself would otherwise always read `self`, and no other
  caller can touch an owner at all. For a sole owner acting on themself the answer is `last_owner`; for anyone else
  acting on themself it is `self`.
- The check that the Server Actions "refuse before any write" follows AD-029; the database refuses again (AD-004).

## Checks

### S1 - read who is in the org · 9 files · ~110 KB · ~28k

**C1497** - `list_members()` returns exactly the caller's org members, one row each with `user_id`, `email` (from
`auth.users`), `role` and `joined_at`, ordered owner, admin, estimator, viewer and then by email, for a caller of each of
the four roles; a caller in no org gets zero rows and another org's members never appear (AC 1, 5)
Proof: `npm run test:db members` (assertions labelled `C1497`)

**C1498** - `list_invitations()` returns the caller's org invitations that are not accepted, expired ones included, newest
`created_at` first, to an owner and an admin; to an estimator and a viewer it raises `42501`; another org's invitations
never appear (AC 3, 5)
Proof: `npm run test:db members` (assertions labelled `C1498`)

**C1499** - `MemberRoster.members()` maps each `list_members` row to `{ userId, email, role, joinedAt: Date }` in the order
read, `invitations()` maps each `list_invitations` row to `{ id, email, role, invitedAt: Date, expiresAt: Date }`, both
call the rpc once with `.limit(500)`, and an unexpected database error makes either reject (AC 1, 3, 35)
Proof: `npx vitest run infrastructure/supabase/members.test.ts -t "C1499:"` in `web/`

**C1500** - The roster renders one row per member with the email, the role label (Owner, Admin, Estimator, Viewer) and the
joined date, in the order given, and marks "You" on the row whose `userId` is the signed-in member's and on no other
(AC 1, 2)
Proof: `npx vitest run components/members/members.test.ts -t "C1500:"` in `web/`

**C1501** - The pending list renders, for each invitation, the email, the role label, the invited date and "Expires
<date>" while `expiresAt` is after now or "Expired" when it is now or earlier, dates as a medium date in America/Vancouver,
in the order given (AC 3)
Proof: `npx vitest run domain/members/index.test.ts -t "C1501:"` and
`npx vitest run components/members/members.test.ts -t "C1501:"` in `web/`

**C1502** - For a manager with no invitation the pending list is replaced by "No pending invitations." (AC 4)
Proof: `npx vitest run components/members/members.test.ts -t "C1502:"` in `web/`

**C1503** - For an estimator and for a viewer, each rendered on its own, the page shows the roster and none of: the
Pending invitations list, the invite form, a role control, a Remove control (AC 5)
Proof: `npx vitest run components/members/members.test.ts -t "C1503:"` in `web/` (table-driven over the 2 roles)

**C1504** - The footer navigation lists "Members" linking to `/members`, after Settings, and it is the current item on
`/members` and not on `/settings`, `/pipeline` or `/task-library` (AC 6)
Proof: `npx vitest run components/shell/nav-items.test.ts -t "C1504:"` in `web/`

**C1505** - `GET /members`: a signed-out request redirects to `/login`; an owner or admin gets the roster and the
invitations; an estimator or viewer gets the roster and the invitations reader is never called; the page never calls
`notFound()` (AC 1, 3, 5, 36; Surface `200`, redirect, no `404`)
Proof: `npx vitest run "app/(app)/members.test.ts" -t "C1505:"` in `web/`

### S2 - invite someone · 10 files · ~150 KB · ~32k

**C1506** - `validateInvitation` returns the email trimmed and lowercased with the role for `  Pat@Example.COM ` and each of
the four roles; rejects an empty string, a string with no `@`, `a@b`, `a b@c.d`, and a 255-character address, and accepts
a 254-character one; rejects a role outside the four; the form's default role constant is `viewer` (AC 7, 8, 17)
Proof: `npx vitest run domain/members/index.test.ts -t "C1506:"` in `web/`

**C1507** - `create_invitation('Pat@Example.com', 'estimator')` by an owner stores one row with `email` `pat@example.com`,
`role` `estimator`, `invited_by` the caller, `accepted_at` null and `expires_at` exactly `now() + interval '14 days'`, and
returns that row's id (AC 7)
Proof: `npm run test:db members` (assertions labelled `C1507`)

**C1508** - `create_invitation` with an address of 255 characters, one with no `@`, and an empty string raises `23514` with
hint `invalid_email` and stores nothing (AC 8)
Proof: `npm run test:db members` (assertions labelled `C1508`, SQLSTATE and hint)

**C1509** - `create_invitation` for the address of a current member of the caller's org, written in other case, raises
`23505` with hint `already_member` and stores nothing; for an address that is a member of another org only, it stores the
invitation (AC 9)
Proof: `npm run test:db members` (assertions labelled `C1509`, SQLSTATE and hint)

**C1510** - A second `create_invitation` for the same address in the same org, with another role and after
`expires_at` was set to yesterday, leaves exactly one row for `(org, email)` carrying the new role and `expires_at` of
`now() + interval '14 days'`, and returns the same id (AC 10)
Proof: `npm run test:db members` (assertions labelled `C1510`)

**C1511** - `create_invitation(..., 'owner')` by an admin raises `55000` with hint `owner_only` and stores nothing; by an
owner it stores the invitation; an admin inviting admin, estimator and viewer stores each (AC 11)
Proof: `npm run test:db members` (assertions labelled `C1511`, SQLSTATE and hint)

**C1512** - Each of the seven functions raises `42501` for an estimator and for a viewer where plan Landing 4 says a manager
is required (all except `list_members` and `accept_invitations`), changing nothing; and `anon` has no execute privilege on
any of the seven, nor `authenticated` on the hook function (`has_function_privilege` is false) (AC 16)
Proof: `npm run test:db members` (assertions labelled `C1512`)

**C1513** - `revoke_invitation(id)` by a manager deletes that pending invitation and no other; an id of another org, an id
that does not exist, and the id of an accepted invitation each raise `P0002` and delete nothing (AC 15)
Proof: `npm run test:db members` (assertions labelled `C1513`)

**C1514** - `inviteMember` (the use case) answers `invalid` for a bad address or role without calling the admin port or the
sender; calls the admin port with the normalised email; on `already_member`, `owner_only`, `forbidden` and `unavailable`
returns that state and does not call the sender; on success sends the link to the normalised email and answers `sent`;
a sender `rate_limited` gives `rate_limited` and any other sender failure gives `saved_not_sent` (AC 7, 8, 9, 11, 12, 13,
16, 35)
Proof: `npx vitest run application/use-cases/invite-member.test.ts -t "C1514:"` in `web/` (table-driven over the 8 states)

**C1515** - Each pending row, an expired one included, renders a Resend form that submits that row's email and role to the
invite action, and a Revoke form that submits its id to the revoke action; both controls are at least 44 px high on
mobile (`min-h-11`) (AC 14, 15, 37)
Proof: `npx vitest run components/members/members.test.ts -t "C1515:"` in `web/`

**C1516** - `InvitationLinkSender.send(email)` calls `signInWithOtp` once on the client it was built with, with
`{ email, options: { shouldCreateUser: true } }`, and answers `{ ok: true }`; status 429 answers `rate_limited`; any other
error or a thrown error answers `unavailable` and logs the cause (AC 12, 13)
Proof: `npx vitest run infrastructure/supabase/members.test.ts -t "C1516:"` in `web/`

**C1517** - The container builds the sender from its own client created with `persistSession: false` and
`autoRefreshToken: false` and the publishable key, and the login gateway still uses the cookie-bound client, so inviting
sets no cookie on the inviter's response (Flow hop 4)
Proof: `npx vitest run composition/composition.test.ts -t "C1517:"` in `web/`

**C1518** - Each of the four actions (`inviteMember`, `revokeInvitation`, `setMemberRole`, `removeMember`): a signed-out
caller is redirected to `/login`; an estimator or viewer gets `forbidden` and the use case or store is never called; the
org id passed on comes from the signed-in member, never from a form field named `orgId`; each state in the plan's Surface
list for that action is returned as the body of the action when the store or use case answers it (AC 16, 35; Surface
`200` for the four actions)
Proof: `npx vitest run "app/(app)/members.test.ts" -t "C1518:"` in `web/` (table-driven over the 4 actions and their 8 +
4 + 7 + 7 states)

**C1519** - The invite form offers the four roles with Viewer selected, and renders for each state of `inviteMember` its
message: `sent` "Invitation sent to <email>", `invalid` "Enter a valid email address.", `already_member` "<email> is
already a member.", `owner_only` "Only an owner can invite an owner.", `rate_limited` "Too many emails were sent. Try
again in a minute.", `saved_not_sent` "The invitation was saved, but the email could not be sent. Use Resend.", and for
`forbidden` and `unavailable` a message of their own, `unavailable` reading "Could not save. Try again." (AC 7, 8, 9, 11,
12, 13, 17, 35)
Proof: `npx vitest run components/members/members.test.ts -t "C1519:"` in `web/` (table-driven over the 8 states)

### S3 - accept by signing in · 9 files · ~100 KB · ~24k

**C1520** - `accept_invitations()` called by a user with no membership whose `auth.users` email equals, ignoring case, a
live invitation's email, inserts one membership of that org with the invited role, sets that invitation's `accepted_at`
and `accepted_by` (the caller), and returns 1 (AC 18)
Proof: `npm run test:db members` (assertions labelled `C1520`)

**C1521** - With live invitations for the address from two orgs, created at different times, `accept_invitations()` accepts
only the earliest-created: one membership, the other invitation still has `accepted_at` null (AC 19)
Proof: `npm run test:db members` (assertions labelled `C1521`)

**C1522** - For a caller who already has a membership in any org, `accept_invitations()` returns 0, adds no membership and
leaves the live invitation with `accepted_at` null (AC 20)
Proof: `npm run test:db members` (assertions labelled `C1522`)

**C1523** - For a caller whose only invitation has `expires_at` in the past, or was revoked, `accept_invitations()` returns
0 and adds no membership (AC 21)
Proof: `npm run test:db members` (assertions labelled `C1523`)

**C1524** - Calling `accept_invitations()` a second time as the same caller returns 0 and leaves exactly one membership
(AC 22)
Proof: `npm run test:db members` (assertions labelled `C1524`)

**C1525** - `private.hook_before_user_created(event)` returns `{}` for an event whose `user.email` matches a live invitation
ignoring case; and returns `{"error": {"http_code": 403, "message": "Sign-ups are by invitation."}}` for an address with no
invitation, one whose invitation is expired, and one whose invitation was accepted (AC 23)
Proof: `npm run test:db members` (assertions labelled `C1525`) (table-driven over the 4 cases)

**C1526** - Only `supabase_auth_admin` can execute the hook function, with usage on schema `private`, and a call by the
hook's role reads `invitations` through the function and not by a grant on the table (AC 23)
Proof: `npm run test:db members` (assertions labelled `C1526`)

**C1527** - `GET /auth/confirm` with a valid link calls `acceptInvitations` once after the verification and then redirects
to `/pipeline`; with a refused link or invalid parameters it does not call it and redirects to `/login`; when
`acceptInvitations` fails or throws it still redirects to `/pipeline` (AC 18, 21)
Proof: `npx vitest run app/auth/confirm/route.test.ts -t "C1527:"` in `web/`

**C1528** - `acceptInvitations` (the adapter) calls the rpc `accept_invitations` once with no arguments and returns the
number it answers; an rpc error is logged and answers 0, never a throw (AC 18, 22)
Proof: `npx vitest run infrastructure/supabase/members.test.ts -t "C1528:"` in `web/`

**C1529** - The sign-in page's gateway still asks for a link with `shouldCreateUser: false` and an unknown address still
answers `{ ok: true }` (AC 24; existing proofs)
Proof: `npx vitest run infrastructure/supabase/auth.test.ts -t "C1:"` and
`npx vitest run infrastructure/supabase/auth.test.ts -t "C3:"` in `web/`

**C1530** - A signed-in user with no membership sees "No workspace yet" and no navigation, which is what an expired or
revoked invitation leaves (AC 21; existing proof)
Proof: `npx vitest run "app/(app)/layout.test.ts" -t "C19:"` in `web/`

**C1531** - `invitations` refuses, as the table owner: a role outside the four (`23514`), an `email` with an upper-case
letter or longer than 254 (`23514`), `accepted_at` without `accepted_by` and the reverse (`23514`), a second row with
`accepted_at` null for the same `(org, email)` (`23505`), and an `org_id` that names no org (`23503`); deleting the org deletes its invitations; and it accepts a new
live row for an address whose earlier invitation was accepted (plan Landing 1, AD-003)
Proof: `npm run test:db members` (assertions labelled `C1531`)

### S4 - change roles and remove members · 9 files · ~110 KB · ~26k

**C1532** - `set_member_role(user, role)` by an owner or an admin on another non-owner member stores the role; the same role
again succeeds and changes nothing; `list_members()` then shows it (AC 25)
Proof: `npm run test:db members` (assertions labelled `C1532`)

**C1533** - By an admin, `set_member_role` to `owner`, `set_member_role` on an owner, and `remove_member` of an owner each
raise `55000` with hint `owner_only` and change nothing; by an owner, promoting a member to owner and demoting another
owner succeed (AC 26)
Proof: `npm run test:db members` (assertions labelled `C1533`, SQLSTATE and hint)

**C1534** - When the caller is the org's only owner, `set_member_role(self, 'admin')` and `remove_member(self)` raise `55000`
with hint `last_owner` and change nothing (AC 27, plan Terms rule order)
Proof: `npm run test:db members` (assertions labelled `C1534`, SQLSTATE and hint)

**C1535** - When the caller acts on their own row and is not the only owner (an admin; an owner of an org with a second
owner), `set_member_role` and `remove_member` raise `55000` with hint `self` and change nothing (AC 29)
Proof: `npm run test:db members` (assertions labelled `C1535`, SQLSTATE and hint)

**C1536** - After `remove_member(user)` by a manager, that user's membership row is gone, and `select count(*) from
public.customers` as that user returns 0 where it returned the org's count before (AC 30)
Proof: `npm run test:db members` (assertions labelled `C1536`)

**C1537** - After `remove_member(user)`, every `agreement_versions.created_by` and `events.actor_id` that named that user
still names them, and the count of such rows is unchanged (AC 31)
Proof: `npm run test:db members` (assertions labelled `C1537`)

**C1538** - `set_member_role` and `remove_member` for a user who is not a member of the caller's org, whether a member of
another org or an unknown uuid, raise `P0002` and leave the other org's membership untouched (AC 33)
Proof: `npm run test:db members` (assertions labelled `C1538`)

**C1539** - Both write functions take `pg_advisory_xact_lock(hashtext('members:' || org))` before reading roles (an advisory
lock for that key is held by the session once the function returns, read from `pg_locks`), and after one owner demotes the
other, the demoted one's attempt to demote the first raises `55000` with hint `owner_only`, so the org keeps its owner
(AC 28; the proof is lock presence and the serialised state, not two simultaneous connections, which the one-connection
runner cannot open)
Proof: `npm run test:db members` (assertions labelled `C1539`)

**C1540** - As an owner, an admin, an estimator and a viewer, a direct `insert`, `update` and `delete` on
`public.memberships` and on `public.invitations` each raise `42501`; every member still selects the `memberships` rows of
their org and no other; an owner and an admin select their org's `invitations` and an estimator and a viewer select none
(plan Landing 1 and 4)
Proof: `npm run test:db members` (assertions labelled `C1540`)

**C1541** - `rls_roles.sql` asserts the new behaviour where it asserted the old: C14's viewer `memberships` update and
delete, and C12's loop over the tenant tables for `memberships`, now expect `42501` instead of 0 rows, and C15's owner
`memberships` insert expects `42501` instead of 1 row; every other assertion of the file is unchanged. `rls_isolation.sql`
C35 lists `invitations` among the public tables (21) (plan Impact; C12 and C35 were found while building, see Handoff)
Proof: `npm run test:db rls_roles` and `npm run test:db rls_isolation` in `web/`

**C1542** - `MemberAdmin` calls the rpc named for each operation (`create_invitation`, `revoke_invitation`,
`set_member_role`, `remove_member`) with the `p_` arguments, never a table write, and maps `23505` hint `already_member`,
`23514` hint `invalid_email`, `55000` hint `owner_only`, `last_owner` and `self`, `42501` and `P0002` to the states
`already_member`, `invalid`, `owner_only`, `last_owner`, `self`, `forbidden` and `not_found`; a `55000` with another hint, a
`23505` with another hint and any other code answer `unavailable` and are logged (AC 9, 11, 16, 26, 27, 29, 33, 35)
Proof: `npx vitest run infrastructure/supabase/members.test.ts -t "C1542:"` in `web/` (table-driven over the 7 mapped
codes and 3 unmapped ones)

**C1543** - The roster renders no role control and no Remove on the signed-in member's own row; on other rows a manager
sees a role control offering the four roles with the current one selected; each state of `setMemberRole` and
`removeMember` renders a message of its own, `not_found` reading "That member was already removed." and `unavailable`
"Could not save. Try again." (AC 25, 29, 33, 35)
Proof: `npx vitest run components/members/members.test.ts -t "C1543:"` in `web/` (table-driven over the 7 + 7 states)

**C1544** - Pressing Remove shows a prompt naming the member's email and saying they lose access to the org immediately,
with Confirm and Cancel; the remove action is not called until Confirm, and Cancel returns to the row without calling it
(AC 32)
Proof: `npx vitest run components/members/members.test.ts -t "C1544:"` in `web/` (imports the stateful remove control)

### S5 - states and access · 3 files · ~30 KB · ~8k

**C1545** - `/members` has a `loading.tsx` that renders a skeleton titled Members, matching the other app pages (AC 34)
Proof: `npx vitest run "app/(app)/screens.test.ts" -t "C1545:"` in `web/`

**C1546** - When a roster read rejects, the page component rejects (so the existing error boundary shows) and renders no
partial list (AC 35)
Proof: `npx vitest run "app/(app)/members.test.ts" -t "C1546:"` in `web/`

**C1547** - At 375 px the Members page, with a 60-character email and a 250-character email in the roster, has no horizontal
page scroll (`scrollWidth <= clientWidth`), stacks each row's controls under its email, and every control measures at
least 44 px high (AC 37)
Proof: live (Playwright at 375 px, touch-emulated, one signed-in context), result in the Handoff

### Delivery - regressions and the live runs

**C1548** - Live, as the demo owner, once the dashboard configuration of Open question 1 is done and the user has named
the address to invite: inviting that address sends the email through Resend, opening its link lands in the org with the
invited role, and an address that was never invited is refused by the Auth API with HTTP 403 "Sign-ups are by invitation."
(AC 7, 18, 23)
Proof: live (one signed-in context for the owner; the invitee in a second step after sign-out), result in the Handoff

**C1549** - Live, as the demo owner at 1440, 768 and 375 px: the roster shows the owner with "You", a role can be changed
and a member removed after Cancel and Confirm, an invitation can be revoked, with no console error or warning and no
failed request (a failed request is a 4xx, a 5xx or a network error; `net::ERR_ABORTED` after a 200 is a dropped Server
Action stream, L-008) (AC 1, 2, 15, 25, 30, 32)
Proof: live (Playwright, touch emulation at 768 and 375 px, one signed-in context), result in the Handoff

**C1550** - `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` and `npm run test:db` all exit 0 on `HEAD`
(every AC)
Proof: those commands in `web/`, results in the Handoff

**C1551** - After the migration, the Supabase security advisors list the seven new functions as
`authenticated_security_definer_function_executable` findings and no other new finding: nothing new for `anon`, nothing
for the hook function, `invitations` has RLS enabled (plan Landing 3 and 4; AD-068 accepts this class of finding)
Proof: `get_advisors` (security) on `gnxebrtcpbujhvcamtoe` before and after, difference in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| roles (4) | owner C1497 · admin C1497 · estimator C1497 · viewer C1497 | - |
| `list_members` / `list_invitations` callers (8) | list_members owner C1497 · list_members admin C1497 · list_members estimator C1497 · list_members viewer C1497 · list_invitations owner C1498 · list_invitations admin C1498 · list_invitations estimator C1498 · list_invitations viewer C1498 | - |
| `inviteMember` states (8) | sent C1514 · invalid C1514 · already_member C1514 · owner_only C1514 · rate_limited C1514 · saved_not_sent C1514 · forbidden C1514 · unavailable C1514 | - |
| `inviteMember` messages (8) | sent C1519 · invalid C1519 · already_member C1519 · owner_only C1519 · rate_limited C1519 · saved_not_sent C1519 · forbidden C1519 · unavailable C1519 | - |
| `revokeInvitation` states (4) | revoked C1518 · not_found C1518 · forbidden C1518 · unavailable C1518 | - |
| `setMemberRole` states (7) | saved C1518 · owner_only C1518 · last_owner C1518 · self C1518 · not_found C1518 · forbidden C1518 · unavailable C1518 | - |
| `removeMember` states (7) | removed C1518 · owner_only C1518 · last_owner C1518 · self C1518 · not_found C1518 · forbidden C1518 · unavailable C1518 | - |
| `setMemberRole` and `removeMember` messages (14) | set saved C1543 · set owner_only C1543 · set last_owner C1543 · set self C1543 · set not_found C1543 · set forbidden C1543 · set unavailable C1543 · remove removed C1543 · remove owner_only C1543 · remove last_owner C1543 · remove self C1543 · remove not_found C1543 · remove forbidden C1543 · remove unavailable C1543 | - |
| database refusals mapped to states (10) | `23505` already_member C1542 · `23514` invalid_email C1542 · `55000` owner_only C1542 · `55000` last_owner C1542 · `55000` self C1542 · `42501` C1542 · `P0002` C1542 · `55000` other hint C1542 · `23505` other hint C1542 · other code C1542 | - |
| refusal rules (5) | `42501` C1512 · `P0002` C1538 · `owner_only` C1533 · `last_owner` C1534 · `self` C1535 | - |
| the seven functions (7) | list_members C1497 · list_invitations C1498 · create_invitation C1507 · revoke_invitation C1513 · set_member_role C1532 · remove_member C1536 · accept_invitations C1520 | - |
| `GET /members` statuses (3) | 200 C1505 · redirect to /login C1505 · no 404 C1505 | - |
| `GET /auth/confirm` outcomes (3) | accept then /pipeline C1527 · refused link to /login C1527 · accept failure still /pipeline C1527 | - |
| `create_invitation` outcomes (6) | stored C1507 · invalid_email C1508 · already_member C1509 · refreshed C1510 · owner_only C1511 · forbidden C1512 | - |
| `accept_invitations` cases (6) | accepted C1520 · earliest of two C1521 · already a member C1522 · expired or revoked C1523 · repeated C1524 · no invitation at all C1523 | - |
| hook cases (4) | live, any case C1525 · none C1525 · expired C1525 · accepted C1525 | - |
| landing doors (4) | 1 invitations C1531, C1540 · 2 hook C1525, C1526 · 3 accepting C1520-C1524 · 4 writers C1532-C1539, C1541 | - |
| entities in Relations (3) | memberships C1540 · invitations C1531 · invited_by and accepted_by references C1531 | - |
| `invitations` constraints (6) | role check C1531 · lower-case email C1531 · email length C1531 · accepted pair C1531 · one live per address C1531 · org reference with cascade C1531 | - |
| direct write surface (6) | memberships insert C1540 · memberships update C1540 · memberships delete C1540 · invitations insert C1540 · invitations update C1540 · invitations delete C1540 | - |
| invite form roles (4) | owner C1519 · admin C1519 · estimator C1519 · viewer C1519 | - |
| plan `Observable` rows with a check (9) | empty C1502 · loading C1545 · error C1546 · unauthorised C1503, C1505 · ordering C1497, C1498 · destructive confirm C1544 · mobile C1547 · action errors C1514, C1518 · accept step C1527 · hook rejection C1525 | - |
| startup configuration: cookie-less sender client (2 assemblies) | `getContainer` C1517 · the test harness stub C1516 | - |

- Observable rows with no check of their own: versioning and rate limits (n/a in the plan: same-origin form actions; the only
  throttle is Supabase's email limit, C1516); revoke needs no confirmation (the plan's reason: reversible by inviting again)
- Claims naming a status code, route or response shape: C1505, C1518, C1527, C1525 - each has a proof that crosses the
  boundary it names (the page, the action, the route, the hook function)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C1506 (address and role), C1508 (the database refuses a bad address), C1531 (table constraints); the form
  fields are read as `FormData` strings in C1518
- failure modes: C1514 (a failed send keeps the invitation), C1527 (a failed accept does not break sign-in), C1528, C1546;
  the migration is one transaction, so an invitation and its rule cannot half-apply
- idempotency: C1510 (the same address twice is one row), C1524 (accept twice), C1532 (the same role twice); a Resend is
  C1510 again
- authorization: C1512, C1533, C1540, C1518 (the action refuses before any write, AD-029); existing - `is_org_member` and
  `has_org_role` (AD-004) decide inside every function
- concurrency: C1539 (lock presence and serialised state; the two-connection race itself is not exercised by the
  one-connection runner, a stated level gap)
- data lifecycle: C1537 (a removed member's records stay), C1523 (an expired invitation stays a row and is refused),
  C1501 (it shows as Expired and can be resent), C1531 (an accepted address can be invited again); no clean-up job, as
  the plan's Assumptions say
- dependency failure: C1516 (the link request fails or is rate limited), C1527 (the accept call fails), C1542 (a database
  error is `unavailable`), C1526 (the hook cannot read the table by grant)
- state transitions: C1532-C1535 (role changes and removal and the rules between them), C1520-C1524 (invitation pending
  to accepted)
- observability: C1516, C1528 and C1542 each log the failure they map to `unavailable` (the repo's `console.error`
  convention, as `auth.ts` does); no metrics or tracing requirement in this change

## Out of scope

Carried by the plan: org switcher and several orgs per user, an audit log of role changes, custom invitation email text,
member names and avatars, self-service leave and an ownership-transfer wizard, bulk invite, SSO and domain auto-join, org
creation and seat limits.

## Handoff

- Read set, measured with `wc -c`: `application/ports/index.ts` (~36 KB), `composition/index.ts` (~10 KB), `auth.ts` and
  the task-library adapter, view, editor, state, page, actions and their tests as the pattern (~45 KB), `active-control.tsx`
  (~6 KB), `nav-items` and its test, `auth/confirm` route and test (~7 KB), `task_library.sql`, `rls_roles.sql`,
  `contact_roles.sql` and the contact-roles migration as SQL patterns (~34 KB), `runner.mts` (~5 KB). About 150 KB, ~38k
  tokens.
- Writes: one migration (~18 KB), `members.sql` (~45 KB), about 35 KB of source and 70 KB of tests, docs (~12 KB). About
  180 KB, ~45k tokens.
- Slice estimates in the headers: S1 ~28k, S2 ~32k, S3 ~24k, S4 ~26k, S5 ~8k, delivery ~10k; the reads are shared. About 100k
  against the 150k budget, so one builder; the cut, had one been needed, falls after S2 (the surface changes from the page
  to the sign-in path).
- Mechanism: one builder (under the budget, no ask)
- Owed an ask when reached: (1) applying the migration to `gnxebrtcpbujhvcamtoe` (a remote schema change; the `sql`
  proofs and the advisors check C1551 need it); (2) C1548 sends a real email through Resend and needs the address to invite
  and the dashboard configuration of plan Open question 1 (sign-ups on, the hook registered, the Confirm signup template
  link set). If the configuration is not done by the time the build ends, C1548 is reported unrun and the Verifier is told
  so; nothing else depends on it.
- Plan edits made while writing the checks: Flow hop 6 now says `/pipeline`, where `/auth/confirm` lands today.

- **Boundary:** C1497-C1546, C1550 and C1551 closed at the build commits `960937f` and `5c3bb57` (docs `6f04130`); verifier round 1 (`verification.md`) found three test-strength gaps (C1526, C1538, C1539, test-only), all closed after it.
- **Proof runs (2026-11-05):** `npm test` 2653 passed; `npm run lint`, `npx tsc --noEmit` and `npm run build` clean; `npm run test:db` 22 passed, 0 failed, against the project after the owner applied the migration in the SQL editor. Security advisors before and after: `anon` 5 and 5, `authenticated` 10 and 17, the seven new ones being exactly the seven public functions (C1551).
- **C1547 and C1549 (live, one signed-in context, `next start` on port 3210 from the new build, because the dev server on port 3000 was stale and failed on `/members` with `listMembers is not a function`):** as the demo owner (felipetiburcioviana, the only member, so no row controls were on screen). 1440 px: heading, invite form with Viewer selected, "You" and Owner on the one row, "No pending invitations.". 768 px: `scrollWidth 768 = clientWidth 768`, email field, role select and Send invitation all 44 px high; submitting `a@b` showed "Enter a valid email address." from the real Server Action and wrote nothing. 375 px: `375 = 375`, still `375 = 375` with the row email replaced in the DOM by a 252-character string (its right edge at 342), controls 44 px, console 0 errors and 0 warnings, no failed request. **Not seen live:** a role change, a Remove with Cancel and Confirm, Resend and Revoke (they need a second member or a pending invitation, and creating either sends mail or makes a login), touch emulation proper (the single context was not re-created with `hasTouch`; the controls were clicked with the pointer and measured at 44 px).
- **C1548 (invite email, hook):** not run. It needs the dashboard settings of plan Open question 1 and an address to invite.
- **Settled mid-build:** (1) `rls_roles` C12 and `rls_isolation` C35 also changed, besides C14 and C15 (check C1541 and the plan Impact were amended). (2) For a sole owner acting on themself the answer is `last_owner`, not `self` (Terms). (3) `database.types.ts` was hand-edited first and matches the generated file in content. (4) My first live attempt used a bare `form button[type=submit]` selector and clicked Sign out; the session was restored by a new sign-in link.
- **Abandoned:** an `rpc(...).limit(500)` through the stub client (it has no chainable rpc), so the adapter test carries its own chained rpc double.
- **C1548 attempt (2026-11-05, 23:09 UTC, demo owner, `next start` on port 3210):** invited `felipetiburcioviana+invite1@gmail.com` as Viewer. Proven live: the invitation was stored (Invited Nov 4, 2026, Expires Nov 18, 2026, Viewer, Resend and Revoke shown), and the Before User Created hook let the signup through (the Auth log has `user_confirmation_requested` for that address, so sign-ups are on and the hook is registered). **Not proven:** the email. Auth answered 500 `unexpected_failure`, `gomail: could not send email 1: 550 "You can only send testing emails to your own email address (felipetiburcioviana@gmail.com)... verify a domain at resend.com/domains, and change the from address"`. The page showed the designed "The invitation was saved, but the email could not be sent. Use Resend." state (AC 13). Open: set Supabase Auth's SMTP sender to an address on the verified domain, then press Resend on that row (the same call refreshes the invitation) and finish accept, role and remove. The invitation row and an unconfirmed login for that address are left in place for that retry; the hook's rejection of an uninvited address was not tried live.
- **C1548 second attempt (2026-11-05, 23:15 UTC):** after the owner moved Supabase Auth's SMTP sender to the verified domain, the invitation email for a second address went out (Auth `/otp` 200 at 23:15:16) and was opened (Auth `/verify` 303, `user_signedup`, `login` at 23:15:50). **The accept step did not run:** the invitation is still pending and `memberships` still holds one row. The Confirm signup email template still carries Supabase's default `/verify` link, so a first-time invitee never reaches `/auth/confirm`, which is where `accept_invitations` is called. Open (plan Open question 1, now confirmed): set the Confirm signup link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. That invitee's login now exists, so a sign-in link from `/login` (Magic link template) would complete the accept. The owner chose to skip this for now; C1548 and the role-change and remove checks (C1549) stay not run, and the Verifier's round 2 is not dispatched.

- **Live run after the Confirm signup template was set (2026-11-05, owner session on the dev server at port 3000, then production):** the invitee `marianereisviana@gmail.com` opened her sign-in link on production and the invitation was accepted at 17:30:27 UTC: `memberships` gained a Viewer row and the invitation shows `accepted_at` (C1548: invite, email, accept and role proven; the hook's 403 for an uninvited address was not run, the direct Auth call was denied by the permission layer). C1549 as the owner: Viewer -> Estimator showed "Role updated." and the database held `estimator`, then back to Viewer; Remove opened `Remove marianereisviana@gmail.com?` with Confirm remove and Cancel, and Cancel left the membership; console 0 errors and 0 warnings. **Not run:** Confirm remove (it would remove a real person's access), Resend and Revoke (no pending invitation exists, and sending one was denied by the permission layer), touch emulation.
- **Found live, fixed:** after Save role the row's label read the new role but the dropdown kept showing the old one until a reload (an uncontrolled select with a `defaultValue` and no key). `components/members/member-controls.tsx` now keys the select by the saved role; checked live (Viewer -> Estimator -> Viewer, dropdown following each save). No check named it; the static-markup tests cannot show a remount.
