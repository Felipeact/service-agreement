# Staff sign-in with a magic link, and the `proxy.ts` session refresh - checks

Profile: light
Plan: `.specs/features/auth-magic-link/plan.md`

31 checks in 7 slices · 5 one-way doors · 3 open, of which 2 block (live proofs only)

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1:`), so
  `-t "C1:"` matches that check alone. React output is asserted with `renderToStaticMarkup` from
  `react-dom/server`; Supabase is a stubbed client; `@/composition`, `next/navigation` and
  `next/headers` are mocked where a route, action or layout is called directly.
- **seed** - `seed supabase/tests/demo_owner.sql#C<n>` is one MCP `execute_sql` call: the text of
  `supabase/tests/fixture.sql`, then the block of `supabase/tests/demo_owner.sql` marked for that
  check, which runs the **body** of `supabase/seed.sql` (the file without its first line `begin;`
  and its last line `commit;`) where it says so. The file ends in `rollback` and returns
  `demo_owner: pass`.
- **shell** / **mcp** - a command run from `web/`, or one Supabase MCP call, that passes when it
  exits 0 or returns the stated value.
- **live** - a real browser on `npm run dev` (`http://localhost:3000`) through the Playwright MCP,
  and for C8, C18 and C21 a real email from open questions 1-2 of the plan. These are not
  committed (AGENTS..md). They cannot run until the user provisions the demo owner and edits the
  Magic link template; everything else can.

Known Supabase answers, read from the live project on 2026-10-23: `signInWithOtp` for an unknown
email with `shouldCreateUser: false` -> HTTP 422 `otp_disabled`; `verifyOtp` with a bad
`token_hash` -> HTTP 403 `otp_expired`.

## Checks

### S1 - An existing user requests a sign-in link · 8 files · ~20 KB · ~5k

**C1** - the `requestSignInLink` use case given `"  Owner@Example.COM "` over a fake `AuthGateway`
calls `requestMagicLink` once with `"owner@example.com"` and returns `{ ok: true, email: "owner@example.com" }`;
and the Supabase `AuthGateway` over a stubbed client calls
`auth.signInWithOtp({ email: "owner@example.com", options: { shouldCreateUser: false } })` once and
returns `{ ok: true }` when the stub returns no error (AC 1, door 2)
Proof: `npx vitest run application -t "C1:"`
Proof: `npx vitest run infrastructure/supabase -t "C1:"`

**C2** - the login fields rendered with state `{ status: "sent", email: "owner@example.com" }`
contain "Check your email" and "We sent a sign-in link to owner@example.com." and no email input (AC 1)
Proof: `npx vitest run app/login -t "C2:"`

**C3** - the Supabase `AuthGateway` returns `{ ok: true }` when the stubbed `signInWithOtp` returns
an error with status 422 and code `otp_disabled`; and after a live `signInWithOtp` call for
`auth-probe-nobody@example.com` with `shouldCreateUser: false`, `auth.users` has 0 rows with that
email (AC 2, door 2)
Proof: `npx vitest run infrastructure/supabase -t "C3:"`
Proof: `mcp execute_sql("select count(*) from auth.users where email = 'auth-probe-nobody@example.com'")` returns 0

**C4** - `requestSignInLink` returns `{ ok: false, code: "invalid_email" }` and calls
`requestMagicLink` 0 times for each of `""`, `"   "`, `"owner@example"`, `"owner.example.com"`,
`"own er@example.com"` and a 255-character address (243 × `a` + `@example.com`), and accepts the
254-character address (242 × `a` + `@example.com`); and the login fields rendered with state
`{ status: "invalid_email" }` show "Enter a valid email address" as the email field's error (AC 3)
Proof: `npx vitest run application -t "C4:"`
Proof: `npx vitest run app/login -t "C4:"`

