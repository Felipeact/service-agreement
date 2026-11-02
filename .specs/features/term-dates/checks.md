# Term dates - checks

Profile: light
Plan: `.specs/features/term-dates/plan.md`

36 checks in 4 slices · 7 one-way doors · 0 open, 0 block

## How proofs run

- **vitest** - run from `web/`. Every test name starts with its check id and a colon (`C1130:`). This feature numbers
  from C1130, because seasonal-tasks owns up to `C1128:`.
  - Pure domain code (`validateOrgSettings`, `validateAgreementTerm`, `parseTerms`, the term and date labels,
    `termsOf`, `buildAgreementDocument`) is tested in `domain/org-settings` and `domain/agreement` with literal values.
  - Adapters are tested in `infrastructure/supabase` with the recording `stubClient`.
  - Components are asserted with `renderToStaticMarkup`: `SettingsView` in `components/settings`, `AgreementView` in
    `components/agreements`, `ReviewView` in `components/review`.
  - The PDF is read with `pdf-text.testing.ts` (`pdfPages`), as `schedule.test.ts` does.
  - `portalDocument` is tested in `application/use-cases`, as seasonal-tasks' C1123 does.
- **test:db** - `npm run test:db <recipe>` in `web/` (AD-026), against project `gnxebrtcpbujhvcamtoe`, rolled back, so
  they pass only once the migration is applied there. New assertions go into the existing `domain_constraints.sql`,
  `agreement_builder.sql`, `customer_portal.sql` and `demo_seed.sql`, labelled with their check ids. No new recipe, so
  the runner's pinned counts (C830, C203-C212) do not move.
- **mcp** - a Supabase MCP `execute_sql` on project `gnxebrtcpbujhvcamtoe`, before and after the migration is applied.
  The query and its result go in the Handoff.

Terms:
- "the term writer" is `public.save_agreement_term(p_agreement_id, p_term_start, p_term_months)`.
- "the renewal keys" are `renewalNoticeDays` and `cpiRenegotiationThresholdPct` in `snapshot.terms`.
- "the term line" is the text `Term: <start> – <end> (<months> months)`; the dash is U+2013.
- "the renewal row" is the AC 20 sentence under the label `Renewal`.

## Checks

### S1 - tenant renewal settings

**C1130** - After the migration, every `org_settings` row on the project has `default_term_months = 12`,
`renewal_notice_days = 30` and `cpi_renegotiation_threshold_pct = 5.00`: the count of rows that differ is `0` (AC 1)
Proof: mcp `execute_sql` (query and result recorded in the Handoff)

**C1131** - Each of these `org_settings` updates is refused with `23514`: `default_term_months` 0 and 61,
`renewal_notice_days` -1 and 366, `cpi_renegotiation_threshold_pct` -0.01 and 100.01. The edges 1, 60, 0, 365, 0 and
100 are accepted. A fresh `org_settings` insert with none of the three columns gets 12, 30 and 5.00 (AC 1, AC 2, door 2)
Proof: `npm run test:db domain_constraints` (assertions `C1131`)

**C1132** - `validateOrgSettings` accepts `defaultTermMonths` `"1"`, `"12"`, `"60"`, `renewalNoticeDays` `"0"`,
`"30"`, `"365"`, `cpiRenegotiationThresholdPct` `"0"`, `"5"`, `"4.75"`, `"100"`, and returns them as numbers. It gives
`Default term must be a whole number of months from 1 to 60` for `""`, `"0"`, `"61"`, `"1.5"`, `"abc"`;
`Renewal notice must be a whole number from 0 to 365` for `""`, `"366"`, `"-1"`, `"2.5"`; and
`CPI renegotiation threshold must be a number from 0 to 100 with at most two decimals` for `""`, `"100.01"`, `"5.123"`,
`"-1"` (AC 3, AC 4)
Proof: `npx vitest run domain/org-settings -t "C1132:"`

**C1133** - `OrgSettingsStore.save` sends `default_term_months`, `renewal_notice_days` and
`cpi_renegotiation_threshold_pct` with the validated values in its update, and `getOrgSettings` maps those three columns
back to `defaultTermMonths`, `renewalNoticeDays` and `cpiRenegotiationThresholdPct` (AC 3)
Proof: `npx vitest run infrastructure/supabase -t "C1133:"`

