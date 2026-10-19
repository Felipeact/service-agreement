# Design system base - checks

Profile: light
Plan: `.specs/features/design-system-base/plan.md`

35 checks in 5 slices · 3 one-way doors · 0 open

## How proofs run

AGENTS.md keeps web tests out of git, so no proof here is a committed test file. Four proof kinds,
each settled by one run:

- **shell** - a command run from the repo root; the check passes when it exits 0.
- **node** - `node --input-type=module -e "<script>"` from the repo root (Node 24 strips TS types
  natively); the script uses `node:assert` and exits non-zero on failure.
- **http** - `curl` against `npm run dev` in `web/` on `http://localhost:3000`.
- **pw** - Playwright MCP, live: `pw@<W>x<H> <path>: <expression> => <expected>` means
  `browser_resize` to W x H, `browser_navigate` to the path, then `browser_evaluate` the expression;
  the check passes when the value equals the expected one (deep equality, or the stated relation).
  A step in brackets (`[click "Clear search"]`) is a `browser_click` / `browser_type` /
  `browser_press_key` run before the evaluation.

Colours are compared as the computed `rgb(...)` strings the browser returns.

## Checks

### S1 - Tokens and type · 3 files · ~4 KB · ~1k

**C1** - `web/app/globals.css` `@theme` defines all 16 colour tokens with these exact values: `--color-ground: #f6f7f9`, `--color-surface: #ffffff`, `--color-board: #eef0f3`, `--color-hairline: #e5e7eb`, `--color-ink: #111827`, `--color-ink-2: #646b78`, `--color-ink-nav: #374151`, `--color-action: #2563eb`, `--color-action-tint: #eef2ff`, `--color-stage-in-progress: #2563eb`, `--color-stage-sent: #f59e0b`, `--color-stage-accepted: #8b5cf6`, `--color-stage-completed: #10b981`, `--color-stage-refused: #ef4444`, `--color-attention-bg: #fef3c7`, `--color-attention-fg: #92400e`; plus `--radius-control: 6px`, `--radius-panel: 8px`, `--shadow-card: 0 1px 2px rgba(17,24,39,.08)` (AC 1, door 1)
Proof: node `import fs from "node:fs";import a from "node:assert";const c=fs.readFileSync("web/app/globals.css","utf8");const t=c.slice(c.indexOf("@theme"));const w={"color-ground":"#f6f7f9","color-surface":"#ffffff","color-board":"#eef0f3","color-hairline":"#e5e7eb","color-ink":"#111827","color-ink-2":"#646b78","color-ink-nav":"#374151","color-action":"#2563eb","color-action-tint":"#eef2ff","color-stage-in-progress":"#2563eb","color-stage-sent":"#f59e0b","color-stage-accepted":"#8b5cf6","color-stage-completed":"#10b981","color-stage-refused":"#ef4444","color-attention-bg":"#fef3c7","color-attention-fg":"#92400e","radius-control":"6px","radius-panel":"8px","shadow-card":"0 1px 2px rgba(17,24,39,.08)"};for(const[k,v]of Object.entries(w)){const m=t.match(new RegExp("--"+k+":\\s*([^;]+);"));a.ok(m,k+" missing");a.equal(m[1].trim().toLowerCase(),v,k)}`

**C2** - `body` computes font-size `13px`, line-height `18.85px` (1.45), colour `rgb(17, 24, 39)` and background `rgb(246, 247, 249)`, and its font-family starts with an Inter family and includes `system-ui` as a fallback (AC 2)
Proof: pw@1440x900 /pipeline: `(()=>{const s=getComputedStyle(document.body);return [s.fontSize,s.lineHeight,s.color,s.backgroundColor,/^["']?(__)?Inter/i.test(s.fontFamily),/system-ui/.test(s.fontFamily)]})()` => `["13px","18.85px","rgb(17, 24, 39)","rgb(246, 247, 249)",true,true]`

**C3** - No `.tsx` file under `web/app`, `web/components` or `web/lib` contains a hex colour literal or a Tailwind default-palette colour class (AC 3, door 1)
Proof: shell `! grep -rEn --include=*.tsx '#[0-9a-fA-F]{3,8}\b|-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' web/app web/components web/lib`