**C5** - the Supabase `AuthGateway` returns `{ ok: false, code: "rate_limited" }` when the stubbed
`signInWithOtp` returns an error with status 429 and code `over_email_send_rate_limit`; and the
login fields rendered with state `{ status: "rate_limited" }` contain "Too many sign-in emails.
Wait a minute and try again." (AC 4)
Proof: `npx vitest run infrastructure/supabase -t "C5:"`
Proof: `npx vitest run app/login -t "C5:"`

**C6** - the Supabase `AuthGateway` returns `{ ok: false, code: "unavailable" }` and calls
`console.error` with a message containing the code, when the stubbed `signInWithOtp` returns an
error with status 500 and code `unexpected_failure`, and when it rejects with
`TypeError("fetch failed")` (message containing `fetch failed`); and the login fields rendered with
state `{ status: "unavailable" }` contain "We couldn't send the link. Try again." (AC 5)
Proof: `npx vitest run infrastructure/supabase -t "C6:"`
Proof: `npx vitest run app/login -t "C6:"`

**C7** - the login fields rendered with `pending: true` have a submit button with the `disabled`
attribute and the text "Sending…", and with `pending: false` an enabled submit button with the
text "Email me a sign-in link" (AC 6)
Proof: `npx vitest run app/login -t "C7:"`

### S2 - The link signs the user in · 4 files · ~10 KB · ~3k

**C8** - `GET /auth/confirm?token_hash=abc&type=email`, with a mocked container whose
`verifyEmailLink` returns `{ ok: true }`, responds `307` with a `Location` whose path is
`/pipeline`, after calling `verifyEmailLink("abc")` once; the Supabase `AuthGateway`'s
`verifyEmailLink("abc")` calls `auth.verifyOtp({ token_hash: "abc", type: "email" })` and returns
`{ ok: true }`; and live, the emailed link's `href` starts with
`http://localhost:3000/auth/confirm?token_hash=` and contains `type=email`, and opening it lands on
`/pipeline` signed in (AC 7, door 3)
Proof: `npx vitest run app/auth -t "C8:"`
Proof: `npx vitest run infrastructure/supabase -t "C8:"`
Proof: live - open the real emailed link in Playwright, read the URL after redirects

**C9** - `GET /auth/confirm` responds `307` with `Location` `/login?error=link_invalid` and no
`Set-Cookie` for each of: no `token_hash`; `type=magiclink`; no `type`; and a valid-looking request
whose `verifyEmailLink` returns `{ ok: false, code: "invalid_link" }`. `verifyEmailLink` is called
0 times in the first three cases. The Supabase `AuthGateway` returns `{ ok: false, code: "invalid_link" }`
when the stubbed `verifyOtp` returns status 403 code `otp_expired` (AC 8, door 2)
Proof: `npx vitest run app/auth -t "C9:"`
Proof: `npx vitest run infrastructure/supabase -t "C9:"`

**C10** - `/login` rendered with `searchParams` `{ error: "link_invalid" }` contains "That sign-in
link has expired or was already used. Request a new one.", and rendered with no `searchParams`
does not (AC 9)
Proof: `npx vitest run app/login -t "C10:"`

**C11** - in every response of C8 and C9 the `Location` URL has no `token_hash` search parameter (AC 10)
Proof: `npx vitest run app/auth -t "C11:"`

### S3 - The proxy keeps the session fresh and gates the app · 4 files · ~8 KB · ~2k

**C12** - `updateSession` over a mocked `@supabase/ssr` whose `getClaims` returns no claims responds
`307` with `Location` path `/login` for `/pipeline`, `/` and `/customers/abc`, and does not redirect
for `/login` and `/auth/confirm` (AC 11, door 1)
Proof: `npx vitest run infrastructure/supabase -t "C12:"`

**C13** - with `getClaims` returning claims `{ sub: "u1" }`, `updateSession` responds `307` with
`Location` path `/pipeline` for `/login`, and does not redirect for `/pipeline` (AC 12, door 1)
Proof: `npx vitest run infrastructure/supabase -t "C13:"`

