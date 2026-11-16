# Demo plan

For showing Service Agreement to a contractor. The demo workspace is **Kettle Ridge Mechanical Ltd.** (fictitious), on the **Business plan** (200 live agreements, 120 AI imports, 10 seats). Its Stripe ids are placeholders (`demo_cus_business`, `demo_sub_business`), so the plan, limits and usage are real and Stripe-backed actions are not.

## Before the demo (5 minutes)

1. Sign in as the demo owner and open **Settings**. The company details are the sample ones, so **Send is blocked on purpose** and the page shows a banner. Replace the legal name, address and phone with your own (or a believable demo company) and save. Sample values such as `Kettle Ridge`, `Sample Street` and a `555-01xx` phone are refused.
2. Delete or ignore the `ZZ TEST` customer, site and AG-1002 (a completed test contract). Use a fresh customer for the story.
3. Open `/settings/billing` once to check it reads **Business**.
4. Have one messy equipment list ready (Excel or CSV is the safest). Use the same file you tested with.

## The story (about 10 minutes)

1. **The problem (1 min).** A customer sends a messy equipment list. Today it becomes a spreadsheet, a Word document and emails.
2. **Import (3 min).** New agreement, drop the list. The AI reads it; rows it is sure of are typed, doubtful ones are flagged. Show: units typed by words ("Boiler cond." becomes Boiler), a quantity row expanded into units, a repeated row starting skipped, a correction remembered for the next import.
3. **Build (2 min).** Add one priced line covering two equipment types. The **Scope** panel shows only what the line covers; leave one unit out (it stays on the site). Show **Template: ...** and switch it; the PDF preview redraws.
4. **Send (2 min).** Send to a test address you control. If the dialog warns that other equipment types have no line, that is the feature: confirm or add them to a line.
5. **Customer side (2 min).** Open the review link on a phone-sized window, then the signing page. Say plainly that signing runs on the provider's page.
6. **Plan and usage (1 min).** Settings, Billing: Business plan, live agreements and AI imports against the limit.

## Do not click in the demo

- **Update card, Cancel subscription, Switch to Starter or Team** on the Billing page. They call Stripe with placeholder ids and fail.
- **Renewals and the reports on 2027 dates.** Nothing real to show yet.
- **Contract wording.** It is starter text with no lawyer review; do not call it reviewed.

## Say it honestly

- The product is in development with no customers yet; the data is sample data.
- The public Terms, Privacy and Security pages are starter text pending a lawyer. The hosting region is not stated until verified.
- The customer email carries a review link; the PDF is on that page.
- Sending needs your own confirmed company details, by design.

## What is still open

Everything that needs the owner (lawyer, hosting region, email domain, DocuSeal choices, real-device signing, the rest of the QA list) is under **Phase 5.9, owner actions** in [ROADMAP.md](ROADMAP.md).
