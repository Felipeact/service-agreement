# Pricing page

Roadmap Phase 5 item 1: "Public `/pricing` page with plan and trade selection". The Onboarding section gives the shape: the visitor picks a plan and their trade (one or more, or "Other") before Checkout. Stripe plans, Checkout, the webhook, provisioning and the setup screen are the items after this one and are separate features (decision 22: one feature at a time).

## Problem

Nobody outside an existing workspace can learn what the product costs or begin. The only public page is `/login`, and sign-ups there are by invitation (AD-129: "Sign-ups are by invitation."); the only way a new contractor becomes a tenant today is that the owner invites them by hand or seeds them (AD-021). A contractor who hears about the product finds no price, no plan, no way to say which trade they are in, and nothing to click. Phase 5 cannot start without a front door that carries the choice (plan, trades) that Checkout and provisioning need. The roadmap gives no traffic, conversion or request figures, and there are no customers yet, so none are claimed here.

When this ships, a visitor opens `/pricing`, sees three plans priced in CAD with what each limits, ticks their trade or trades, and presses a plan's "Start 14-day trial". The choice is validated and handed to a `CheckoutStarter`. No Stripe adapter exists until the next feature (billing-checkout), so for now the hand-off answers "Sign-up isn't open yet" and nothing is charged or stored.

## Flow

Reuses the sign-in form's pattern (a Server Action with a typed form state read by `useActionState`, `app/login/actions.ts` and `state.ts`), the `Cents` money type and the container wiring, instead of a second action or formatting style.

1. visitor `GET /pricing` -> `proxy.ts` -> `updateSession` (exists) - `/pricing` is an exact public path, so a signed-out visitor is not sent to `/login` (door 1)
2. `app/pricing/page.tsx` (new, no door - placement per conventions) - renders the plans and trades from `domain/billing` (door 2); the form is a client component like `app/login/login-form.tsx` (exists)
3. visitor submits -> `app/pricing/actions.ts` (new, no door - placement) - reads `plan` and every `trade` from the `FormData`, calls the use case, turns its answer into the form state or a `redirect`
4. `makeStartTrial` in `application/use-cases` (new, no door - placement) - `parseCheckoutSelection` in `domain/billing` (door 2) validates and orders; then `CheckoutStarter.start(selection)` (door 3), whose only implementation until billing-checkout is `not_configured`; an `ok` answer with a non-https url counts as `unavailable`
5. `getBillingContainer()` in `composition/index.ts` (exists, new function - placement) - builds the use case; it reads no cookie, no database and no secret
6. out: a redirect to the Checkout url, or the page again with an inline refusal and the visitor's ticked trades kept

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `PlanKey`, `TradeCode`, `PLANS`, `TRADES`, `CheckoutSelection` - the plan catalog (key, name, monthly price in cents, live-agreement limit, AI-import allowance) and the trade list; live in `web/domain/billing`. The plan-limits item and the provisioning item will read the same catalog, so it is one source |
| domain | existing term: "public path" meant `/login` and `/auth/confirm` exactly plus four prefixes (AD-072). It gains the exact `/pricing`. Branches on it today: `redirectTarget` in `infrastructure/supabase/session.ts` and the proxy tests (`proxy.test.ts`, `proxy.portal.test.ts`, `proxy.signing.test.ts`, `proxy.webhooks.test.ts`, `proxy.automation.test.ts`). Amends AD-072; a new AD is written at the end of the build |
| domain | existing term: "HVAC". `app/product-copy.test.ts` C2305 fails any non-test source under `app`, `components`, `application`, `domain`, `infrastructure` or `lib` that contains the word "HVAC" (case-sensitive). The trade list therefore labels the first trade "Heating and cooling" and keeps the code `hvac`, which the scan does not match. No change to C2305 |
| tests | `domain/purity.test.ts` C2021 fails an "equipment" string under `app/` or `components/` that skips `itemText`. A visitor has no org word, so the page says "service lists" and never "equipment", as trade-neutral-copy did for sign-in |
| stored data | nothing to migrate: the feature stores nothing. The selection is not persisted; billing-checkout will carry it on the Checkout session as metadata |
| not changed | `/` still redirects to `/pipeline` (a signed-out visitor still lands on `/login`), the sign-in page, the `(app)` shell, every database object, and every existing route |

## Relations