**C14** - when the mocked client's `getClaims` calls `setAll` with cookie `sb-test-auth-token`,
value `refreshed`, options `{ path: "/", maxAge: 3600, sameSite: "lax" }`, the response of
`updateSession` carries that cookie with that value, `path` `/`, `maxAge` 3600 and `sameSite` `lax`,
both when it passes through (`/pipeline`, claims present) and when it redirects (`/pipeline`, no
claims) (AC 14, door 1)
Proof: `npx vitest run infrastructure/supabase -t "C14:"`

**C15** - `unstable_doesMiddlewareMatch` with `web/proxy.ts`'s `config` returns `false` for each of
`/_next/static/chunks/a.js`, `/_next/image?url=x`, `/favicon.ico`, `/logo.svg`, `/a.png`, `/a.jpg`,
`/a.jpeg`, `/a.gif`, `/a.webp`, `/a.ico`, and `true` for `/pipeline`, `/login` and
`/auth/confirm`; and `proxy` is exported from `web/proxy.ts` (AC 15, door 1)
Proof: `npx vitest run proxy -t "C15:"`

**C16** - the `(app)` layout, with a mocked container whose `currentMember` returns
`{ status: "signed_out" }`, calls `redirect("/login")` (AC 13)
Proof: `npx vitest run "app/(app)" -t "C16:"`

**C17** - the Supabase `currentMember` returns `{ status: "signed_out" }` without querying any table
when the stubbed `getClaims` returns no claims, and queries `memberships` filtered by
`user_id = "u1"` when it returns claims `{ sub: "u1", email: "owner@example.com" }`; and no file
under `web/` outside `node_modules` and `.next` contains `getSession(` (AC 19, door 5)
Proof: `npx vitest run infrastructure/supabase -t "C17:"`
Proof: `npx vitest run boundaries -t "C17:"`

### S4 - The signed-in member sees their company · 5 files · ~12 KB · ~3k

**C18** - the Supabase `currentMember` returns
`{ status: "member", userId: "u1", email: "owner@example.com", orgId: "o1", orgName: "Kettle Ridge Mechanical Ltd.", role: "owner" }`
when the stubbed query returns one row `{ org_id: "o1", role: "owner", orgs: { name: "Kettle Ridge Mechanical Ltd." } }`;
the `(app)` layout given that member renders markup containing "Kettle Ridge Mechanical Ltd." and
"owner@example.com"; and live, the demo owner signed in through a real link sees
"Kettle Ridge Mechanical Ltd." in the sidebar at 1440x900 (AC 16)
Proof: `npx vitest run infrastructure/supabase -t "C18:"`
Proof: `npx vitest run "app/(app)" -t "C18:"`
Proof: live - `browser_snapshot` of `/pipeline` after signing in as the demo owner

**C19** - the Supabase `currentMember` returns `{ status: "no_membership", email: "owner@example.com" }`
when the stubbed query returns no row; and the `(app)` layout given that result renders "No
workspace yet", "Your account isn't part of a company workspace. Ask your company's owner to invite
you." and a "Sign out" button, and no link to `/pipeline` (AC 17)
Proof: `npx vitest run infrastructure/supabase -t "C19:"`
Proof: `npx vitest run "app/(app)" -t "C19:"`

**C20** - the Supabase `currentMember` query orders by `created_at` ascending and limits to 1 row,
as recorded by the stubbed query builder (AC 18)
Proof: `npx vitest run infrastructure/supabase -t "C20:"`

### S5 - Sign out · 3 files · ~4 KB · ~1k

**C21** - the sign-out Server Action, with a mocked container, calls `signOut` once and then
`redirect("/login")`; the Supabase `AuthGateway`'s `signOut` calls `auth.signOut({ scope: "local" })`;
and live, after Sign out the action's response is `303` to `/login`, and navigating to `/pipeline`
afterwards responds `307` to `/login` (AC 20)
Proof: `npx vitest run "app/(app)" -t "C21:"`
Proof: `npx vitest run infrastructure/supabase -t "C21:"`
Proof: live - `browser_network_requests` after Sign out, then `browser_navigate` to `/pipeline`

### S6 - The demo owner can be provisioned without committing an email · 3 files · ~25 KB · ~6k

