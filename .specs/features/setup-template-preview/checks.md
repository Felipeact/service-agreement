# Setup template preview checks

Profile: ui
Plan: `.specs/features/setup-template-preview/plan.md`

No screenshot binds this feature. `plan.md` Criteria, Observable and Flow are the binding source for the screen.

17 checks in 3 slices · 0 one-way doors · 0 open

## How proofs run

- **vitest** runs from `web/`; every new test name starts with its check id and a colon (`C5500:`). This feature numbers from C5500 (template-flow ends at C5439). `npx vitest run <file> -t "C5500:"` selects one.
- New test files: `web/components/setup/starter-templates.test.tsx`, `web/domain/contract/starter-preview.test.ts`; new cases are added to `web/app/setup/page.test.ts` and `web/components/setup/setup.test.ts`.
- The contract preview is `buildStarterContractPreview(settings, body = SYSTEM_CONTRACT_BODY)` in `web/domain/contract/starter-preview.ts` and returns `RenderedBlock[]` (the optional body exists so C5509 can name `{{customer.name}}` and `{{site.name}}`; placement of the file is the builder's, the name and arguments are what the tests call).
- **Live** checks (C5513) follow AGENTS.md: Playwright MCP at 375, 768 and 1440 px against the demo owner, in one signed-in context, with `setup_completed_at` set null for the run and restored after. Author-run; a Verifier cannot observe them.
- `<feature base>` is the commit before the first feature commit; the builder records it under Handoff.

## Checks

### S1 - The owner sees their agreement on the setup screen · 3 files · 17 KB · ~6k

**C5500** - `SetupView` renders a section headed "Your starter templates" after the profile card (`id="profile-title"`) and before the catalog review (`id="catalog-title"`), by position in the markup (AC 1)
Proof: `npx vitest run components/setup/setup.test.ts -t "C5500:"`

**C5501** - With an empty catalog (`groups = []`) the section is still rendered, after the profile card and before the empty-catalog notice (AC 14)
Proof: `npx vitest run components/setup/setup.test.ts -t "C5501:"`

**C5502** - On mount the section makes exactly one `POST /templates/preview` whose JSON body equals `templateFormFromBody(SYSTEM_AGREEMENT_BODY)`, and shows the returned PDF in an `iframe` on a blob URL (AC 2)
Proof: `npx vitest run components/setup/starter-templates.test.tsx -t "C5502:"`

**C5503** - While the request is unanswered the section shows "Updating preview…" and the profile form's inputs are not disabled (AC 3)
Proof: `npx vitest run components/setup/starter-templates.test.tsx -t "C5503:"`

**C5504** - When the request answers 503, rejects, or answers 200 with `text/html`, the section shows "Preview unavailable." and a "Try again" button, and the profile form's Save and Skip buttons are still rendered and enabled; pressing Try again makes a second request (AC 4)
Proof: `npx vitest run components/setup/starter-templates.test.tsx -t "C5504:"`

**C5505** - `buildTemplatePreviewDocument(SYSTEM_AGREEMENT_BODY, settings, logo, words)` carries the settings' legal name, address and phone, the logo, the mark `TEMPLATE PREVIEW`, and the org's saved terms (AC 5)
Proof: `npx vitest run domain/contract/starter-preview.test.ts -t "C5505:"`

**C5506** - The section says "Shown with the details you have saved so far."; and when the profile form is in the `invalid` state holding an unsaved province, the contract half still shows the saved province from `settings`, not the typed one (AC 6)
Proof: `npx vitest run components/setup/setup.test.ts -t "C5506:"`

### S2 - The owner sees their contract wording · 2 files · 8 KB · ~3k

**C5507** - For the settings a new org has (payment 30 days, cancellation 30 days, repair 0%, CPI cap 5%, threshold 5%, renewal notice 30 days, province BC, term 12 months), `buildStarterContractPreview` returns the seven blocks of `SYSTEM_CONTRACT_BODY` in order with every variable filled: heading "Terms", then "Invoices are payable within 30 days.", "Either party may cancel this contract with 30 days' written notice.", "Repair work is discounted by 0%.", "The annual price may rise with CPI, capped at 5%.", "This contract is governed by the laws of British Columbia." and the renewal sentence (AC 7)
Proof: `npx vitest run domain/contract/starter-preview.test.ts -t "C5507:"`

**C5508** - Table-driven over the three settings that can be unset (`paymentDays`, `cancellationNoticeDays`, `governingProvince` set to null one at a time): the clause that uses it is absent from the output and the other six blocks remain, in order (AC 8)
Proof: `npx vitest run domain/contract/starter-preview.test.ts -t "C5508:"`

**C5509** - With a body containing `{{customer.name}}` and `{{site.name}}`, the output reads "Sample Customer Ltd." and "Sample Site" (AC 7)
Proof: `npx vitest run domain/contract/starter-preview.test.ts -t "C5509:"`

**C5510** - The rendered contract half contains the text "Sample wording, not a signed contract" and contains no `iframe`, no `<button` and no link whose `href` contains `pdf` or `sign` (AC 9)
Proof: `npx vitest run components/setup/starter-templates.test.tsx -t "C5510:"`

### S3 - The section changes nothing and is reachable · 3 files · 6 KB · ~2k

**C5511** - `SetupForRequest` for an owner renders with a container whose every write method throws, and the section appears (AC 10, read only)
Proof: `npx vitest run app/setup/page.test.ts -t "C5511:"`

**C5512** - Save and Skip behave as before: `web/app/setup/actions.ts` and `web/app/setup/draft-actions.ts` are byte-identical to `<feature base>` (AC 10)
Proof: `git diff --exit-code <feature base> -- web/app/setup/actions.ts web/app/setup/draft-actions.ts`

**C5513** - Live at 375, 768 and 1440 px as the demo owner with setup pending: the PDF shows in the frame, the section's halves are stacked at 375 px, the page has no horizontal scroll (`scrollWidth <= innerWidth`), each "Customize in Templates" link is at least 44 px high at 375 px, and the console shows no errors (AC 11, 12, author-run)
Proof: Playwright MCP run recorded under `## Live run` in this file's Handoff by the author

**C5514** - Each half renders one link with the text "Customize in Templates" and `href="/templates"`, with the same tap-area classes the screen's other inline links use (`py-3.5 -my-3.5 lg:py-0 lg:my-0`) (AC 11)
Proof: `npx vitest run components/setup/starter-templates.test.tsx -t "C5514:"`

**C5515** - `SetupForRequest` for an estimator redirects to `/pipeline` and reads no settings, and for a signed-out visitor redirects to `/login` (AC 13)
Proof: `npx vitest run app/setup/page.test.ts -t "C5515:"`

**C5516** - The preview route is unchanged: `web/app/(app)/templates/preview/route.ts` and `route.test.ts` are byte-identical to `<feature base>` (Surface, reused as is)
Proof: `git diff --exit-code <feature base> -- "web/app/(app)/templates/preview/route.ts" "web/app/(app)/templates/preview/route.test.ts"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| Criteria (14) | AC 1 C5500 · AC 2 C5502 · AC 3 C5503 · AC 4 C5504 · AC 5 C5505 · AC 6 C5506 · AC 7 C5507, C5509 · AC 8 C5508 · AC 9 C5510 · AC 10 C5511, C5512 · AC 11 C5513, C5514 · AC 12 C5513 · AC 13 C5515 · AC 14 C5501 | - |
| Unset settings that drop a clause (3) | `paymentDays` C5508 · `cancellationNoticeDays` C5508 · `governingProvince` C5508 | - |
| Failure modes of the preview request (3) | 503 C5504 · rejected fetch C5504 · 200 `text/html` C5504 | - |
| Viewports (3) | 375 px C5513 · 768 px C5513 · 1440 px C5513 | - |
| Roles at `/setup` (3) | owner C5511 · estimator C5515 · signed out C5515 | - |
| `POST /templates/preview` statuses (5) | 200 C5516, C5502 · 401 C5516 · 403 C5516 · 422 C5516 · 503 C5516, C5504 | - |
| Screen sections in order (3) | profile C5500 · starter templates C5500 · catalog or empty notice C5500, C5501 | - |

- Claims naming a status code or response shape: C5502, C5504, C5516 - C5502 and C5504 cross the `fetch` boundary the frame uses; C5516 pins the route's own proofs by leaving them unchanged
- No other check claims more than the single case its proof exercises
- C5513 is author-run and cannot be observed by a Verifier

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, not reached across a boundary (`buildStarterContractPreview`: omit a clause with no value) | one at its own layer | one asserted case per unset setting (C5508) and the filled case (C5507) |
| Entry point that decides nothing (`SetupForRequest`, the new section) | one at the boundary | each role (C5511, C5515), each frame state (C5502 to C5504) |
| Instrumentation, pass-throughs (`SetupView` passing props on) | none of its own | covered by C5500 and C5501 |

Evidence:

- `web/domain/contract/template.ts` `renderBlocks`: one conditional (a clause whose variable is null is dropped) -> decides, already proven at its own layer by `template.test.ts`; the new function adds the settings-to-values mapping
- `web/app/setup/page.tsx`: one branch on member status, one on `setupEntry` -> entry point
- closest analogue: `web/app/setup/page.test.ts` and `web/components/templates/template-preview-frame.test.tsx`, same shapes, already proven at these levels

Cost: 4 test files, about 14 proofs at their own layer. Without these rows the clause-dropping table is proven only by a path that happens to traverse it.

## Swept

- validation: n/a - the section takes no input; the frame posts a constant body that the route already validates (C5516 keeps that route unchanged)
- failure modes: C5504
- idempotency: n/a - viewing writes nothing, and a second request only draws a second PDF (C5511)
- authorization: C5515 and existing - the preview route's owner and admin gate (C5516)
- concurrency: n/a - there is no shared state; the frame cancels a superseded request (existing, template-flow, in `template-preview-frame.test.tsx`)
- data lifecycle: n/a - nothing is stored
- dependency failure: C5504 (the renderer or the route failing is the 503 case)
- state transitions: n/a - no status changes; the frame's idle, updating, unavailable states are C5503 and C5504
- observability: existing - the route logs a failed render with the org id (`route.ts` catch); this feature adds no logging

## Out of scope

See plan.md Out of scope.

## Handoff

- Files touched, by `wc -c`: `components/setup/setup-view.tsx` 7.8 KB, `app/setup/page.tsx` 1.9 KB, `components/templates/template-preview-frame.tsx` 5.2 KB (read, not expected to change), `domain/contract/template.ts` 7.3 KB (read), plus the new component, domain function and four test files at about 20 KB. About 42 KB, so about 11k tokens: S1 3k, S2 3k, S3 2k, tests and reading the rest. Far under the 150k budget - one builder, no ask.
- Mechanism: one builder.
- The builder lists in this section every first-login-setup assertion it has to change for the new section, before changing it (plan Impact).

- **Boundary:** C5500-C5512, C5514-C5516 closed at the feature commit; `<feature base>` = `c40c4df`. C5513 (live pass) not run: it needs the demo org's `setup_completed_at` set null, a hosted data change that waits for the owner's go-ahead.
- **Settled mid-build:** `StarterTemplates` computes the contract blocks from the `settings` prop, so `SetupView` props did not change (plan Impact updated). `page.test.ts` now mocks the container as a Proxy whose unread members throw, which is what C5511 asserts.
- **Abandoned:** nothing.
