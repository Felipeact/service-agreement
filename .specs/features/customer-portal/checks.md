# Customer review portal: the site contact views an agreement and accepts, refuses or asks for changes - checks

Profile: standard
Plan: `.specs/features/customer-portal/plan.md`

52 checks in 6 slices plus doors and delivery · 6 one-way doors · 1 open (blocks go-live, not the build)

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C901:`). This feature numbers from C901, because agreement-pdf owns up to `C878:`. Proofs name the folder or file filter their test sits in; the file inside it is the builder's call.
  - Pure domain code (`portalState`, the contrast choice, `buildAgreementDocument`) is tested with literal values.
  - Adapters are tested with the recording `stubClient` (`infrastructure/supabase/stub-client.ts`), whose `rpc` is a `vi.fn()`.
  - Routes are tested like `app/auth/confirm/route.test.ts`: `vi.mock("@/composition")` supplies the container, and the test calls `GET` with a `NextRequest`. A check that needs the real PDF adapter runs in `composition/`, as `composition/pdf-route.test.ts` does (the UI lint rule forbids `@/infrastructure` under `app/`).
  - Views are asserted with `renderToStaticMarkup`, as `components/agreements` does.
- **test:db** - `npm run test:db customer_portal` in `web/` (AD-026) runs `fixture.sql` then the new `supabase/tests/customer_portal.sql`, rolled back. The file joins `RECIPES` as `plain("customer_portal")` and passes only when its last row is `customer_portal: pass`. Each assertion is labelled with its check id (`assertions C919`). The file signs in as `anon` (`set local role anon`), as the org A estimator `uE`, the viewer `uV`, and as the org B owner `uB`.
- **shell** - a command run from `web/` that passes when it exits 0 or prints the stated output.
- **mcp** - a Supabase MCP call on project `gnxebrtcpbujhvcamtoe`, result recorded in the Handoff.
- **live** - a real browser on `npm run dev` through the Playwright MCP, one signed-in context for staff and one separate private context for the customer (AGENTS..md). Not committed.

Terms:

- "the portal page" is `GET /review/[token]`; "the portal PDF" is `GET /review/[token]/pdf`; "the actions" are the four Server Actions of the plan's `Surface`.
- "a live link" is a `portal_links` row with `revoked_at` null. "Token" is the 43-character secret; "hash" is its lowercase hex SHA-256.
- **Fixture agreement** is AG-1052 (`Fernwood Dental`, 2 service lines, total $3,870.00) with the fixture settings of agreement-pdf (legal name `Kettle Ridge Mechanical Ltd.`, accent `#1f6f8b`, repair discount 10, CPI cap 5, notice 30, payment 30, province `BC`, a tax note). In SQL it is built from `fixture.sql`'s org A.
- **Portal states** are the seven of the plan's Impact: `open`, `decided`, `superseded`, `replaced`, `withdrawn`, `expired`, `unknown`.
- Dates in tests are computed with the formatter the page uses, never typed out.

## Checks

### S1 - A writer sends the agreement and gets the link · ~9 files · ~40k

**C901** - `public.send_agreement` as the estimator on a `draft` with 2 lines in version 1 sets the agreement `sent`, inserts exactly 1 `portal_links` row for that version with the given hash, writes 1 `agreement.sent` event, and the version's snapshot holds `types` and `terms` after the call. Called through the Server Action, the action returns `200` ok with a URL equal to `<origin>/review/<token>` whose token hashes to the stored hash, and the view renders the URL and a button "Copy link" (AC 1)
Proof: `npm run test:db customer_portal` (assertions `C901`)
Proof: `npm test -- sendAgreement -t "C901:"`
Proof: `npm test -- components/agreements -t "C901:"`

**C902** - `send_agreement` on a draft whose current version has 0 lines raises `23514`, leaves the agreement `draft`, inserts no link and no event; the action answers `422` `no_lines` and the view shows "Add at least one service line before sending." (AC 2)
Proof: `npm run test:db customer_portal` (assertions `C902`)
Proof: `npm test -- sendAgreement -t "C902:"`

**C903** - `send_agreement` on an agreement already `sent` raises `40001`, inserts no link; the action answers `409` `conflict` and the view shows "This agreement was changed by someone else. Reload the page." Two calls with 2 different hashes leave exactly 1 live link (AC 3)
Proof: `npm run test:db customer_portal` (assertions `C903`)
Proof: `npm test -- sendAgreement -t "C903:"`

**C904** - `reissue_portal_link` on a `sent` agreement sets the old link's `revoked_at`, inserts a new link for the same version with the new hash, and leaves 1 live link; on a `draft`, `accepted` or `refused` agreement it raises `40001` and changes nothing (3 statuses). The action answers `200` with the new URL; `portal_view` of the old hash then returns the link with `revoked_at` set (AC 4)
Proof: `npm run test:db customer_portal` (assertions `C904`)
Proof: `npm test -- reissueLink -t "C904:"`

**C905** - The agreement view for a `sent` agreement renders "Viewed by the customer on <date>" when the live link has a first view, and "Not viewed yet" when it has none; for a `draft` it renders neither (AC 5)
Proof: `npm test -- components/agreements -t "C905:"`