**C22** - with an `auth.users` row for `owner@example.test` and
`set_config('app.demo_owner_email', 'Owner@Example.TEST', true)`, running the seed body twice
leaves exactly one `memberships` row in org `00000000-0000-4000-8000-00000000de30`, for that user,
with role `owner` (AC 21, door 4)
Proof: `seed supabase/tests/demo_owner.sql#C22`

**C23** - with `app.demo_owner_email` unset, running the seed body completes and leaves 0
`memberships` rows in the demo org; and the catalog-seed proofs still pass unchanged (AC 22)
Proof: `seed supabase/tests/demo_owner.sql#C23`
Proof: the catalog-seed `seed` run (fixture, seed body, `demo_seed.sql`, seed body, `demo_seed_rerun.sql`) returns `demo_seed: pass`

**C24** - every email address literal in `supabase/seed.sql` ends in `@example.com` (AC 23, door 4)
Proof: `npx vitest run boundaries -t "C24:"`

### S7 - Boundaries and build hold · 6 files · ~15 KB · ~4k

**C25** - `npm run build`, `npm run lint`, `npm test` and `npx tsc --noEmit` exit 0 in `web/`, with
the layer rules unchanged, so no file under `app/`, `components/` or `lib/` imports `@supabase/*`
or `@/infrastructure` (AC 24)
Proof: `npm run build`
Proof: `npm run lint`
Proof: `npm test`
Proof: `npx tsc --noEmit`

**C26** - `TextInput` rendered with `id="email"` and error "Enter a valid email address" outputs an
input with `aria-invalid="true"` and `aria-describedby="email-error"`, followed by an element with
`id="email-error"` containing that message; rendered with no error, it has neither attribute and
no `email-error` element (AC 25)
Proof: `npx vitest run components/ui -t "C26:"`

**C27** - `getContainer()` returns `requestSignInLink`, `verifyEmailLink`, `signOut` and
`currentMember` as functions, besides the existing transition use cases (door 2)
Proof: `npx vitest run composition -t "C27:"`

**C28** - `updateSession` throws an `Error` naming `NEXT_PUBLIC_SUPABASE_URL` when it is unset,
and naming `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` when that is unset (door 1, startup config)
Proof: `npx vitest run infrastructure/supabase -t "C28:"`

**C29** - live, `/login` at 375x812, 768x1024 and 1440x900 has no horizontal scroll, the email
input and submit button are each at least 44 px tall at 375x812 and 768x1024, a tap on the button
with an invalid value shows "Enter a valid email address", and `browser_console_messages` reports
no error (AGENTS..md, AC 3)
Proof: live - Playwright MCP `browser_resize`, `browser_snapshot`, `browser_take_screenshot`, `browser_evaluate` for `scrollWidth` and element heights

**C30** - live, `/pipeline` opened without a session responds `307` to `/login` (AC 11)
Proof: live - `browser_navigate` to `/pipeline` with a fresh context, read `browser_network_requests`