**C4** - Every element inside `main` whose own text contains a digit computes `font-variant-numeric` containing `tabular-nums` (AC 4)
Proof: pw@1440x900 /pipeline: `[...document.querySelectorAll("main *")].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&/\d/.test(n.textContent))).filter(e=>!getComputedStyle(e).fontVariantNumeric.includes("tabular-nums")).length` => `0`

**C5** - `formatCad` in `web/lib/money.ts` returns `$14,280` for `1428000`, `$14,280.50` for `1428050`, `$0` for `0`, `$0.99` for `99` and `$1,000,000` for `100000000` (AC 5)
Proof: node `import a from "node:assert";const {formatCad:f}=await import("./web/lib/money.ts");a.deepEqual([f(1428000),f(1428050),f(0),f(99),f(100000000)],["$14,280","$14,280.50","$0","$0.99","$1,000,000"])`

### S2 - App shell · 4 files · ~8 KB · ~2k

**C6** - At desktop the sidebar shows "Service Agreement" and nav item texts in exactly this order: Pipeline, Agreements, Customers, Sites & equipment, Imports, Task library, Settings; Settings sits lower than Task library by at least 24px more than the gap between Imports and Task library (AC 6)
Proof: pw@1440x900 /pipeline: `(()=>{const n=document.querySelector("nav[aria-label='Main']");const it=[...n.querySelectorAll("a,[aria-disabled='true']")];const r=t=>it.find(e=>e.textContent.trim()===t).getBoundingClientRect().top;return [n.closest("aside").textContent.includes("Service Agreement"),it.map(e=>e.textContent.trim()),(r("Settings")-r("Task library"))-(r("Task library")-r("Imports"))>=24]})()` => `[true,["Pipeline","Agreements","Customers","Sites & equipment","Imports","Task library","Settings"],true]`

**C7** - On `/pipeline` the Pipeline nav item has `aria-current="page"`, background `rgb(238, 242, 255)` and colour `rgb(37, 99, 235)` (AC 7)
Proof: pw@1440x900 /pipeline: `(()=>{const e=[...document.querySelectorAll("nav[aria-label='Main'] a")].find(a=>a.textContent.trim()==="Pipeline");const s=getComputedStyle(e);return [e.getAttribute("aria-current"),s.backgroundColor,s.color]})()` => `["page","rgb(238, 242, 255)","rgb(37, 99, 235)"]`

**C8** - The six items other than Pipeline each have `aria-disabled="true"` and no `href`, and clicking "Customers" leaves `location.pathname` at `/pipeline` (AC 8)
Proof: pw@1440x900 /pipeline: `[...document.querySelectorAll("nav[aria-label='Main'] [aria-disabled='true']")].filter(e=>!e.hasAttribute("href")).map(e=>e.textContent.trim())` => `["Agreements","Customers","Sites & equipment","Imports","Task library","Settings"]`
Proof: pw@1440x900 /pipeline [click "Customers"]: `location.pathname` => `"/pipeline"`

**C9** - At 1440x900 and 1024x768 the sidebar is visible and exactly 232px wide, and the menu button is not displayed (AC 9)
Proof: pw@1440x900 /pipeline: `(()=>{const a=document.querySelector("nav[aria-label='Main']").closest("aside");const b=document.querySelector("button[aria-label='Open navigation']");return [a.getBoundingClientRect().width,getComputedStyle(a).display!=="none",!b||b.offsetParent===null]})()` => `[232,true,true]`
Proof: pw@1024x768 /pipeline: same expression => `[232,true,true]`

**C10** - At 375x812 and 768x1024 the sidebar is not displayed and a button labelled "Open navigation" is visible with a box of at least 44x44 (AC 10)
Proof: pw@375x812 /pipeline: `(()=>{const a=document.querySelector("nav[aria-label='Main']")?.closest("aside");const b=document.querySelector("button[aria-label='Open navigation']").getBoundingClientRect();return [!a||a.getBoundingClientRect().width===0||getComputedStyle(a).visibility==="hidden"||getComputedStyle(a).display==="none",b.width>=44&&b.height>=44]})()` => `[true,true]`
Proof: pw@768x1024 /pipeline: same expression => `[true,true]`