**C906** - A viewer sees no "Send to customer" and no "Get a new link" in the view markup; both actions answer `403` `forbidden` for a viewer without calling any RPC; and as the viewer `uV` both RPCs raise `42501` and write nothing (AC 6)
Proof: `npm test -- components/agreements -t "C906:"`
Proof: `npm test -- sendAgreement -t "C906:"`
Proof: `npm run test:db customer_portal` (assertions `C906`)

**C907** - The action passes the RPC the SHA-256 hex of the token (64 characters, `[0-9a-f]`), never the token: no argument of the recorded `rpc` call equals the token. `portal_links` has no column that can hold a token, and the URL appears in the action's return value and nowhere a reader can fetch (no reader or view type has a field for it) (AC 7)
Proof: `npm test -- sendAgreement -t "C907:"`
Proof: `npm run test:db customer_portal` (assertions `C907`)

### S2 - The customer opens the link and reads the agreement · ~10 files · ~35k

**C908** - `portalState` is table-driven over the 7 states: link live + version current + `sent` -> `open`; current + `accepted`, `refused` or `changes_requested` -> `decided` (3 inputs); link version below the current -> `superseded` (for status `sent`, `accepted`, `draft`: 3 inputs); `revoked_at` set -> `replaced` (wins over every other input: 3 inputs); `withdrawn` -> `withdrawn`; `expired` -> `expired`; no link -> `unknown` (AC 13 to 17)
Proof: `npm test -- domain/portal -t "C908:"`

**C909** - The `open` page for the fixture contains the tenant's legal name, address and phone, `AG-1052`, `Version 1`, `Fernwood Dental`, the site name, each of the 2 lines with visits per year, cost per visit and annual amount, `Total per year` with `$3,870.00` and `before tax`, the headings `Service included` and `Equipment`, and each term that is set; with address and phone `null` it holds no `null` or `undefined` text (AC 8)
Proof: `npm test -- app/review -t "C909:"`