**C1134** - `saveSettingsAction` with an invalid renewal field returns that field's C1132 error and calls no store
write (AC 4)
Proof: `npx vitest run components/settings -t "C1134:"`

**C1135** - `SettingsView` for an owner renders three inputs labelled `Default term (months)`, `Renewal notice (days)`
and `CPI renegotiation threshold (%)` holding the stored values. For an estimator and a viewer it renders the same three
values with no input element for them (AC 3, AC 5)
Proof: `npx vitest run components/settings -t "C1135:"`

### S2 - a version carries a term

**C1136** - `create_agreement` in an org whose `default_term_months` is 24 gives version 1 `term_months = 24` and
`term_start` null. In an org with no `org_settings` row it gives `term_months = 12` (AC 6, door 6)
Proof: `npm run test:db agreement_builder` (assertions `C1136`)

**C1137** - After the term writer stores each start and months, `term_end` reads: `2027-01-01`, 12 -> `2027-12-31`;
`2027-03-15`, 6 -> `2027-09-14`; `2027-01-31`, 1 -> `2027-02-27`; `2028-02-29`, 12 -> `2029-02-27`. With
`term_start` null, `term_end` is null. A direct `update agreement_versions set term_end = ...` is refused (generated
column) (AC 7, door 1)
Proof: `npm run test:db agreement_builder` (assertions `C1137`)