**C11** - At 375x812, activating "Open navigation" shows the nav drawer (Pipeline link visible) and `document.activeElement` is inside the drawer (AC 11)
Proof: pw@375x812 /pipeline [click "Open navigation"]: `(()=>{const d=document.querySelector("[role='dialog'][aria-label='Navigation']");const p=[...d.querySelectorAll("a")].find(a=>a.textContent.trim()==="Pipeline");return [p.getBoundingClientRect().width>0,d.contains(document.activeElement)]})()` => `[true,true]`

**C12** - At 375x812 the open drawer closes, and focus returns to "Open navigation", on each of: Escape, a tap on the backdrop, activating the Pipeline link (AC 12)
Proof: pw@375x812 /pipeline [click "Open navigation"; press Escape]: `[!document.querySelector("[role='dialog'][aria-label='Navigation']"),document.activeElement.getAttribute("aria-label")]` => `[true,"Open navigation"]`
Proof: pw@375x812 /pipeline [click "Open navigation"; click the backdrop at viewport point (360, 400)]: same expression => `[true,"Open navigation"]`
Proof: pw@375x812 /pipeline [click "Open navigation"; click drawer link "Pipeline"]: same expression => `[true,"Open navigation"]`

**C13** - `/pipeline` has exactly one `h1`, with text "Pipeline", and exactly one primary-variant button (`data-variant="primary"`) in the page header (AC 13)
Proof: pw@1440x900 /pipeline: `[document.querySelectorAll("h1").length,document.querySelector("h1").textContent.trim(),document.querySelectorAll("main header [data-variant='primary']").length]` => `[1,"Pipeline",1]`

**C14** - At 375x812 the search input's top is below the `h1`'s bottom, and `document.documentElement.scrollWidth` equals `clientWidth` (AC 14)
Proof: pw@375x812 /pipeline: `[document.querySelector("input[aria-label='Search agreements']").getBoundingClientRect().top>=document.querySelector("h1").getBoundingClientRect().bottom,document.documentElement.scrollWidth===document.documentElement.clientWidth]` => `[true,true]`

### S3 - Controls and status pill · 3 files · ~5 KB · ~1.5k

**C15** - The primary button ("New agreement") computes background `rgb(37, 99, 235)` and colour `rgb(255, 255, 255)`; the secondary button ("Clear search") computes background `rgb(255, 255, 255)`, a 1px `rgb(229, 231, 235)` border and colour `rgb(17, 24, 39)`; both are 34px tall at 1440x900 and at least 44px tall at 375x812 and 768x1024 (AC 15)
Proof: pw@1440x900 /pipeline: `(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="New agreement");const s=getComputedStyle(b);return [s.backgroundColor,s.color,b.getBoundingClientRect().height]})()` => `["rgb(37, 99, 235)","rgb(255, 255, 255)",34]`
Proof: pw@1440x900 /pipeline [type "zzzz" into "Search agreements"]: `(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="Clear search");const s=getComputedStyle(b);return [s.backgroundColor,s.borderTopWidth,s.borderTopColor,s.color,b.getBoundingClientRect().height]})()` => `["rgb(255, 255, 255)","1px","rgb(229, 231, 235)","rgb(17, 24, 39)",34]`
Proof: pw@375x812 /pipeline [type "zzzz" into "Search agreements"]: `["New agreement","Clear search"].map(t=>[...document.querySelectorAll("button")].find(e=>e.textContent.trim()===t).getBoundingClientRect().height>=44)` => `[true,true]`
Proof: pw@768x1024 /pipeline [type "zzzz" into "Search agreements"]: same expression => `[true,true]`

**C16** - After keyboard Tab focus, the search input and the Pipeline nav link each compute a 2px outline (or 2px box-shadow ring) in `rgb(37, 99, 235)`; after a pointer click on a button (the "Sent to customer" stage tab at 375x812) the focused button does not match `:focus-visible` and draws no outline (AC 16)
Proof: pw@1440x900 /pipeline [press Tab until "Search agreements" is focused]: `(()=>{const s=getComputedStyle(document.activeElement);return (s.outlineStyle!=="none"&&s.outlineWidth==="2px"&&s.outlineColor==="rgb(37, 99, 235)")||/rgb\(37, 99, 235\) 0px 0px 0px 2px/.test(s.boxShadow)})()` => `true`
Proof: pw@1440x900 /pipeline [press Tab until the "Pipeline" nav link is focused]: same expression => `true`
Proof: pw@375x812 /pipeline [click tab "Sent to customer"]: `(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [e.getAttribute("role"),e.matches(":focus-visible"),s.outlineStyle==="none"||s.outlineWidth==="0px"]})()` => `["tab",false,true]`