**C910** - For a token that is malformed (42 characters, 44 characters, 43 characters containing `+`, 43 characters containing a space: 4 inputs, each answered `404` by the proxy; an empty token `/review/` is not a review page and follows the app's normal rule, a signed-out redirect to `/login`, proven by C944 - reworded 2026-10-28, see Handoff) or unknown (valid shape, no link), `portal_view` returns no link and the page answers `404` showing "This link doesn't work. Ask the company that sent it for a new one." and containing neither the tenant's name nor `AG-` (AC 9)
Proof: `npm run test:db customer_portal` (assertions `C910`)
Proof: `npm test -- app/review -t "C910:"`

**C911** - The page shows the terms frozen in the version: with the snapshot's repair discount 10 and the org's current setting changed to 15 after the send, `portal_view` returns 10 and the page prints `10%`, not `15%` (AC 10)
Proof: `npm run test:db customer_portal` (assertions `C911`)
Proof: `npm test -- app/review -t "C911:"`

**C912** - The tenant's legal name appears in the page header, the accent `#1f6f8b` is applied to the title rule and to the primary button, and the markup contains neither the product's name nor the string `Kettle Ridge` outside the data passed in; with accent `null` the neutral accent is used (AC 11)
Proof: `npm test -- app/review -t "C912:"`

**C913** - `contrastText(accent)` returns white or near-black such that the contrast ratio with the accent is at least 4.5, table-driven over 8 accents: `#000000`, `#ffffff`, `#1f6f8b`, `#ffff00`, `#ff0000`, `#00ff00`, `#808080`, `#0000ff` (AC 12)
Proof: `npm test -- domain/portal -t "C913:"`

**C914** - In `replaced` the page shows "This link has been replaced. Ask <tenant name> for the new one." with the phone when set, and contains no service line, no `Download PDF` link and none of the three decision controls (AC 13)
Proof: `npm test -- app/review -t "C914:"`

**C915** - In `superseded` the page shows "A newer version of this agreement was sent. Ask <tenant name> for its link." above the version's content, with `Download PDF` and no decision control (AC 14)
Proof: `npm test -- app/review -t "C915:"`

**C916** - In `withdrawn` the page shows "<tenant name> withdrawn this agreement." and in `expired` "This agreement has expired.", each with the tenant's phone when set, and neither shows content, a download or a decision control (AC 15)
Proof: `npm test -- app/review -t "C916:"`

**C917** - In `decided` the page shows "You accepted this agreement on <date>.", "You refused this agreement on <date>." or "You asked for changes on <date>." for the 3 statuses, with the reason for the last two, the content, the download, and no decision control (AC 16)
Proof: `npm test -- app/review -t "C917:"`

**C918** - In `open` the page shows `Accept`, `Refuse` and `Request changes`, each rendered with the shared `Button` (44px below 1024px, per `components/ui`), and no other decision control. Live: at 375 and 768 px each is at least 44px tall (AC 17)
Proof: `npm test -- app/review -t "C918:"`
Proof: live, in C951

### S3 - The customer decides · ~8 files · ~35k

**C919** - `portal_decide` for `accepted` / `agreement.accepted` on a live link of the current `sent` version sets the agreement `accepted`, writes 1 event with `actor_id` null and payload exactly `{"from":"sent","to":"accepted","versionNo":1,"via":"portal"}`, and 1 outbox row for that event. The action answers `200` and the page shows the `decided` view (AC 18)
Proof: `npm run test:db customer_portal` (assertions `C919`)
Proof: `npm test -- decideAction -t "C919:"`

**C920** - Table-driven over `refused` and `changes_requested`: with the reason `"  Too dear  "` the agreement takes the status, 1 event is written with `reason` equal to `Too dear` (trimmed) and `via` `portal`, and 1 outbox row; the action answers `200` (AC 19, AC 20)
Proof: `npm run test:db customer_portal` (assertions `C920`)
Proof: `npm test -- decideAction -t "C920:"`

**C921** - For `refused` and `changes_requested`, a reason of `""`, `"   "` and a tab/newline-only string (3 inputs) is refused: `portal_decide` raises `23514`, the action answers `422` `reason_required` before any RPC call, the form shows "Tell us why so <tenant name> can respond." beside the field, and nothing is written (AC 21)
Proof: `npm run test:db customer_portal` (assertions `C921`)
Proof: `npm test -- decideAction -t "C921:"`
Proof: `npm test -- app/review -t "C921:"`

**C922** - A reason of exactly 2000 characters after trimming is accepted and one of 2001 is refused, for both reason decisions (4 cases): `portal_decide` raises `23514` for 2001, the action answers `422` `reason_too_long` with no RPC call, and the form keeps the typed text and shows a count over 2000 (AC 22)
Proof: `npm run test:db customer_portal` (assertions `C922`)
Proof: `npm test -- decideAction -t "C922:"`
Proof: `npm test -- app/review -t "C922:"`

**C923** - `portal_decide` writes nothing and raises `40001` in each of 4 cases: the link's version is not the current one, the agreement is `withdrawn`, the agreement is already `accepted`, the link is revoked. The action answers `409` `not_open` and returns the state the link is now in, which `portalState` maps to `superseded`, `withdrawn`, `decided` and `replaced` in that order (AC 23)
Proof: `npm run test:db customer_portal` (assertions `C923`)
Proof: `npm test -- decideAction -t "C923:"`

**C924** - Two `portal_decide` calls with the same hash and the same decision leave exactly 1 decision event and 1 outbox row; the second raises `40001`, and the action's second answer is the `decided` view with `200`, not an error (AC 24)
Proof: `npm run test:db customer_portal` (assertions `C924`)
Proof: `npm test -- decideAction -t "C924:"`

**C925** - Opening the portal page and the portal PDF, with any token, calls only `portal_view`: the recorded `rpc` calls are exactly `["portal_view"]`. In SQL, `portal_view` run twice leaves the row counts of `agreements`, `portal_links`, `events` and `outbox` unchanged (AC 25)
Proof: `npm test -- app/review -t "C925:"`
Proof: `npm run test:db customer_portal` (assertions `C925`)

**C926** - `portal_decide` refuses the pairs it does not whitelist, 5 inputs: `accepted` with event `agreement.refused`, `withdrawn` with `agreement.withdrawn`, `sent` with `agreement.sent`, `accepted` with event `contract.completed`, an empty status. Each raises `42501` and writes nothing (door 2)
Proof: `npm run test:db customer_portal` (assertions `C926`)

### S4 - The system records the view and offers the PDF · ~6 files · ~25k

**C927** - `portal_record_view` on a live link with no first view stamps `first_viewed_at`, writes 1 `agreement.viewed` event with payload exactly `{"versionNo":1}`, `actor_id` null, `entity_type` `agreement`, and no outbox row (AC 26, door 6)
Proof: `npm run test:db customer_portal` (assertions `C927`)

**C928** - A second and a third `portal_record_view` on the same link write no event and leave `first_viewed_at` unchanged; a revoked link records nothing; a link on another version is a separate link with its own first view (3 cases) (AC 27)
Proof: `npm run test:db customer_portal` (assertions `C928`)

**C929** - The page mounts a view recorder in `open`, `decided` and `superseded` and not in `replaced`, `withdrawn`, `expired` or `unknown` (7 states), and the recorder calls `recordViewAction` once with the token; the server render itself calls no write RPC (AC 26)
Proof: `npm test -- app/review -t "C929:"`

**C930** - `GET /review/<token>/pdf` for an `open` link answers `200`, `Content-Type: application/pdf`, a body beginning `%PDF-`, `Content-Disposition: attachment; filename="AG-1052-v1.pdf"`, and the rendered text holds the legal name and the frozen repair discount; with the settings changed after the send, the PDF holds the frozen value. For `decided` and `superseded` it answers `200` too (3 states). The renderer is the real adapter (AC 28)
Proof: `npm test -- composition -t "C930:"`

**C931** - `GET /review/<token>/pdf` answers an empty `404` and never calls the renderer for 6 inputs: malformed token, unknown token, `replaced`, `withdrawn`, `expired`, and `unknown` after a revoke; the body contains neither the number nor the tenant (AC 29)
Proof: `npm test -- app/review -t "C931:"`

**C932** - `GET /review/<token>/pdf` answers an empty `503`, logs the cause with `console.error` and returns no bytes in 3 cases: the renderer rejects, `portal_view` rejects, the tenant has no settings row. A `portal_view` rejection on the page is not caught by the page (it reaches the route's `error.tsx`) (AC 30)
Proof: `npm test -- app/review -t "C932:"`

### S5 - A sent version keeps the terms it was sent with · ~5 files · ~25k

**C933** - After `send_agreement` the version's snapshot `terms` equals exactly `{"repairDiscountPct":10,"cpiCapPct":5,"cancellationNoticeDays":30,"paymentDays":30,"governingProvince":"BC","taxNote":"…"}` (6 camelCase keys), and with the 4 nullable settings null each key is present with JSON `null` (2 cases). A withdraw from `draft` freezes the same keys. A failed send (no lines) leaves the snapshot without `terms` (AC 31, door 3)
Proof: `npm run test:db customer_portal` (assertions `C933`)

**C934** - `buildAgreementDocument` prints the version's frozen terms when the scope is `frozen`, and the settings' terms only when `editable` is true; 4 cases: frozen with terms, frozen after settings differ, editable draft, past version of a draft (frozen). The 6 terms keep the labels and order agreement-pdf set (AC 32)
Proof: `npm test -- domain/agreement -t "C934:"`
Proof: `npm test -- composition -t "C934:"` (rendered text of the staff PDF)

**C935** - A frozen version with no `terms` key prints no terms section and does not read the org's settings: with settings that hold a repair discount of 99, the string `99%` is absent from the document (AC 33)
Proof: `npm test -- domain/agreement -t "C935:"`

**C936** - The reader returns `AgreementDetail.terms` from the snapshot for a frozen version and `null` for the editable one, and `parseTerms` accepts the 6-key document and returns `null` for 5 malformed inputs (a missing key, a string percent, a negative day count, `terms` an array, `terms` absent) (door 3)
Proof: `npm test -- domain/agreement -t "C936:"`
Proof: `npm test -- infrastructure/supabase -t "C936:"`

**C937** - After the migration, on the live project, the number of `agreement_versions` that are not the current version of a draft and have no `terms` key is 0; and `seed.sql` re-run after changing `org_settings.repair_discount_pct` leaves every version that already has `terms` unchanged (AC 34)
Proof: `npm run test:db demo_seed` (assertions `C937`)
Proof: mcp `execute_sql` count, result recorded in the Handoff

### S6 - The portal is private and works the same for anyone · ~4 files · ~15k

**C938** - `next.config` sets, for `/review/:path*`, the headers `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`; the PDF route sets the first on its own response. Live: `curl -I` on a link returns all three (AC 35)
Proof: `npm test -- next.config -t "C938:"`
Proof: live, in C951

**C939** - `portal_view` called as `anon` and as the org A estimator `uE` for the same hash returns equal jsonb; the page and PDF route never call `currentMember` (the container's `currentMember` mock is not called) (AC 36)
Proof: `npm run test:db customer_portal` (assertions `C939`)
Proof: `npm test -- app/review -t "C939:"`

**C940** - With a live link in org A and one in org B: `portal_view`, `portal_record_view` and `portal_decide` for A's hash read and write only A's agreement; B's agreement, link and events are unchanged (3 functions); and a hash for version 1 never returns version 2's lines (4 cases) (AC 37)
Proof: `npm run test:db customer_portal` (assertions `C940`)

**C941** - As `anon`: `send_agreement` and `reissue_portal_link` raise `42501`; `select` on `portal_links` returns 0 rows or is denied; `insert` into `events`, `update` of `agreements` and a call to `private.enqueue_outbox_for_system` are denied (5 cases) (AC 38, door 5)
Proof: `npm run test:db customer_portal` (assertions `C941`)

### Doors and delivery

**C942** - Door 1: `portal_links` exists with RLS enabled; `token_hash` is unique (a second insert of one hash fails `23505`); a second live link for one version fails `23505` and a second link after the first is revoked succeeds; the composite FK `(agreement_version_id, org_id)` rejects a version of another org; an org member can `select` their org's links and not another's; `authenticated` has no `insert`, `update` or `delete` on it (6 cases) (door 1)
Proof: `npm run test:db customer_portal` (assertions `C942`)

**C943** - Door 2: from `pg_proc`, `portal_view`, `portal_record_view` and `portal_decide` are `security definer` with `proconfig` containing `search_path=""`, executable by `anon` and `authenticated`; `send_agreement` and `reissue_portal_link` are `security invoker`, executable by `authenticated` and not by `anon` or `public`. 5 functions, one assertion each, and the private helpers `private.org_terms` (definer, empty `search_path`, executable by none of `public`, `anon`, `authenticated`) and `private.issue_portal_link` (definer, empty `search_path`, executable by `authenticated` only, as the two invoker functions call it) (door 2)
Proof: `npm run test:db customer_portal` (assertions `C943`)

**C944** - Door 4: `proxy` lets a signed-out request through for `/review/abc` and `/review/abc/pdf` (2) and redirects it to `/login` for `/review`, `/reviews/abc`, `/review-x/abc`, `/agreements/<uuid>` (4); a signed-in request to `/review/abc` is not redirected; `/login` and `/auth/confirm` stay public (door 4)
Proof: `npm test -- session -t "C944:"`
Proof: `npm test -- proxy -t "C944:"`

**C945** - Door 5: `private.enqueue_outbox_for_system` is `security definer`, `search_path=""`, with `execute` denied to `public`, `anon` and `authenticated`; `private.enqueue_outbox` still refuses a non-member (its `events_outbox` recipe passes unchanged) (door 5)
Proof: `npm run test:db customer_portal` (assertions `C945`)
Proof: `npm run test:db events_outbox`

**C946** - Door 6: the payload keys of the three decisions and of `agreement.viewed` are the ones the plan lists, and `agreement.viewed` never has an outbox row, over a sequence send, view, view, accept (1 outbox row for `agreement.sent`, 1 for `agreement.accepted`, 0 for views) (door 6)
Proof: `npm run test:db customer_portal` (assertions `C946`)

**C947** - No file under `web/` source (excluding tests, `node_modules`, `.next`) mentions `SERVICE_ROLE`, `service_role` or `SUPABASE_SECRET`, and `.env.example` gains no secret variable (plan Landing door 2)
Proof: `grep -rniE "service_role|SUPABASE_SECRET" app components domain application infrastructure composition lib proxy.ts --include=*.ts --include=*.tsx --exclude=*.test.ts --exclude=*.test.tsx` (no output, exit 1)

**C948** - `npm run build`, `npm run lint` and `npx tsc --noEmit` exit 0 in `web/`, and the route list shows `/review/[token]` as dynamic or partially prerendered (`ƒ` or `◐`, as every page does under Cache Components) and `/review/[token]/pdf` as dynamic (`ƒ`) - reworded 2026-10-28
Proof: `npm run build`
Proof: `npm run lint`
Proof: `npx tsc --noEmit`

**C949** - `npm test` in `web/` and `npm run test:db` (all recipes, now including `customer_portal`) exit 0. The table-inventory pin `C35` counts 18 tables and `C19` (which runs every table through the viewer, role and org-delete loops that assume update and delete grants `portal_links` deliberately lacks) stays 17 - reworded 2026-10-28, and the `service_included` assertions that compared a snapshot to the bare scope compare it to scope plus `terms`; both edits are consequences of doors 1 and 3 and are listed in the Handoff, not weakened
Proof: `npm test`
Proof: `npm run test:db`

**C950** - Supabase `get_advisors` (security) reports the two accepted findings of CONTEXT.md and, for each of exactly `portal_view`, `portal_record_view`, `portal_decide` and no other function, one `anon_security_definer_function_executable` and one `authenticated_security_definer_function_executable` finding (the plan grants both roles); no other finding (door 2) - reworded 2026-10-28
Proof: mcp `get_advisors` (security), result recorded in the Handoff

**C951** - Live, staff context as the demo owner and a separate private context for the customer: Send on a draft with lines, copy the link, open it as the customer at 375, 768 and 1440 px, press Accept and confirm. No horizontal scroll, controls at least 44px tall at 375 and 768 px, `browser_console_messages` clean, no failed request; `curl -I` on the link shows the 3 headers; the pipeline card for that agreement moves to "Accepted (awaiting signature)"; the agreement page shows "Viewed by the customer on <date>" (AC 1, 5, 17, 18, 35, AGENTS..md)
Proof: live (Playwright MCP), result recorded in the Handoff

**C952** - Live, same two contexts: Refuse with an empty reason shows the error, then with a reason moves the card to Refused; Request changes shows "Start version 2" for staff; "Get a new link" on a sent demo agreement makes the old link show the `replaced` message; a tenant accent chosen to be pale (`#ffeb3b`) gives a legible button; touch taps work on the customer's controls at 375 px (AC 4, 12, 19 to 22, AGENTS..md)
Proof: live (Playwright MCP), result recorded in the Handoff

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /review/[token]` statuses (2) | `200` C909 · `404` C910 | - |
| `GET /review/[token]/pdf` statuses (3) | `200` C930 · `404` C931 · `503` C932 | - |
| `decideAction` results (5) | `200` C919 · `422` reason_required C921 · `422` reason_too_long C922 · `409` not_open C923 · `503` unavailable C919 | - |
| `recordViewAction` results (2) | `200` C929 · `503` C929 | - |
| `sendAgreementAction` results (6) | `200` C901 · `422` no_lines C902 · `409` conflict C903 · `403` forbidden C906 · `404` not_found C903 · `503` unavailable C901 | - |
| `reissueLinkAction` results (5) | `200` C904 · `409` conflict C904 · `403` forbidden C906 · `404` not_found C904 · `503` unavailable C904 | - |
| portal states (7) | `open` C908, C918 · `decided` C908, C917 · `superseded` C908, C915 · `replaced` C908, C914 · `withdrawn` C908, C916 · `expired` C908, C916 · `unknown` C908, C910 | - |
| decisions (3) | accept C919 · refuse C920 · request changes C920 | - |
| `not_open` causes (4) | version not current C923 · withdrawn C923 · already decided C923 · link revoked C923 | - |
| reason bounds (5) | empty C921 · whitespace C921 · 1 character C920 · 2000 C922 · 2001 C922 | - |
| whitelist rejections (5) | wrong pair C926 · `withdrawn` C926 · `sent` C926 · foreign event C926 · empty status C926 | - |
| malformed token shapes (4) | 42 chars C910 · 44 chars C910 · `+` C910 · space C910 | - |
| roles for send and reissue (4) | owner C901, C904 · admin C901, C904 · estimator C901 · viewer C906 | - |
| terms (6) | repair discount C933 · CPI cap C933 · notice days C933 · payment days C933 · province C933 · tax note C933 | - |
| terms sources (4) | frozen with terms C934 · frozen after settings differ C934 · editable draft C934 · frozen without terms C935 | - |
| response headers (3) | `Cache-Control` C938 · `Referrer-Policy` C938 · `X-Robots-Tag` C938 | - |
| view recorder states (7) | `open` C929 · `decided` C929 · `superseded` C929 · `replaced` C929 · `withdrawn` C929 · `expired` C929 · `unknown` C929 | - |
| events written (5) | `agreement.sent` C946 · `agreement.viewed` C927 · `agreement.accepted` C919 · `agreement.refused` C920 · `agreement.changes_requested` C920 | - |
| anon denials (5) | send C941 · reissue C941 · select links C941 · insert events C941 · enqueue for system C941 | - |
| private helpers (2) | `private.org_terms` C943 · `private.issue_portal_link` C943 | - |
| RPC functions (5) | `portal_view` C943 · `portal_record_view` C943 · `portal_decide` C943 · `send_agreement` C943 · `reissue_portal_link` C943 | - |
| one-way doors (6) | door 1 C942 · door 2 C943, C926, C950 · door 3 C933, C936 · door 4 C944 · door 5 C945 · door 6 C946, C927 | - |
| accent contrast (8) | `#000000` C913 · `#ffffff` C913 · `#1f6f8b` C913 · `#ffff00` C913 · `#ff0000` C913 · `#00ff00` C913 · `#808080` C913 · `#0000ff` C913 | - |
| proxy public paths (6) | `/review/abc` C944 · `/review/abc/pdf` C944 · `/review` C944 · `/reviews/abc` C944 · `/review-x/abc` C944 · `/agreements/<uuid>` C944 | - |
| startup config: `APP_BASE_URL` read (2 assemblies) | the send action C901 · the reissue action C904 | - |
| startup config: portal reader in the container (1 assembly) | composition root C930 | - |

- Claims naming a status code, route or response shape: C901 to C904, C906, C910, C919 to C924, C930 to C932, C938, C944 - each has a proof that crosses the boundary it names (the RPC, the route or the action)
- Claims about what a reader sees in the PDF (C930, C934) are proven on bytes from the real renderer
- No other check claims more than the single case its proof exercises

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, reached across a boundary (the anonymous RPCs, the actions, the routes, the proxy) | one at the boundary **and** one at its own layer | the contract at the boundary; one asserted case per row of the decision table at its own layer |
| Decides, not reached across a boundary (`portalState`, `contrastText`, `parseTerms`, the builder's terms choice) | one at its own layer | one asserted case per row of the decision table |
| Instrumentation (the view recorder, container wiring, header config) | none of its own | covered by its consumer's proof, with C929, C938 and C930 as the pass-through checks |

Evidence:

- `portal_decide`: whitelist of 3 pairs, link live, version current, status `sent`, reason bounds, 4 refusal causes -> decides (C919 to C926)
- `portal_view`: 7 states' data, revoked and unknown links, same result for any role -> decides (C910, C939, C940)
- `portalState`: 7 states from 4 inputs -> decides (C908)
- `buildAgreementDocument` terms: 4 sources -> decides (C934, C935)
- the actions: 5 and 6 results -> decide (C901 to C906, C919 to C924)
- closest analogues in the repo: `supabase/tests/service_included.sql` and `agreement_builder.sql` prove the transition and freeze RPCs at the boundary with labelled assertions; `app/auth/confirm/route.test.ts` proves a route with a mocked container; `domain/agreement` tests prove a pure decision table

Cost: about 36 proofs across 11 test files and one new SQL recipe. Without these rows, the anonymous RPCs, the first `anon` grants in the project, would be proven only by the one staff journey that happens to traverse them.

## Swept

- validation: C910 (token shapes), C921 and C922 (reason bounds), C926 (whitelist), C902 (no lines)
- failure modes: C902, C932 (renderer, `portal_view` and settings failures; no partial PDF), C923 (stale decision shows the current state), C903
- idempotency: C924 (a double decision writes one event and one outbox row), C928 (one view event per link), C903 (two sends leave one live link)
- authorization: C906 (viewer), C941 (anon cannot call staff RPCs or read the table), C940 (no cross-org reach), C939 (a signed-in member is treated as anonymous), C942 (RLS on `portal_links`)
- concurrency: C924 (two simultaneous decisions: the compare-and-set lets one through), C903 (two sends), C923 (a withdraw racing an accept: the second loses with `40001`). The two-call SQL tests run sequentially on one connection; the compare-and-set is the mechanism and `apply_agreement_transition` precedent (AD-015) proves it holds under a real race
- data lifecycle: C937 (backfill and seed re-run), C911 (terms stay with the version), C904 (a link is revoked, never deleted). n/a for deleting links: nothing deletes an agreement (CONTEXT.md)
- dependency failure: C932 (renderer and database failures); n/a for external services, because none is called
- state transitions: C908 (portal states), C919 and C920 (the three `sent` exits), C923 (every non-`sent` state refuses), C904 (reissue only from `sent`)
- observability: C927 (`agreement.viewed` is the view log), C932 (`console.error` on a 503). There is no metric or tracing requirement; rate limiting is open question 1

## Out of scope

- Everything in the plan's `Out of scope` (the emailed link, W1/W3/W5, contract generation, the pipeline "Not viewed" pill, expiry, multiple recipients, typed names, logo, in-app rate limiting, a view history)
- Rewriting the `service_included` and table-inventory assertions beyond the two edits C949 names

## Handoff

Measured with `wc -c` before any code:

- Read set (files edited or read in full): `application/ports/index.ts` 18.5 KB, `composition/index.ts` 6 KB, `domain/agreement/index.ts` + `document.ts` 12 KB, `infrastructure/supabase/agreements.ts` 10.7 KB, `database.types.ts` 29.7 KB (regenerated), `agreement-view.tsx` 7 KB, `agreement-actions.ts` 5 KB, `session.ts` + `session.test.ts` + `proxy.test.ts` 9.4 KB, `next.config.ts` 0.4 KB, the PDF adapter 7.6 KB and `pdf-route.test.ts` 4 KB, `seed.sql` 13.1 KB, `fixture.sql` 11 KB, `service_included.sql` 18 KB and its migration 6.7 KB, `eslint.config.mjs` 4.8 KB, `boundaries.test.ts` 7.6 KB, `runner.mts` 5 KB, `button.tsx` 1.1 KB: 175 KB = about 44k tokens.
- Writing: the migration (table, 5 RPCs, the system outbox writer, the terms freeze and backfill) about 9k; `customer_portal.sql` (about 25 labelled assertion groups) about 16k; domain, ports, adapter, actions and composition about 14k; the portal page, views, route and recorder about 16k; tests for them about 22k; docs (CONTEXT.md, STATE.md AD entries, ROADMAP) about 6k: about 83k.
- Live validation (C951, C952), two contexts, three sizes, snapshots: about 27k.
- Total about 154k, over the 150k budget. S1 and S5 (staff side, terms, the migration) come to about 62k with the read set; S2 to S4 and S6 enter the portal UI at about 125k, and the live run brings it to 154k.
- Proposed cut, if a handoff is chosen: after S5 (batch 1 = the migration, the SQL recipe, the staff actions and view, the terms freeze: C901-C907, C927-C928 and C933-C937, C941-C943, C945-C946, C942; batch 2 = the portal page, routes, actions and the live run: the rest).
- Mechanism: handoff (the user answered "approved" to the ask that recommended it, 2026-10-28). Batches run sequentially and only on green; the parent dispatches the Verifier after batch 2.

Expected follow-ons the build must report, not hide: `database.types.ts` regeneration; the AD entries (supersede AD-018, amend AD-016, add the four new decisions) in `STATE.md`; `CONTEXT.md` Customer review portal and Service agreement entries; the ROADMAP tick.

### Build record

#### Batch 1 (database and staff side, 2026-10-28)

- **Boundary:** C901-C907, C919-C928 (SQL part), C925/C926 SQL, C933-C937, C939 (SQL part), C940-C943, C945-C947, C950 and C949 (for what exists so far) are closed at the commits listed in the batch report. Left for batch 2: C908-C918, the action side of C919-C924, C929-C932, C938, C939 page side, C944, C948 final, C951, C952.
- **Migration:** `apply_migration` recorded `20261028053639` / `customer_portal`; the file is `supabase/migrations/20261028053639_customer_portal.sql`. C937 on the live project: 0 frozen versions without `terms` after the migration (before: 11 frozen, 0 with terms; 4 empty-snapshot drafts and 1 editable draft untouched).
- **Advisors (C950), `get_advisors` security:** `rls_enabled_no_policy` (`public.outbox`), `auth_leaked_password_protection`, and `anon_security_definer_function_executable` for exactly `portal_decide`, `portal_record_view`, `portal_view`. It also reports `authenticated_security_definer_function_executable` for the same three: the plan grants them to `authenticated` too (a signed-in member opening a link), so the lint follows. See the batch report.
- **Settled mid-build:**
  - Landing rows 7 (`private.issue_portal_link`, `private.org_terms`) and 8 (the shape of `portal_view`) were appended to the plan: the invoker functions cannot write `portal_links`, and batch 2 reads the document.
  - `portal_decide` builds the event payload itself and ignores every key of `p_payload` but `reason`.
  - `parseTerms` takes the snapshot and reads its `terms` key (C936 lists "`terms` absent" among its inputs).
  - The C19 pin stays at 17: it counts `orgs` plus `tests.tenant_tables()`, and `portal_links` is not in the fixture's tenant list (adding it would put it through the viewer, role and org-delete loops that assume a `delete`/`update` grant). The C35 pin (the public table list) is 18.
  - Consequences of door 3 and the new recipe, edited and listed: the `C864` tests of `document.test.ts` now feed a draft source (the settings' terms print only for the current draft); fixtures of `AgreementDetail` gained `terms` and `portalLink`; `scripts/test-db/runner.test.ts` counts 17 recipes and 19 SQL files; `demo_seed.sql` stores `terms` on the snapshot it hand-writes for C821 and adds C937.
- **Abandoned:** a `state` column computed in SQL (the page derives the seven states in `portalState`); relaxing `private.enqueue_outbox`; a `PortalReader` adapter in this batch (the port and `PortalView` type exist, batch 2 builds the adapter with the page).

#### Batch 2 (customer side, 2026-10-28)

- **Closed in code:** C908-C918, the action and page side of C919-C925, C929-C932, C938, C939, C944, C947, C948, C949 (`npm test` 73+ files green, `npm run test:db` 17 passed, 0 failed). Commits: `5fbe027` (state, contrast, ports, adapters, use cases, container), `4ebbb4e` (public prefix, headers, 404 gate), `df26db7` (page, form, actions, PDF route).
- **C948 deviation to read:** the route list shows `/review/[token]` as `◐` (partial prerender), not `ƒ`; every page in this app is `◐` because `cacheComponents` is on, and `dynamic = "force-dynamic"` is not allowed with it. `/review/[token]/pdf` is `ƒ`.
- **Landing rows added before the code:** 9 (customer-side ports and container surface), 10 (real `404`: a streamed page is `200`, a rewrite cannot set a status, so `proxy.ts` answers it; `loading.tsx` kept).
- **Live (dev server, Playwright, minted links through SQL because staff sign-in is a magic link):** run, as a customer on the live project: 375/768/1440 px open page (no horizontal scroll; Accept, Refuse, Request changes and Download PDF 44px at 375 and 768, 34px at 1440), touch taps with `hasTouch`/`isMobile` at 375 and 768, Refuse with an empty reason shows "Tell us why so Kettle Ridge Mechanical Ltd. can respond.", then with a reason moves to the refused view; Accept with the confirm step; Request changes; revoked link shows the `replaced` message and its PDF is `404`; console and network clean; response headers via `curl -I` on `next start`; unknown and malformed links `404`. Database after the runs: one `agreement.viewed` (no actor, no outbox row), one decision event with `via: "portal"` and one outbox row per agreement. NOT run: the staff half of C951 and C952 (Send as the demo owner, the pipeline card moving to "Accepted (awaiting signature)" or Refused, "Viewed by the customer on <date>", "Start version 2", "Get a new link" from the staff button) because the demo owner signs in by emailed magic link, which this non-interactive session cannot complete; and the pale-accent `#ffeb3b` button live (proven in `C912` unit tests: near-black text).
- **Advisors (C950), `get_advisors` security, 2026-10-28:** `rls_enabled_no_policy` (`public.outbox`), `auth_leaked_password_protection`, `anon_security_definer_function_executable` for exactly `portal_decide`, `portal_record_view`, `portal_view`, and `authenticated_security_definer_function_executable` for the same three (the plan's grants to `authenticated`). Not changed.
- **Left to the user:** the C19 pin (17, not 18) and the C950 wording about `authenticated`.

### Wording changes after the Verifier's round 1 (2026-10-28)

The Verifier's round 1 found C948, C949 and C950 unsatisfiable as worded, and C910's empty token unserved by the proxy. The user's only reply to the question was "continue", read as accepting the recommended rewording (C948 `ƒ` or `◐`, C949 C35 only, C950 both advisor lints on the same three functions, C910 four malformed shapes with the empty token left to the app's normal rule; round 2 of the same day replaced "framework's 404" with the signed-out redirect to `/login`). No assertion was changed; C19 stays 17. The user may overrule any of these.

**2026-10-28, round 2:** the user authorized rewording C910 so it is true: the proxy answers `404` for the four malformed shapes; an empty token `/review/` is not a review page and follows the normal signed-out redirect to `/login` (C944), replacing the "framework answers its own 404" text of commit 531326f. The user also confirmed the C948, C949 and C950 rewordings as written.

### Live record, staff halves (2026-10-28, run by the orchestrator, not the Verifier)

Run on `npm run dev` at localhost:3000 in the Playwright browser, which held the demo owner's session. Not an independent run: the Verifier has not seen it.

- **C951:** AG-1052 (draft, 2 lines, $3,870.00): "Send to customer" asked first, then the agreement read "Sent to customer", "Not viewed yet" and the link once with "Copy link". The customer page at 375, 768 and 1440 px: no horizontal scroll, Accept, Refuse, Request changes and Download PDF 44px tall at 375 and 768 and 34px at 1440, tenant name, address and phone, no product name, console clean (0 errors, 0 warnings), 3 POSTs all `200`. The staff page then read "Viewed by the customer on Oct 28, 2026". Accept asked "Accept this agreement?", then "You accepted this agreement on Oct 28, 2026." with no controls, and the pipeline moved AG-1052 into Accepted (3 to 4 cards, $35,690). `curl -I`: the PDF and a bad token carry `private, no-store`, `no-referrer`, `noindex` (bad token `404`); the page carries `no-referrer` and `noindex` and, in dev, Next's own `Cache-Control: no-store` (the production build's `private, no-store` was seen by the builder on `next start`).
- **C952:** "Get a new link" asked first, showed the new link once, and reset the staff line to "Not viewed yet"; the old link then read "This link has been replaced. Ask Kettle Ridge Mechanical Ltd. for the new one." with the phone and no content or controls. Refuse with an empty reason showed "Tell us why so Kettle Ridge Mechanical Ltd. can respond." with the field marked invalid. AG-1044 (`changes_requested`, from the builder's run) offers staff "Start version 2". Not run live: the pale `#ffeb3b` accent (unit-proven by C913 only) and a touch-emulated tap pass (the builder ran one).
- **Data left behind:** AG-1052 is now `accepted`, with two links (the first revoked) and its events. `seed.sql` restores the demo.