**C1138** - As an estimator, the term writer on the current version of a draft stores `term_start` and `term_months`
on the highest version only and returns its id; a lower version of the same agreement is unchanged (AC 8, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1138`)

**C1139** - The term writer refuses: a `sent` agreement with `55000`; a viewer with `42501`; an unknown agreement id
and an agreement of org B with `P0002`; `p_term_months` 0 and 61 and `p_term_start` `1999-12-31` and `2100-01-01` with
`23514`. After each refusal the version's `term_start`, `term_months` and `snapshot` are unchanged (AC 9, AC 10, door 3)
Proof: `npm run test:db agreement_builder` (assertions `C1139`)

**C1140** - `authenticated` still has no `update` privilege on `agreement_versions`
(`has_table_privilege('authenticated', 'public.agreement_versions', 'UPDATE')` is false, and no column of it is
updatable by `authenticated`) (door 3, AD-060)
Proof: `npm run test:db agreement_builder` (assertions `C1140`)

**C1141** - `validateAgreementTerm` accepts start `"2027-01-01"` with months `"12"`, `"1"` and `"60"`, and start
`"2000-01-01"` and `"2099-12-31"`. It gives `Term must be a whole number of months from 1 to 60` for months `""`, `"0"`,
`"61"`, `"6.5"`; and `Enter a start date between 2000 and 2099` for start `""`, `"1999-12-31"`, `"2100-01-01"`,
`"2027-02-30"`, `"01/01/2027"` (AC 10)
Proof: `npx vitest run domain/agreement -t "C1141:"`

**C1142** - `AgreementTermStore.save` calls `rpc("save_agreement_term", { p_agreement_id, p_term_start, p_term_months })`
and maps `55000` -> `locked`, `42501` -> `forbidden`, `P0002` -> `not_found`, `23514` -> `invalid`, any other error ->
`unavailable` (AC 9, Surface `save_agreement_term`)
Proof: `npx vitest run infrastructure/supabase -t "C1142:"`

**C1143** - The term Server Action with invalid input returns the C1141 error and calls no store; with a `locked`
answer it shows `This version can no longer be changed.`; a viewer is refused before any store call (AC 9, AC 10)
Proof: `npx vitest run components/agreements -t "C1143:"`

**C1144** - `revise` on an agreement whose version 1 has `term_start 2027-01-01` and `term_months 24` creates version 2
with the same `term_start` and `term_months`, and version 1 keeps both (AC 11, door 6)
Proof: `npm run test:db agreement_builder` (assertions `C1144`)

**C1145** - `AgreementReader.get` maps the shown version's `term_start`, `term_months` and `term_end` to
`AgreementDetail.term` `{ start: "2027-01-01", months: 12, end: "2027-12-31" }`, and to `start: null, end: null` while
`term_start` is null (AC 8, AC 12)
Proof: `npx vitest run infrastructure/supabase -t "C1145:"`

**C1146** - `AgreementView` on an editable draft with no start renders `Start date not set` and `12 months` in the Term
section and a start date input and a months input for a writer; with start `2027-01-01` it renders
`Term: Jan 1, 2027 – Dec 31, 2027 · 12 months`. A viewer, and a non-editable version, get no term inputs (AC 8, AC 12)
Proof: `npx vitest run components/agreements -t "C1146:"`

**C1147** - After the migration, every `agreement_versions` row has `term_months = 12` and `term_start` null except
the ones `seed.sql` set (C1158), and the md5 over every row's `id || snapshot::text`, ordered by id, is the same before
and after the migration (AC 13)
Proof: mcp `execute_sql` (pre-apply and post-apply results recorded in the Handoff)

**C1148** - The date label gives `Jan 1, 2027` for `"2027-01-01"` and `Dec 31, 2027` for `"2027-12-31"`, run under
`TZ=America/Vancouver` and under `TZ=Asia/Tokyo` (AC 14)
Proof: `npx vitest run domain/agreement -t "C1148:"`

### S3 - send needs a term, and freezes the renewal terms

**C1149** - `send_agreement` on a draft with a line and no `term_start` raises `23514` with hint `no_term_start`, and
the agreement's status, its `events`, `outbox` and `portal_links` row counts are unchanged. With `term_start` set, the
same call sends (AC 15, door 4)
Proof: `npm run test:db customer_portal` (assertions `C1149`)

**C1150** - The send adapter maps `23514` with hint `no_term_start` to `no_term_start` and `23514` with no hint to
`no_lines` as before; the agreement page's send alert for `no_term_start` reads
`Set the term start date before sending` (AC 15)
Proof: `npx vitest run infrastructure/supabase -t "C1150:"`
Proof: `npx vitest run components/agreements -t "C1150:"`

**C1151** - A send freezes `snapshot.terms` holding the six existing keys plus `renewalNoticeDays` equal to the org's
`renewal_notice_days` and `cpiRenegotiationThresholdPct` equal to its threshold. A later
`update org_settings set renewal_notice_days = 60, cpi_renegotiation_threshold_pct = 7` leaves the snapshot
byte-equal (AC 16, door 5)
Proof: `npm run test:db customer_portal` (assertions `C1151`)

**C1152** - `parseTerms` of a `terms` object with only the six existing keys returns them with `renewalNoticeDays: null`
and `cpiRenegotiationThresholdPct: null`. With `renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5` it returns
those. It returns `null` for `renewalNoticeDays` `-1`, `366`, `"30"`, `1.5` and for
`cpiRenegotiationThresholdPct` `-1`, `101`, `"5"` (AC 17, door 5)
Proof: `npx vitest run domain/agreement -t "C1152:"`

### S4 - the customer sees the term and the renewal clause

**C1153** - `buildAgreementDocument` gives `term` the text `Term: Jan 1, 2027 – Dec 31, 2027 (12 months)` for a version
with start `2027-01-01`. For the current draft with no start it gives `Term: start date to be set (12 months)`; for a
frozen version with no start, `Term: not recorded for this version` (AC 18, AC 19)
Proof: `npx vitest run domain/agreement -t "C1153:"`

**C1154** - `termsOf` with renewal values 30 and 5, CPI cap 3 and 12 term months includes the row `Renewal`:
`Renews automatically for another 12 months with the CPI increase, capped at 3%. If CPI is 5% or more, the renewal is
renegotiated. Notice is given 30 days before the end date.` With either renewal value `null` it has no `Renewal` row.
`buildAgreementDocument` uses the settings' renewal values for the current draft and the frozen ones otherwise (AC 20,
AC 21)
Proof: `npx vitest run domain/agreement -t "C1154:"`

**C1155** - The rendered PDF text has the term line `Term: Jan 1, 2027 – Dec 31, 2027 (12 months)` and the C1154
`Renewal` row; for a frozen version without renewal values it has no `Renewal` (AC 18, AC 20, AC 21, PDF)
Proof: `npx vitest run infrastructure/documents -t "C1155:"`

**C1156** - `ReviewView` renders the term line and the `Renewal` row for a view with term
`{ start: "2027-01-01", months: 12, end: "2027-12-31" }` and frozen renewal values; for `start: null` it renders
`Term: not recorded for this version` (AC 18, AC 19, customer page)
Proof: `npx vitest run components/review -t "C1156:"`

**C1157** - `portal_view` of a sent fixture version with `term_start 2027-01-01` returns
`"term": {"start": "2027-01-01", "months": 12, "end": "2027-12-31"}` and `terms` holding the renewal keys; for a version
with no start it returns `"start": null, "end": null` (AC 22, door 7)
Proof: `npm run test:db customer_portal` (assertions `C1157`)

**C1158** - After `supabase/seed.sql` runs twice, every demo `agreement_versions` row has a non-null `term_start` equal
to the first of the month after its `created_at`, and the second run changes no `agreement_versions` row (md5 over every
row ordered by id) (plan Assumptions, demo data)
Proof: `npm run test:db demo_seed` (assertions `C1158`)

**C1159** - The portal adapter maps `portal_view`'s `term` to `PortalView.term` unchanged, and `portalDocument(view)`
gives the same `term` text and `Renewal` row as `buildAgreementDocument` over the equivalent `AgreementDetail` (AC 23)
Proof: `npx vitest run infrastructure/supabase -t "C1159:"`
Proof: `npx vitest run application/use-cases -t "C1159:"`

### Delivery

**C1160** - `database.types.ts` gives `agreement_versions.Row` `term_start: string | null`, `term_months: number`,
`term_end: string | null`, `org_settings.Row` the three renewal columns as `number`, and `Functions` a
`save_agreement_term` entry; `npx tsc --noEmit` exits 0
Proof: `npx tsc --noEmit`
Proof: `npx vitest run infrastructure/supabase -t "C1160:"`

**C1161** - `npm test` passes with every pre-existing test's claim unchanged, apart from the fixture shape changes listed
under Handoff `Settled mid-build`
Proof: `npm test`

**C1162** - `npm run test:db` passes all 19 recipes
Proof: `npm run test:db`

**C1163** - `portal_view` still returns `null` for an unknown token hash. A regression run of cadence's existing
assertion, unchanged (Surface `portal_view`)
Proof: `npm run test:db cadence` (assertions `C1082`)

**C1164** - `send_agreement` on a draft with no service line still raises `23514` with no hint (`no_lines`), whether or
not `term_start` is set. A regression of the existing refusal (Surface `send_agreement`)
Proof: `npm run test:db customer_portal` (assertions `C1164`)

**C1165** - The term writer's success path returns `200` with a uuid through PostgREST: the adapter given
`{ data: "<uuid>", error: null }` answers `{ ok: true }` (Surface `save_agreement_term`)
Proof: `npx vitest run infrastructure/supabase -t "C1165:"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `org_settings` bounds, refused (6) | term 0 C1131 · term 61 C1131 · notice -1 C1131 · notice 366 C1131 · threshold -0.01 C1131 · threshold 100.01 C1131 | - |
| `org_settings` bounds, accepted edges (6) | term 1 C1131 · term 60 C1131 · notice 0 C1131 · notice 365 C1131 · threshold 0 C1131 · threshold 100 C1131 | - |
| settings form errors (3) | default term C1132 · renewal notice C1132 · threshold C1132 | - |
| settings roles (3) | owner edits C1135 · estimator read-only C1135 · viewer read-only C1135 | - |
| where version 1's months come from (2) | org setting C1136 · no settings row C1136 | - |
| `term_end` cases (5) | Jan 1 + 12 C1137 · mid-month + 6 C1137 · month end + 1 C1137 · leap day + 12 C1137 · null start C1137 | - |
| term form errors (2) | months C1141 · start date C1141 | - |
| term display states (3) | no start C1146 · start set C1146 · read-only C1146 | - |
| term writer refusals at the adapter (5) | `55000` C1142 · `42501` C1142 · `P0002` C1142 · `23514` C1142 · other C1142 | - |
| `rpc save_agreement_term` statuses (5) | `200` uuid C1138, C1165 · `55000` C1139 · `42501` C1139 · `P0002` C1139 · `23514` C1139 | - |
| `rpc send_agreement` statuses (3) | `200` uuid C1149 · `23514` no term start C1149 · `23514` no lines C1164 | - |
| `rpc portal_view` results (3) | `200` with term set C1157 · `200` with no start C1157 · `200` null unknown link C1163 | - |
| term line states (3) | dates C1153 · draft no start C1153 · frozen no start C1153 | - |
| term line places (4) | staff page C1146 · customer page C1156 · staff PDF C1155 · customer PDF C1159 | - |
| renewal row sources (3) | current draft from settings C1154 · frozen with keys C1154 · frozen without keys C1154, C1155 | - |
| renewal row places (3) | staff PDF C1155 · customer page C1156 · customer PDF C1159 | - |
| `parseTerms` renewal inputs (4) | absent C1152 · valid C1152 · bad notice C1152 · bad threshold C1152 | - |
| date label time zones (2) | America/Vancouver C1148 · Asia/Tokyo C1148 | - |
| Landing doors (7) | 1 C1137, C1147 · 2 C1130, C1131 · 3 C1138, C1139, C1140 · 4 C1149 · 5 C1151, C1152 · 6 C1136, C1144 · 7 C1157 | - |

- Claims naming a status or response shape: C1131, C1137, C1139, C1142, C1149, C1150, C1157, C1164, C1165. The SQL
  ones cross the database boundary; C1142, C1150, C1159 and C1165 are at the adapter the app consumes the RPCs through.
- No other check claims more than the cases its proof lists.

## Swept

- validation: C1131, C1132, C1139, C1141, C1152
- failure modes: existing - a Supabase migration applies in one transaction; the term writer is one statement; a
  refused send rolls back the transition with it (C1149)
- idempotency: C1158 (seed re-run); saving the same term twice stores the same values (C1138, plain update)
- authorization: C1139 (`42501` viewer, `P0002` other org), C1140 (no member update on versions), C1135 (settings
  read-only), existing - `org_settings` writes are owner and admin only by RLS (`0001_init`)
- concurrency: C1149 - the start-date check runs after `apply_agreement_transition` holds the agreement row, so a term
  write cannot land between the check and the send; the term writer takes the agreement `for update` (door 3)
- data lifecycle: C1130, C1147 (backfill defaults, no snapshot rewritten)
- dependency failure: n/a - no external call is added
- state transitions: C1139 (`55000` unless draft), C1144 (revise copies), C1149 (send needs a start)
- observability: n/a - no logging requirement; every refusal is a coded answer shown to the member

## Handoff

- Read set, measured with `wc -c` before building: the agreement-builder, customer-portal, outbox-dispatch and cadence
  migrations (latest definitions of `create_agreement`, `apply_agreement_transition`, `send_agreement`, `org_terms`,
  `portal_view`), `seed.sql`, the `agreement_builder`, `customer_portal`, `domain_constraints`, `demo_seed` and `fixture`
  SQL suites, domain `agreement/index.ts`, `document.ts`, `org-settings/index.ts`, the agreement, settings and review
  components, the PDF layout, the agreements, settings, portal and readers adapters, ports, the portal use cases, the
  two Server Action files and `database.types.ts`: 362,737 bytes, about 91k tokens. Fixtures in other test files holding
  `AgreementTerms` or `OrgSettingsValue` literals add about 60 KB, about 15k.
- Written: migration and SQL assertions about 25 KB; domain and tests about 15 KB; components, PDF, adapters and tests
  about 25 KB; docs about 8 KB. About 73 KB, about 18k tokens. Test output about 10k.
- S1-S4 and delivery come to about 134k against the 150k budget. One builder.
- Mechanism: one builder (under the budget, no ask)
- Shape detail settled in the checks, not a door: the send refusal carries `hint = 'no_term_start'` so the adapter can
  tell it from the existing `no_lines` `23514` (C1149, C1150).
- Expected pre-existing test moves, each keeping its claim: `fixture.sql` gives the fixture draft versions a
  `term_start` so existing `send_agreement` assertions still send; `AgreementTerms` and `OrgSettingsValue` fixtures gain
  the new fields. These go under `Settled mid-build` with the user's approval before they land.
- **Settled before build (2026-11-02):** the user approved (1) applying the migration to `gnxebrtcpbujhvcamtoe` through
  mcp `apply_migration` once the code and SQL tests are written, with the C1130 and C1147 queries run before and after,
  and (2) the two expected test moves above: `fixture.sql` draft versions gain a `term_start`, and the `AgreementTerms` and
  `OrgSettingsValue` fixtures gain the new fields. Each keeps its claim.