**C17** - "New agreement" has the native `disabled` property true, and clicking it changes neither `location.href` nor the board, and logs nothing to the console (AC 17)
Proof: pw@1440x900 /pipeline: `[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="New agreement").disabled` => `true`
Proof: pw@1440x900 /pipeline [record `window.__n=document.querySelectorAll("[data-card]").length`; dispatch a click: `[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="New agreement").click()`]: `[location.pathname,document.querySelectorAll("[data-card]").length===window.__n]` => `["/pipeline",true]`, and `browser_console_messages` returns no new entry after the click

**C18** - The search input, labelled "Search agreements", computes a 1px `rgb(229, 231, 235)` border, 6px radius, placeholder colour `rgb(100, 107, 120)`, height 34px at 1440x900 and at least 44px at 375x812 and 768x1024 (AC 18)
Proof: pw@1440x900 /pipeline: `(()=>{const e=document.querySelector("input[aria-label='Search agreements']")||document.getElementById(document.querySelector("label")?.htmlFor);const s=getComputedStyle(e),p=getComputedStyle(e,"::placeholder");return [s.borderTopWidth,s.borderTopColor,s.borderTopLeftRadius,p.color,e.getBoundingClientRect().height]})()` => `["1px","rgb(229, 231, 235)","6px","rgb(100, 107, 120)",34]`
Proof: pw@375x812 /pipeline: `document.querySelector("input[aria-label='Search agreements']").getBoundingClientRect().height>=44` => `true`
Proof: pw@768x1024 /pipeline: same expression => `true`

**C19** - Each of the five stage pills renders a dot whose background is its stage colour beside its label text, and the attention pill renders its label in `rgb(146, 64, 14)` on `rgb(254, 243, 199)`; `StatusPill`'s `label` prop is required by its type (AC 19)
Proof: pw@1440x900 /pipeline: `[...document.querySelectorAll("[data-stage-dot]")].map(d=>[d.dataset.stageDot,getComputedStyle(d).backgroundColor,d.parentElement.textContent.trim().length>0]).filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i).sort()` => `[["accepted","rgb(139, 92, 246)",true],["completed","rgb(16, 185, 129)",true],["in_progress","rgb(37, 99, 235)",true],["refused","rgb(239, 68, 68)",true],["sent","rgb(245, 158, 11)",true]]`
Proof: pw@1440x900 /pipeline: `(()=>{const p=[...document.querySelectorAll("[data-tone='attention']")].find(e=>e.textContent.trim()==="Changes requested");const s=getComputedStyle(p);return [s.color,s.backgroundColor]})()` => `["rgb(146, 64, 14)","rgb(254, 243, 199)"]`
Proof: shell `grep -En "label: string" web/components/ui/status-pill.tsx && ! grep -En "label\?:" web/components/ui/status-pill.tsx`

### S4 - Pipeline board on sample data · 6 files · ~14 KB · ~3.5k

**C20** - `GET /` responds `307` with `Location` ending in `/pipeline` (AC 20, Surface `GET /`)
Proof: http `test "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost:3000/)" = "307 http://localhost:3000/pipeline"`

**C21** - `GET /pipeline` responds `200`, and the page shows "Pipeline", a "Search agreements" input, a "Sample data" pill, and a disabled "New agreement" primary button (AC 21, Surface `GET /pipeline`)
Proof: http `test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/pipeline)" = "200"`
Proof: pw@1440x900 /pipeline: `[document.querySelector("h1").textContent.trim(),!!document.querySelector("input[aria-label='Search agreements']"),document.body.innerText.includes("Sample data"),(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()==="New agreement");return b.disabled&&b.dataset.variant==="primary"})()]` => `["Pipeline",true,true,true]`

