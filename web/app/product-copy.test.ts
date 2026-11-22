import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const WEB = path.join(__dirname, "..");
const ROOT = path.join(WEB, "..");

const read = (file: string) => readFileSync(file, "utf8");
const source = (file: string) => read(path.join(__dirname, file));
const document = (file: string) => read(path.join(ROOT, file));

/** JSX text spells an apostrophe as an entity; the page shows it as one character. */
const shown = (text: string) => text.replace(/&apos;|&#39;|&#x27;/g, "'").trim();

/** The text of the one `<p>` whose class list matches, as the page shows it (inline markup such as an accent `<span>` is dropped). */
function paragraph(file: string, classPattern: string) {
  const match = source(file).match(new RegExp(`<p className="[^"]*${classPattern}[^"]*">([\\s\\S]*?)</p>`));
  expect(match, `a <p> matching ${classPattern} in ${file}`).not.toBeNull();
  return shown(match![1].replace(/<[^>]+>/g, "").replace(/\s+/g, " "));
}

/** Files generated from, or written to, the owner's mockups say so in their doc comment. */
const MOCKUP_MARKER = "docs/service_pacts_";
const ONE_LINER = "Recurring service agreements for trade contractors, from the customer's list to signature.";
const FORBIDDEN = ["HVAC", "mechanical contractors", "PM agreement", "Preventive-maintenance"] as const;
const SCANNED = ["app", "components", "application", "domain", "infrastructure", "lib"] as const;

/** The forbidden words found in a text (case-sensitive: "preventive-maintenance" in a drawing's comment is fine). */
const forbiddenIn = (text: string) => FORBIDDEN.filter((word) => text.includes(word));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".next" ? [] : sourceFiles(full);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/\.testing\.ts$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

/** The text from a heading line up to the next heading of the same or a higher level. */
function section(text: string, startLine: string, endLine: string) {
  const start = text.indexOf(startLine);
  const end = text.indexOf(endLine, start + startLine.length);
  expect(start, `${startLine} in the document`).toBeGreaterThanOrEqual(0);
  return text.slice(start, end === -1 ? undefined : end);
}

describe("the product's own copy, outside the org's item words", () => {
  test("C2301: the root layout's description names the product by what it does, for any trade", () => {
    const layout = source("layout.tsx");
    expect(layout).toContain(`const description = "${ONE_LINER}"`);
    // The one constant feeds the page, Open Graph and Twitter metadata.
    expect(layout.match(/\bdescription\b(?=[,\s}])/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  test("C2302: the sign-in headline (from the owner's mockup) is 'From service list to signed agreement.' and no longer than 40 characters", () => {
    const content = source("login/_components/content.tsx");
    const heading = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    const headline = shown(heading.replace(/\{" "\}/g, " ").replace(/<br \/>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    expect(headline).toBe("From service list to signed agreement.");
    expect(headline.length).toBeLessThanOrEqual(40);
  });

  test.each(SCANNED)("C2305: no forbidden word in the non-test source under web/%s", (dir) => {
    const files = sourceFiles(path.join(WEB, dir));
    expect(files.length, `files scanned under ${dir}`).toBeGreaterThan(0);
    // The owner's mockup pages carry their own marketing copy verbatim (decided 2026-11-22), HVAC and all; they are marked by their source comment.
    const hits = files.flatMap((file) => (read(file).includes(MOCKUP_MARKER) ? [] : forbiddenIn(read(file)).map((word) => `${path.relative(WEB, file)}: ${word}`)));
    expect(hits).toEqual([]);
  });

  test("C2305: every scanned directory exists", () => {
    for (const dir of SCANNED) expect(existsSync(path.join(WEB, dir)), dir).toBe(true);
  });

  test.each(FORBIDDEN)("C2306: the scan reports %s when it is present", (word) => {
    expect(forbiddenIn(`before ${word} after`)).toEqual([word]);
  });

  test("C2306: the scan reports nothing for text with none of the words", () => {
    expect(forbiddenIn("Recurring service agreements for trade contractors. A preventive-maintenance drawing.")).toEqual([]);
  });

  test("C2310: PRODUCT.md uses no PM abbreviation and no 'preventive-maintenance'", () => {
    const product = document("PRODUCT.md");
    expect(product).not.toMatch(/\bPM\b/);
    expect(product).not.toMatch(/preventive-maintenance/i);
  });

  test("C2311: PRODUCT.md names HVAC only as the first trade or the starter catalog, never in Purpose or Positioning", () => {
    const product = document("PRODUCT.md");
    const hvacLines = product.split("\n").filter((line) => line.includes("HVAC"));
    expect(hvacLines.length).toBeGreaterThan(0);
    for (const line of hvacLines) expect(line, line.slice(0, 80)).toMatch(/first trade|starter catalog/);
    expect(section(product, "## Product Purpose", "## Operating Context")).not.toContain("HVAC");
  });

  test("C2312: docs/DESIGN.md (Field Protocol) never presents one trade alone: HVAC appears only beside the other trades", () => {
    const design = document("docs/DESIGN.md");
    const hvacLines = design.split("\n").filter((line) => line.includes("HVAC"));
    expect(hvacLines.length).toBeGreaterThan(0);
    for (const line of hvacLines) expect(line, line.slice(0, 80)).toMatch(/plumb/i);
    expect(design.match(/^name: .+$/m), "the frontmatter names the system").not.toBeNull();
  });

  test("C2313: docs/DESIGN.md carries none of the retired wording ('PM agreement', 'Preventive-maintenance', 'mechanical contractors')", () => {
    const design = document("docs/DESIGN.md");
    expect(FORBIDDEN.filter((word) => word !== "HVAC" && design.includes(word))).toEqual([]);
  });

  test("C2314: CONTEXT.md's Tenant entry and Service agreement heading carry no HVAC or PM wording", () => {
    const context = document("CONTEXT.md");
    expect(section(context, "### Tenant (Org) and roles", "\n### ")).not.toContain("(HVAC or mechanical)");
    const heading = context.split("\n").find((line) => line.startsWith("### Service agreement"));
    expect(heading).toBeDefined();
    expect(heading).not.toContain("PM agreement");
  });

  test("C2315: the CONTEXT.md build log records this feature on 2026-11-09", () => {
    const log = section(document("CONTEXT.md"), "## Build log", "\n## ");
    expect(log.split("\n").some((line) => line.includes("2026-11-09") && line.includes("trade-neutral-copy"))).toBe(true);
  });
});