**C31** - after the build, `get_advisors` with type `security` reports no lint that was not
reported before the build (this feature adds no migration)
Proof: `mcp get_advisors(type: "security")` - same lint names as before the build

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /auth/confirm` statuses (2) | `307` -> `/pipeline` C8 · `307` -> `/login?error=link_invalid` C9 | - |
| proxy outcomes (3) | pass-through C12, C13, C14 · `307` -> `/login` C12, C30 · `307` -> `/pipeline` C13 | - |
| `POST /login` form states (4) | `sent` C1, C2 · `invalid_email` C4 · `rate_limited` C5 · `unavailable` C6 | - |
| `requestMagicLink` Supabase answers (5) | no error C1 · 422 `otp_disabled` C3 · 429 C5 · other error C6 · rejected request C6 | - |
| invalid email inputs (6) | empty C4 · blank C4 · no TLD C4 · no `@` C4 · space C4 · 255 chars C4 | - |
| email length edge (2) | 254 accepted C4 · 255 rejected C4 | - |
| `/auth/confirm` refusals (4) | no `token_hash` C9 · `type=magiclink` C9 · no `type` C9 · verify fails C9 | - |
| proxy public paths (2) | `/login` C12, C13 · `/auth/confirm` C12 | - |
| proxy matcher exclusions (10) | C15, table-driven over all 10 | - |
| `currentMember` results (3) | `signed_out` C16, C17 · `no_membership` C19 · `member` C18 | - |
| `AuthGateway` methods (3) | `requestMagicLink` C1, C3, C5, C6 · `verifyEmailLink` C8, C9 · `signOut` C21 | - |
| login copy (6) | sent C2 · invalid email C4 · rate limited C5 · unavailable C6 · pending C7 · link invalid C10 | - |
| seed setting (2) | set C22 · unset C23 | - |
| startup config: Supabase env (2 assemblies) | `getContainer()` ports-adapters C23 · `updateSession` C28 | - |
| doors (5) | 1 C12, C13, C14, C15, C28 · 2 C1, C3, C9, C17, C18, C19, C27 · 3 C8 · 4 C22, C24 · 5 C17 | - |

- Claims naming a status or a response: C8, C9, C11-C14, C16, C21, C30. The route, proxy and
  action proofs call the real handler with a real `NextRequest` and read the real `NextResponse`;
  the Supabase side is a stub, and the live proofs C8, C18, C21 and C30 cross the real boundary
- No other check claims more than the cases its proof exercises

## Swept

- validation: C4 (email shape and length), C9 (`token_hash` and `type`)
- failure modes: C6 (Supabase error or unreachable -> "We couldn't send the link"), C9 (a failed verify sets no session)
- idempotency: C22 (seed re-run inserts nothing); a sign-in link works once, and Supabase rejects reuse with `otp_expired` -> C9
- authorization: C12, C16 (signed out never reaches an app page), C19 (signed in without a membership sees no navigation); data access stays with the existing RLS policies (supabase-init checks)
- concurrency: n/a - this feature writes no shared row; the only write is the seed, which is single-session and `on conflict do nothing` (C22)
- data lifecycle: n/a - sessions expire under the Supabase JWT and refresh-token lifetimes, and C21 ends one on demand; no stored data is created except the seed row
- dependency failure: C6 (Auth unreachable when sending), C9 (Auth refuses the link)
- state transitions: signed out -> signed in C8; signed in -> signed out C21; the guards on both C12, C13, C16
- observability: C6 logs the Supabase error code on the server; no metric or tracing requirement

## Handoff

- S1-S7 touch about 20 new or changed files in `web/` (~45 KB with tests), read
  `composition/index.ts`, `infrastructure/supabase/index.ts`, the shell components and the
  `(app)` layout (~10 KB), `supabase/seed.sql` (9 KB) plus `fixture.sql` (~11 KB) and a new
  `demo_owner.sql` (~3 KB), and edit `CONTEXT.md`, `ROADMAP.md` and `STATE.md` (~42 KB read):
  about 120 KB, roughly 30k tokens, under the 150k budget - one builder

- **Boundary:** C1-C7, C9-C17, C19, C20, C24-C31 closed in the feature commit (one builder). Still open: the live proofs of C8 (real emailed link), C18 (demo owner sees the org) and C21 (sign out over HTTP), which need the user's dashboard steps (plan open questions 1-2), and `seed supabase/tests/demo_owner.sql#C22`/`#C23`, whose `execute_sql` call the user declined in this session
- **Settled mid-build:** door 6 added to the plan (session read behind `<Suspense>`), because `next build` with Cache Components rejects a request read at the top of a route; AC 23 narrowed to "outside `example.com`", because the demo contacts already use it; `demo_owner.sql` runs the seed body through a `tests.run_seed()` function instead of pasting it three times; `boundaries.test.ts` already had `C24:` tests from ports-adapters, so `-t "C24:"` also runs those, which stay green
- **Abandoned:** substituting the seed body at comment markers in `demo_owner.sql` - the marker text inside the header comment was replaced too, which broke the comment