**C22** - The board has five columns whose headers read, in order, "In progress", "Sent to customer", "Accepted", "Completed", "Refused"; each header's count equals its column's card count and its total equals `formatCad` of the sum of its cards' amounts followed by `/yr` (AC 22, door 2)
Proof: pw@1440x900 /pipeline: `[...document.querySelectorAll("[data-column]")].map(c=>{const cards=[...c.querySelectorAll("[data-card]")];const sum=cards.reduce((s,k)=>s+Number(k.dataset.amountCents||0),0);return [c.querySelector("[data-column-title]").textContent.trim(),Number(c.querySelector("[data-column-count]").textContent)===cards.length,c.querySelector("[data-column-total]").textContent.trim()===new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:sum%100?2:0,maximumFractionDigits:2}).format(sum/100).replace("CA","")+"/yr"]})` => `[["In progress",true,true],["Sent to customer",true,true],["Accepted",true,true],["Completed",true,true],["Refused",true,true]]`

**C23** - The "Harbourview Towers Strata" card shows, top to bottom, its name, `AG-1048 · v3`, a "Changes requested" pill, then a row with `4 visits/yr` on the left and `$14,280/yr` right-aligned (its right edge within 1px of the card content's right edge) (AC 23)
Proof: pw@1440x900 /pipeline: `(()=>{const k=[...document.querySelectorAll("[data-card]")].find(e=>e.textContent.includes("Harbourview Towers Strata"));const t=k.innerText.split("\n").map(s=>s.trim()).filter(Boolean);const amt=[...k.querySelectorAll("*")].find(e=>e.childElementCount===0&&e.textContent.trim()==="$14,280/yr");const pad=parseFloat(getComputedStyle(k).paddingRight);return [t,Math.abs(amt.getBoundingClientRect().right-(k.getBoundingClientRect().right-pad))<=1]})()` => `[["Harbourview Towers Strata","AG-1048 · v3","Changes requested","4 visits/yr","$14,280/yr"],true]`

**C24** - A card with no amount (fixture "Lakeshore Brewing Co.") contains no `/yr` text and no `data-amount-cents` value above 0 (AC 24)
Proof: pw@1440x900 /pipeline: `(()=>{const k=[...document.querySelectorAll("[data-card]")].find(e=>e.textContent.includes("Lakeshore Brewing Co."));return [k.textContent.includes("/yr"),Number(k.dataset.amountCents||0)]})()` => `[false,0]`

**C25** - When a search leaves a column with no cards (query "Harbourview"), every other column shows the text "No agreements", count `0` and total `$0/yr` (AC 25)
Proof: pw@1440x900 /pipeline [type "Harbourview" into "Search agreements"]: `[...document.querySelectorAll("[data-column]")].slice(1).map(c=>[c.textContent.includes("No agreements"),c.querySelector("[data-column-count]").textContent.trim(),c.querySelector("[data-column-total]").textContent.trim()])` => `[[true,"0","$0/yr"],[true,"0","$0/yr"],[true,"0","$0/yr"],[true,"0","$0/yr"]]`

**C26** - Typing "harbour" (lower case) shows exactly the cards whose customer name contains "harbour" case-insensitively, and the In progress column count reads `1` with total `$14,280/yr` (AC 26)
Proof: pw@1440x900 /pipeline [type "harbour" into "Search agreements"]: `[[...document.querySelectorAll("[data-card]")].map(k=>k.querySelector("h3").textContent.trim()),document.querySelector("[data-column] [data-column-count]").textContent.trim(),document.querySelector("[data-column] [data-column-total]").textContent.trim()]` => `[["Harbourview Towers Strata"],"1","$14,280/yr"]`

**C27** - A query matching nothing (`zzzz`) replaces the board with `No agreements match "zzzz"` and a "Clear search" button; clicking it empties the input and restores the full card count (AC 27)
Proof: pw@1440x900 /pipeline [type "zzzz" into "Search agreements"]: `[document.querySelectorAll("[data-column]").length,document.body.innerText.includes('No agreements match "zzzz"'),!![...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Clear search")]` => `[0,true,true]`
Proof: pw@1440x900 /pipeline [record `window.__n=document.querySelectorAll("[data-card]").length`; type "zzzz"; click "Clear search"]: `[document.querySelector("input[aria-label='Search agreements']").value,document.querySelectorAll("[data-card]").length===window.__n]` => `["",true]`

**C28** - At 1440x900 the five columns are all within the work area (each column's right edge <= the board's right edge) and neither the board nor the page scrolls horizontally (AC 28)
Proof: pw@1440x900 /pipeline: `(()=>{const b=document.querySelector("[data-board]");const r=b.getBoundingClientRect().right;return [[...b.querySelectorAll("[data-column]")].every(c=>c.getBoundingClientRect().right<=r+0.5),b.scrollWidth<=b.clientWidth,document.documentElement.scrollWidth===document.documentElement.clientWidth]})()` => `[true,true,true]`

**C29** - At 768x1024 each column is at least 240px wide, the board's `scrollWidth` exceeds its `clientWidth`, and the page has no horizontal scroll (AC 29)
Proof: pw@768x1024 /pipeline: `(()=>{const b=document.querySelector("[data-board]");return [[...b.querySelectorAll("[data-column]")].every(c=>c.getBoundingClientRect().width>=240),b.scrollWidth>b.clientWidth,document.documentElement.scrollWidth===document.documentElement.clientWidth]})()` => `[true,true,true]`

**C30** - At 375x812 the board shows a `role="tablist"` with five tabs, each at least 44px tall, labelled `<short label> <count>` in stage order; "In progress" is selected; exactly one column is displayed and the page has no horizontal scroll (AC 30)
Proof: pw@375x812 /pipeline: `(()=>{const t=[...document.querySelectorAll("[role='tablist'] [role='tab']")];return [t.length,t.every(e=>e.getBoundingClientRect().height>=44),t.map(e=>e.textContent.replace(/\s*\d+$/,"").trim()),t[0].getAttribute("aria-selected"),[...document.querySelectorAll("[data-column]")].filter(c=>c.offsetParent!==null).length,document.documentElement.scrollWidth===document.documentElement.clientWidth]})()` => `[5,true,["In progress","Sent to customer","Accepted","Completed","Refused"],"true",1,true]`

**C31** - At 375x812, tapping each of the five tabs in turn sets that tab's `aria-selected="true"` and displays only the column with the matching title (AC 31)
Proof: pw@375x812 /pipeline [for each tab: click it, then evaluate]: `(()=>{const s=document.querySelector("[role='tab'][aria-selected='true']");const v=[...document.querySelectorAll("[data-column]")].filter(c=>c.offsetParent!==null);return [s.textContent.replace(/\s*\d+$/,"").trim(),v.length,v[0].querySelector("[data-column-title]").textContent.trim()]})()` => `[<tab>,1,<tab>]` for each of the five tabs

**C32** - The fixture in `web/` contains a "Changes requested" card at a version above v1, a "Not viewed" card in Sent to customer, an "Awaiting countersignature" card in Accepted, a card with no amount, and at least one card in every column (AC 32; "fictitious names" is a review item for the Verifier, not machine-checkable)
Proof: pw@1440x900 /pipeline: `(()=>{const c=[...document.querySelectorAll("[data-column]")];const txt=i=>c[i].innerText;return [c.every(x=>x.querySelectorAll("[data-card]").length>0),/Changes requested/.test(txt(0))&&/· v([2-9]|\d{2,})/.test(txt(0)),/Not viewed/.test(txt(1)),/Awaiting countersignature/.test(txt(2)),[...document.querySelectorAll("[data-card]")].some(k=>!k.textContent.includes("/yr"))]})()` => `[true,true,true,true,true]`

### S5 - The design system recorded from code · 3 files · ~16 KB · ~4k

**C33** - `DESIGN.md` contains no `SEED` marker, and every token hex in C1 appears in it (AC 33)
Proof: node `import fs from "node:fs";import a from "node:assert";const d=fs.readFileSync("DESIGN.md","utf8").toLowerCase();a.ok(!d.includes("seed:"),"SEED marker");const c=fs.readFileSync("web/app/globals.css","utf8");const hx=[...c.slice(c.indexOf("@theme")).matchAll(/--color-[\w-]+:\s*(#[0-9a-f]{6})/gi)].map(m=>m[1].toLowerCase());a.equal(hx.length,16);for(const h of hx)a.ok(d.includes(h),h);a.ok(!d.includes("#6b7280"),"stale ink-2")`

**C34** - `.impeccable/design.json` exists and parses as JSON (AC 34)
Proof: node `import fs from "node:fs";JSON.parse(fs.readFileSync(".impeccable/design.json","utf8"))`

### Cross-cutting

**C35** - `npm run build` and `npm run lint` in `web/` exit 0, `web/package.json` gains no runtime dependency, and `browser_console_messages` on `/pipeline` at 375x812, 768x1024 and 1440x900 shows no error or warning (door 3, observability)
Proof: shell `cd web && npm run build && npm run lint`
Proof: shell `node -e "const d=Object.keys(require('./web/package.json').dependencies).sort().join();if(d!=='next,react,react-dom')process.exit(1)"`
Proof: pw@375x812, pw@768x1024, pw@1440x900 /pipeline: `browser_console_messages` level error/warning => empty

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| colour tokens (16) | C1, table-driven over all 16 | - |
| shape tokens (3) | `radius-control` C1 · `radius-panel` C1 · `shadow-card` C1 | - |
| pipeline stages, door 2 (5) | `in_progress` C19 C22 C30 · `sent` C19 C22 C30 · `accepted` C19 C22 C30 · `completed` C19 C22 C30 · `refused` C19 C22 C30 | - |
| nav items (7) | Pipeline C7 · Agreements C8 · Customers C8 · Sites & equipment C8 · Imports C8 · Task library C8 · Settings C6 C8 | - |
| drawer close triggers (3) | Escape C12 · backdrop C12 · nav link C12 | - |
| viewports (3) | 375x812 C10 C14 C30 C31 C35 · 768x1024 C10 C29 C35 · 1440x900 C9 C28 C35 | - |
| Button variants (2) | `primary` C15 · `secondary` C15 | - |
| money format cases (5) | whole C5 · cents C5 · zero C5 · sub-dollar C5 · millions C5 | - |
| fixture required cases (5) | changes requested C32 · not viewed C32 · awaiting countersignature C32 · no amount C24 C32 · every column non-empty C32 | - |
| search outcomes (3) | partial match C26 · column emptied C25 · no match + clear C27 | - |
| `GET /` statuses (1) | 307 C20 | - |
| `GET /pipeline` statuses (1) | 200 C21 | - |
| one-way doors (3) | door 1 C1 C3 · door 2 C22 · door 3 C35 | - |

- Claims naming a status code or route: C20, C21 - each proof crosses the HTTP boundary with curl
- C22 and C25 compute totals in the proof with `Intl.NumberFormat`, independent of `formatCad`, so a wrong formatter fails them as well as C5

## Swept

- validation: C27 - a query that matches nothing; search input text is matched as a plain substring, never a pattern (C26)
- failure modes: n/a - no data source, network call or write exists in this change; the fixture is compiled in
- idempotency: n/a - nothing is written or sent
- authorization: n/a - no auth exists until M1 (Phase 1); every route is public in this change
- concurrency: n/a - search and tab state are per-tab client state with no shared resource
- data lifecycle: n/a - nothing is stored
- dependency failure: C2 - `next/font` self-hosts Inter at build time, so no runtime font fetch; `system-ui` is the fallback in the stack
- state transitions: C11, C12 (drawer open/closed), C31 (selected stage tab)
- observability: C35 - zero console errors or warnings at all three viewports

## Handoff

- S1-S5 touch ~16 files: ~47 KB of new or rewritten code plus `DESIGN.md` (8 KB) and `CONTEXT.md` (8 KB) = ~63 KB / 4 ≈ 16k tokens, under the 150k budget - one builder

- **Boundary:** C1-C32, C35 closed at `web@4d293fa`; C33-C34 closed in the outer docs commit. Author proof run used the already-running dev server on `http://localhost:3100` (a pre-existing `next dev` for this `web/` dir held the lock), so `localhost:3000` in the http/pw proofs reads as that port
- **Settled mid-build:** TextInput, Select and the field error state moved to Phase 1 (user choice); plan AC 18 narrowed to SearchInput, AC 19 dropped and later criteria renumbered before checks were written
- **Abandoned:** `redirect()` in `app/page.tsx` - replaced by a `next.config.ts` redirect, whose 307 is documented; curly quotes in the no-match message - C27 requires straight quotes