`None - no stored-data shape change`

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /pricing` | none | the page: three plans, a trades fieldset, one submit button per plan | `200` |
| `POST /pricing` (the Server Action) | `plan` (one of `starter`, `team`, `business`), `trade` (repeatable; any of `hvac`, `plumbing`, `electrical`, `other`) | a redirect to the Checkout url, or the page again with one inline refusal and the ticked trades | `303`, `200` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. A new unauthenticated route | `const PUBLIC_PATHS = ["/login", "/auth/confirm", "/pricing"]` in `infrastructure/supabase/session.ts` (an exact path, not a prefix) | a `/pricing/` entry in `PUBLIC_PREFIXES`: it would open every future `/pricing/...` route to anonymous callers by accident, where an exact path keeps each public page a deliberate edit |
| 2. Plan and trade identifiers | `PLAN_KEYS = ["starter", "team", "business"] as const`; `TRADE_CODES = ["hvac", "plumbing", "electrical", "other"] as const`. The first three trade codes equal `private.catalog_packs.pack` (forced: `seed_org_catalog(p_org, p_pack)` takes that code, AD-154); `other` is not a pack. Display names ("Team", "Heating and cooling") are separate fields | display names as keys: a rename or a copy edit would break the Stripe metadata and org rows that carry the key. A numeric tier: reordering plans would change what a stored value means |
| 3. The seam billing-checkout builds against | `type CheckoutSelection = { plan: PlanKey; trades: TradeCode[] }`; `CheckoutStarter.start(selection: CheckoutSelection): Promise<{ ok: true; url: string } \| { ok: false; code: "not_configured" \| "unavailable" }>` in `application/ports` | passing the `FormData` or a Stripe price id: couples the adapter to the form and the price table. Returning a Stripe session object: carries a vendor type across the port (AD-014) |

- Nothing else in this change is hard to reverse: the price points, limits, wording and layout are edits to one catalog file and one page.
- Door 2 reaches past this feature: the plan keys will be written on Stripe prices and, in the provisioning item, on the org. A key can be added later; once a tenant carries one, it cannot be renamed without a data migration. It belongs in `STATE.md` as an AD at the end of the build.

## Criteria

### S1: Anyone can read the plans (P1)

A signed-out visitor reaches `/pricing` and reads what each plan costs and limits, with no account.

**Acceptance Criteria**

1. WHEN a signed-out visitor requests `/pricing` THEN the system SHALL answer `200` with the page and no redirect to `/login`
2. WHEN a signed-in member requests `/pricing` THEN the system SHALL answer `200` with the page and no redirect to `/pipeline`
3. IF a signed-out visitor requests `/pricing/x` or `/pricingx` THEN the system SHALL redirect to `/login`
4. The page SHALL list the plans in the order Starter, Team, Business, each with its monthly price in CAD in whole dollars ($49, $99, $199), its live-agreement limit (15, 60, 200), its AI imports a month (10, 40, 120) and "Unlimited seats"
5. The page SHALL take every plan name, price and limit from `PLANS` in `domain/billing`, with none repeated as a literal in the page source
6. The page SHALL state once, above the plans, "14-day free trial. A card is required to start, and billing is monthly after the trial."
7. The page SHALL show none of the strings "trusted by", "most popular", "best value", "testimonial" or "save" (case-insensitive) in its rendered text, because the product has no customers or measured results to claim
8. The page SHALL contain a link labelled "Sign in" to `/login`
9. The page's `<title>` SHALL be "Pricing · Service Agreement", and it SHALL show no "equipment" word

**Independent test:** open `/pricing` signed out and signed in, read the three plans and the trial line; request `/pricing/x` signed out.

### S2: Pick trades and a plan and be handed on (P1)

The visitor ticks their trades, presses a plan, and the choice reaches the `CheckoutStarter` validated, or is refused in words.

**Acceptance Criteria**

10. The form SHALL offer the trades "Heating and cooling", "Plumbing", "Electrical" and "Other", in that order, as checkboxes named `trade` with the values `hvac`, `plumbing`, `electrical`, `other`, none checked on first load
11. The form SHALL offer one submit button per plan, named `plan` with the value `starter`, `team` or `business`, whose visible text is "Start 14-day trial" and whose accessible name is "Start 14-day trial, <plan name> plan"
12. WHEN the form is submitted with a known plan and one to four known trades THEN the system SHALL call `CheckoutStarter.start` exactly once with `{ plan, trades }`, the trades de-duplicated and in the order of `TRADE_CODES`
13. WHEN the starter answers `{ ok: true, url }` with an `https:` url THEN the system SHALL redirect the visitor to that url
14. IF no trade is ticked THEN the system SHALL not call the starter and SHALL show "Choose at least one trade." beside the trades
15. IF the plan, or any trade value, is not in `PLAN_KEYS` or `TRADE_CODES` THEN the system SHALL not call the starter and SHALL show "Choose a plan and your trades again."
16. IF the starter answers `not_configured` THEN the system SHALL show "Sign-up isn't open yet. Please check back soon."
17. IF the starter answers `unavailable`, throws, or answers `ok` with a url that is not `https:` THEN the system SHALL show "We couldn't start sign-up. Try again in a minute." and log the cause once on the server, with no selection or url in the log
18. WHILE a refusal is shown the system SHALL keep the trades the visitor ticked
19. WHILE a submit is pending the system SHALL disable all three plan buttons and show "Starting…" on the one pressed
20. The system SHALL answer `not_configured` for every selection from the container's `checkout` until billing-checkout replaces it, and SHALL read no cookie, database or secret to do so
21. IF a refusal is shown THEN it SHALL sit in an element with `role="alert"`

**Independent test:** on `/pricing`, press a plan with nothing ticked (AC 14), tick two trades and press Team (AC 16 today); a unit test drives `makeStartTrial` with a fake starter for AC 12, 13, 15 and 17.

### S3: It works on every screen (P1)

**Acceptance Criteria**

22. WHILE the page is shown at 375, 768 or 1440 px wide the system SHALL show no horizontal scroll and no cut-off or overlapping content
23. WHILE the page is shown at 375 or 768 px wide the system SHALL give each button, checkbox and link a touch target of at least 44 by 44 px
24. WHILE the page is shown below 1024 px wide the plans SHALL stack in one column in the order of AC 4, and from 1024 px they SHALL sit in three columns

**Independent test:** open `/pricing` in the Playwright browser at 375, 768 and 1440 px and tap every control (AGENTS.md validation).

## Out of scope

| Excluded | Why |
| --- | --- |
| Stripe adapter, Checkout session, trial terms, Customer Portal, webhook | Roadmap Phase 5 item 2 (billing-checkout). This feature stops at the `CheckoutStarter` seam |
| Workspace provisioning, owner invitation, seeded packs, "Setting up your workspace" | Phase 5 items 3 and 6 |
| Refusing an email that already belongs to an org | Phase 5 item 7. This page collects no email; Stripe's page does. Asking for it here would let the page answer whether an account exists, which AD-019 avoids by design |
| Enforcing plan limits (live agreements, AI imports) | Phase 5 item 8. This feature only shows the numbers; the next features read the same `PLANS` |
| A feature comparison table, per-plan templates or reports | Decisions 10 and 20: plans limit volume only, so there is nothing else to compare |
| An annual price, a "two months free" claim, a discount or a "most popular" plan | The roadmap calls the annual option "worth testing", not decided, and PRODUCT.md forbids invented claims |
| "Other" trade drafting (Claude builds a catalog) | Phase 5 item 5. The page only records that "Other" was ticked |
| A link to `/pricing` from the sign-in page, the app shell or any marketing home | The page is not linkable to the public until price points and Checkout are decided (open questions 1 and 2) |
| A marketing home page, a brand name or logo work | The brand is undecided (PRODUCT.md); the header reuses the working name and `ProductMark` |
| Quebec, French, other currencies | Decision 3: Canada outside Quebec at launch; money is in CAD |
| Remembering the choice across visits | The selection lives for one submit; billing-checkout carries it on the Checkout session |

## Assumptions

Defaults that are not already a numbered criterion.

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Price points, limits and plan names | The roadmap's draft table: Starter $49, Team $99, Business $199 a month in CAD; 15, 60, 200 live agreements; 10, 40, 120 AI imports; unlimited seats | It is the only proposal on record; decision 10 says the price points still need the owner and are to be tested with a pilot contractor. They live in one catalog file, so changing them is an edit | n |
| Trade labels | "Heating and cooling", "Plumbing", "Electrical", "Other" | The word "HVAC" fails C2305 in source under `domain/`, and changing an approved guard for one label is not this feature's call. The reviewer may prefer "HVAC" (then C2305 gets one named allowlist row, as C2021 has) | n |
| "Other" with others | A visitor may tick "Other" together with any packs | Decision 6: several trades per tenant; a mixed contractor with one trade we do not ship is plausible | n |
| Trade list is a constant, not read from the database | `TRADES` in `domain/billing`; its first three codes are the released packs (`hvac`, `plumbing`, `electrical`) | An anonymous read of `private.catalog_packs` would be a new `anon` grant (AD-068), a door this page does not need. The risk is a drift: if a listed pack were unreleased, `seed_org_catalog` raises `55000` after payment. The provisioning item must handle that; fire and elevator packs are not listed because they are not released | n |
| What "live agreements" and "AI imports" mean on the page | One line under each figure: "Live agreements: in progress, or sent and waiting for the customer." and "AI imports: customer lists read by AI each month." | AD-052 already treats draft, sent and changes_requested as live; Phase 5 item 8 defines the counted unit and may amend the line. Imports say "customer lists" because the page cannot use the org's word | n |
| Taxes | The page shows the price with no tax statement | Whether prices include GST/HST and how Stripe adds it is a billing-checkout decision; the page says nothing it cannot back | n |
| No preselected plan | Every plan has its own button and none is highlighted | A highlight is a claim (AC 7); one click per plan is one fewer step | n |
| Design | Built with `/impeccable` to DESIGN.md and PRODUCT.md, on existing tokens (AD-002), the display face and `ProductMark`; no new token | AGENTS.md rule for UI work | n |
| Server Action, not an API route | `POST /pricing` is a Server Action | The sign-in form already does this, and a form posting to itself works without JavaScript | n |

**Open questions:** four, none blocks the build.

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | Price points and limits (decision 10): are $49, $99 and $199 with 15, 60 and 200 live agreements the numbers a visitor should see? | Do not link `/pricing` from anywhere public; the page shows the draft table meanwhile |
| 2 | blocks go-live | The button answers "not open yet" until billing-checkout ships (needs a Stripe account, products and keys from the owner) | The page can be built and checked now, and must stay unlinked |
| 3 | open | Does the price shown include tax? | The page shows no tax line (assumption above); billing-checkout decides with Stripe Tax |
| 4 | open | "Heating and cooling" or "HVAC" as the label | The page uses "Heating and cooling" (assumption above) |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/pricing` | empty state | n/a - the page is static content, with no data that can be missing |
| screen `/pricing` | loading state | AC 19 (the pending submit); the page itself is prerendered |
| screen `/pricing` | error state | AC 14, AC 15, AC 16, AC 17, AC 21 |
| screen `/pricing` | unauthorised state | AC 1, AC 2 (public to everyone, signed in or not); AC 3 (only the exact path) |
| screen `/pricing` | density and ordering | AC 4 (plan order and the five figures), AC 10 (trade order), AC 24 (stacking) |
| screen `/pricing` | destructive action confirms | n/a - nothing on the page deletes or charges; the redirect to Checkout is where money is confirmed, in the next feature |
| screen `/pricing` | responsive and touch | AC 22, AC 23, AC 24 |
| API `POST /pricing` (Server Action) | response shape and error shape with codes | AC 13 (redirect), AC 14 to AC 17 (four refusal texts), AC 21 (announced) |
| API `POST /pricing` | who may call it | AC 1, AC 2: anyone, with no session |
| API `POST /pricing` | versioning | n/a - a Server Action's id is generated by the framework and has no consumer outside this app |
| API `POST /pricing` | rate limit | n/a - today it does no work (AC 20: it reads nothing and writes nothing). Creating Stripe Checkout sessions is real work and an abuse path; billing-checkout must decide a limit before it replaces `not_configured` |
| document `/pricing` copy | structure, tone, depth, next step | AC 4, AC 6 (what a plan is and the trial), AC 7 (no invented claims), AC 9 (no "equipment"), AC 11 (the next step is a plan button), AC 8 (sign in for existing users) |
| collection of trades | grouping, order, duplicates, the exception | AC 10 (fixed order), AC 12 (de-duplicated, fixed order), "Other" allowed with others (Assumptions) |
| collection of plans | grouping, order | AC 4 (fixed order; volume is the only axis, decisions 10 and 20) |

## Sources

- `ROADMAP.md` Phase 5 item 1, Onboarding step 1, Pricing (draft) - the item, "the visitor picks a plan and their trade (one or more, or 'Other') before Checkout", the draft table
- `ROADMAP.md` Decisions 6, 8, 10, 20, 22 - several trades per tenant, the 14-day card-up-front trial, volume-only plans and open price points, one feature at a time
- `PRODUCT.md` Evidence on Hand - "Future work must not invent" customers, testimonials, metrics or pricing
- `.specs/STATE.md` AD-072 (public paths), AD-129 (invitation-only sign-up), AD-154 (pack codes), AD-014 (no vendor types across ports)
