# QA P1/P2 batch checks

Profile: ui

## Intent

The live QA report (2026-11-16) listed P1 and P2 items. This batch does the ones that are code-only and need no new database objects, no account and no real device: import type matching (token and abbreviation matching plus an alias list), quantity rows, duplicate rows skipped by default, remembered corrections (a mapped spelling is saved as a synonym of the type), the site copy that does not match reality (PDF attachment, "ours never appears"), `robots.txt` and a sitemap, security headers, and a visible fallback link on the signing page. Everything else is listed under ROADMAP Phase 5.9 owner actions or Phase 6 follow-ups.

14 checks · 1 migration (not applied) · 0 open

## Checks

**C7001** - `matchAssetType` types "Boiler (condensing)", "Boiler cond.", "Chlr", "Exh. fan", "Backflow DCVA 2in" and "Backflow RPZ 4\"" to Boiler, Boiler, Chiller, Exhaust fan, Backflow preventer, Backflow preventer, given types Boiler, Chiller, Exhaust fan, Backflow preventer, Rooftop unit
Proof: `npx vitest run domain/imports/matching.test.ts -t "C7001:"`

**C7002** - `matchAssetType` still gives `null` for "Water heater", "Sump pump", "Grease interceptor" and "" (no type of the org), and an exact code or name or synonym still wins over a token match
Proof: `npx vitest run domain/imports/matching.test.ts -t "C7002:"`

**C7003** - `matchAssetType` gives `null` when two types fit equally: "Boiler feed" with types "Boiler feed pump" and "Boiler feed tank" (no guess)
Proof: `npx vitest run domain/imports/matching.test.ts -t "C7003:"`

**C7004** - `splitQuantity` reads "VAV boxes (qty 24)" as `{label: "VAV boxes", qty: 24}`, "x 6 Exhaust fans" and "Exhaust fans x6" as 6, "24 x VAV boxes" as 24, and returns `null` for "VAV boxes", "Boiler 2" and a quantity above 50 or below 2
Proof: `npx vitest run domain/imports/matching.test.ts -t "C7004:"`

**C7005** - Extraction expands a row whose type text carries "qty 24" into 24 rows with the label as its type text and unit numbers 1 to 24, each at `medium` confidence at most
Proof: `npx vitest run application/use-cases/extract-import.test.ts -t "C7005:"`

**C7006** - A row that repeats an earlier row of the same job (same typed type, same unit # ignoring case and punctuation, in the same chunk or an earlier one) is stored skipped; rows with no type or no unit #, the same unit under another type, and the first of a key stay included
Proof: `npm run test:db import_duplicates` (assertions `C7006`; the migration `20261116140000_import_duplicates_skipped.sql` is replayed inside the rolled-back transaction, it is not applied to the hosted project)

**C7007** - Mapping an unmatched spelling to a type appends that spelling to the type's synonyms once, and does not append a spelling the type already holds or fail the mapping when the synonym write is refused
Proof: `npx vitest run infrastructure/supabase/import-review.test.ts -t "C7007:"`

**C7008** - The site no longer says the email carries "A branded PDF and a review link", and no longer says "Ours never appears"
Proof: `npx vitest run components/site/site-pages.test.ts -t "C7008:"`

**C7009** - `/robots.txt` answers allow for the public pages and disallows `/review/`, `/sign/`, `/api/` and the app routes, and names the sitemap; `/sitemap.xml` lists every public page and no app page
Proof: `npx vitest run app/robots.test.ts -t "C7009:"`

**C7010** - `/robots.txt` and `/sitemap.xml` are reachable signed out
Proof: `npx vitest run infrastructure/supabase/session.test.ts -t "C7010:"`

**C7011** - Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (the review and signing paths keep `no-referrer`), `X-Frame-Options: DENY` and `Strict-Transport-Security`
Proof: `npx vitest run next.config.test.ts -t "C7011:"`

**C7012** - The signing page shows a visible "Open signing page" link to the same signing address, in addition to the embedded form
Proof: `npx vitest run components/signing -t "C7012:"`

**C7013** - A browser run of `/robots.txt`, `/sitemap.xml` and the signing fallback at 375, 768 and 1440 shows the expected body, no horizontal scroll and no console errors
Proof: live Playwright run

**C7014** - The existing full test set is no worse: the failures that existed before this batch (kanban, shell, pricing, purity listing agreements-list and pipeline-view, vocabulary C2019) are the only failures
Proof: `npx vitest run` (compared with the list in the p0 verification report)

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| report items matched (6) | Boiler (condensing) C7001 · Boiler cond. C7001 · Chlr C7001 · Exh. fan C7001 · Backflow DCVA C7001 · Backflow RPZ C7001 | - |
| must stay unmatched (4) | Water heater C7002 · Sump pump C7002 · Grease interceptor C7002 · empty C7002 | - |
| quantity forms (6) | qty N C7004 · x N prefix C7004 · x N suffix C7004 · N x C7004 · none C7004 · out of range C7004 | - |
| security headers (4) | nosniff C7011 · referrer C7011 · frame C7011 · HSTS C7011 | - |
| public discovery files (2) | robots C7009 · sitemap C7009 | - |
| startup config: public paths (1 place) | `session.ts` C7010 | - |

- Claims naming a response shape: C7009 and C7011 - each proof reads the actual output

## Swept

- validation: C7002, C7003, C7004
- failure modes: C7007
- idempotency: C7007
- authorization: existing - the synonym write is the member's own client; RLS decides who may edit types, and a refusal is ignored (C7007)
- concurrency: n/a - extraction already records chunks in order under a cursor
- data lifecycle: n/a - no new stored data
- dependency failure: C7007
- state transitions: n/a - no status changes
- observability: n/a - no logging requirement

## Known limits

- Two quantity rows of the same type ("VAV boxes (qty 24)" then "(qty 12)") both number their units from 1, so the second set starts skipped as repeats; the rows stay visible and one click unskips them (C7005 x C7006)
- A one-word text that is the first word of exactly one type ("Exhaust" for "Exhaust fan") types to it
- Round 2 (after verifier round 1): extra words in the text must be explained (in brackets, an abbreviation marked with a period, an alias, a size, or a short qualifier list), so "Boiler feed pump" and "Sump pump" no longer type as Boiler or Pump (C7002); an alias alone types a row (C7001); a short form fitting two whole types gives no guess (C7003)

## Handoff

- one builder, about 12 files, about 40k, under the 150k budget
