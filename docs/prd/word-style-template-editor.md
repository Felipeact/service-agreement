# PRD: Word-style template editor and preview page

Feature PRD for Service Pacts (Phase 5.5, document templates). Written 2026-11-23.

## Problem

Contractors design their own proposal and contract documents today in Word. The current template editor is a list of fixed blocks (heading, paragraph, clause, a small table, fixed sections). They like how it looks, but they cannot design a page freely: no text colour or size on part of a sentence, no photos, no logo where they want it, no real tables. They also cannot see the final PDF as a full page before sending.

## Who it is for

Owners and admins of a contractor company (HVAC, plumbing, electrical) who prepare service agreements and contracts for commercial customers. They are comfortable with Word, not with design tools.

## What the user can do

- Start a template from a blank Letter page under their own letterhead.
- Type and style text: paragraph style (normal, title, heading, subheading), font (sans, serif, monospace), size, bold, italic, underline, strikethrough, text colour, highlight, alignment, bullet and numbered lists, indent, links (https only).
- Insert and edit tables: choose a size, add or remove rows and columns, turn the header row on or off, colour cells, delete the table.
- Upload photos and pictures (PNG or JPEG, phone photos included), set their width and place; insert the company logo from Settings.
- Insert a line or a page break.
- Insert fields (customer name, site name, start date, payment days and the rest of the fixed list) anywhere in the text.
- Insert live sections that fill from each agreement: price lines table, visit schedule, service included, equipment list, terms, and, for the contract, signatures. Each section has its own options (title, column labels, visits format and so on) and the price table carries the template's preset lines.
- Mark a paragraph "hide when a field is empty".
- Switch between Edit and Preview: Preview shows the real PDF of what is on screen, saved or not, on sample data or on one of the company's own agreements, and can open or download it.
- Open a saved template's preview page from the Templates list (every member can).

## Decisions (confirmed by the owner, 2026-11-23)

1. Engine: TipTap (ProseMirror). Its JSON is stored as template body schema 3 and drawn by the app itself into the PDF and the customer page.
2. Preview: live and unsaved inside the editor; a separate preview page shows the saved version.
3. Scope: both agreement templates and the contract wording move to the new editor.
4. Price table: an agreement page without it shows a warning but can be saved. A contract page must keep its signatures section (the signing service places its fields there).

## Business rules

- Only owners and admins edit templates; every member can preview them.
- A saved template is a new immutable version; agreements and contracts already made keep the version they used.
- Older templates open in the new editor converted; nothing changes until the owner saves.
- Only the listed formatting, fields and parts are stored. Anything pasted that the page cannot draw is dropped; colours are stored as `#rrggbb`, sizes snap to the offered list, fonts become sans, serif or monospace.
- Text may not contain `{{...}}` (the signing service reads those as its own fields); typed known fields become field chips.
- A picture must be an upload of the same company. A picture that cannot be read is left out of the PDF; the PDF still goes out.
- Tables cannot hold merged cells, tables or live sections; live sections and page breaks sit on the page itself.
- Each live section appears at most once.

## Acceptance criteria

- An owner can build a page with a coloured title, a table with a coloured header row, an uploaded photo, the company logo, a field and the price and visit schedule sections, save it, and see the same page in the PDF.
- Text pasted from Word keeps bold, italic, underline, colours, sizes, lists and tables, and saves.
- An agreement page with no price table saves and shows the warning; a contract page cannot lose its signatures.
- Preview draws the unsaved page on sample data and on a chosen agreement of the company; another company's agreement is refused.
- Older templates and every agreement and contract already sent print exactly as before.
- The editor works by touch at 375, 768 and 1440 pixels wide, with every control at least 44 pixels on phones and tablets.

## Out of scope (now)

- Columns, page background, headers and footers drawn freely (the letterhead and footer options stay as they are).
- Merged table cells.
- Deleting uploaded pictures (sent versions draw them).
- Fonts beyond the three built into every PDF reader.
- Starter designs per trade.
