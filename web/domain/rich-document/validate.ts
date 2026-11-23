import { TEMPLATE_VARIABLES } from "../contract/template";
import { checkSectionOptions, type LayoutError, type LayoutSpec, type SectionKey } from "../agreement/layout";
import { isRecord, isWhole, unknownKeys } from "../guards";
import { FONT_FAMILIES, FONT_SIZES, IMAGE_ALIGNS, LOGO_NODE_SIZES, MARK_TYPES, RICH_LIMITS, TEXT_ALIGNS, type RichDoc } from "./types";

/** An uploaded picture's key: `<org id>/<uuid>.png|jpg`, both ids lower-case UUIDs. */
export const IMAGE_ASSET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$/;
const HEX = /^#[0-9a-f]{6}$/;
const MAX_ERRORS = 20;

export type RichSpec = LayoutSpec & {
  /** When given, every picture must be one of this org's uploads. */
  orgId?: string;
  /** The page's header: it holds no live sections and no page breaks. */
  header?: true;
};

type Where = "top" | "cell" | "list";

/** What a list item may hold after its first line: the blocks a cell may hold. */
const LIST_CHILDREN = ["paragraph", "heading", "bulletList", "orderedList", "image", "companyLogo", "horizontalRule"];

const SIZES = FONT_SIZES.map((size) => `${size}px`);
const has = (list: readonly unknown[], value: unknown) => list.includes(value);

/** The readable name of a node for a message. */
const NAMES: Record<string, string> = {
  paragraph: "A paragraph",
  heading: "A heading",
  bulletList: "A bullet list",
  orderedList: "A numbered list",
  listItem: "A list item",
  table: "A table",
  tableRow: "A table row",
  tableCell: "A table cell",
  tableHeader: "A table header cell",
  image: "A picture",
  companyLogo: "The company logo",
  horizontalRule: "A line",
  pageBreak: "A page break",
  section: "A live section",
};
const nameOf = (type: unknown) => NAMES[String(type)] ?? `A part of type ${String(type)}`;

/**
 * The rules of a designed page (rich-templates): only the listed nodes, marks and attributes, where each may sit, the limits on its
 * size, the merge-field whitelist, uploads of this org only, and each live section at most once with the required ones present.
 * Every problem comes back as `{ field, message }`, at most 20, so a broken paste cannot flood the editor.
 */
export function validateRichDoc(input: unknown, spec: RichSpec): LayoutError[] {
  const errors: LayoutError[] = [];
  const push = (field: string, message: string) => {
    if (errors.length < MAX_ERRORS) errors.push({ field, message });
  };
  const count = { nodes: 0, text: 0, images: 0, tables: 0 };
  const sections = new Map<string, number>();

  if (!isRecord(input) || input.type !== "doc" || !Array.isArray(input.content)) {
    return [{ field: "content", message: "The page is not a document." }];
  }
  if (unknownKeys(input, ["type", "content"]).length > 0) push("content", "The page has an unknown key.");

  const checkMarks = (marks: unknown, at: string) => {
    if (marks === undefined) return;
    if (!Array.isArray(marks) || marks.length === 0) {
      push(at, "Text has formatting that is not a list.");
      return;
    }
    const seen = new Set<unknown>();
    for (const mark of marks) {
      if (!isRecord(mark) || !has(MARK_TYPES, mark.type)) {
        push(at, `Text has formatting this editor does not draw: ${isRecord(mark) ? String(mark.type) : "unknown"}.`);
        continue;
      }
      if (seen.has(mark.type)) push(at, `Text has the ${String(mark.type)} formatting twice.`);
      seen.add(mark.type);
      const attrs = mark.attrs;
      const plain = mark.type === "bold" || mark.type === "italic" || mark.type === "underline" || mark.type === "strike";
      if (unknownKeys(mark, plain ? ["type"] : ["type", "attrs"]).length > 0) push(at, `The ${String(mark.type)} formatting has an unknown key.`);
      if (plain) continue;
      if (!isRecord(attrs)) {
        push(at, `The ${String(mark.type)} formatting has no settings.`);
        continue;
      }
      if (mark.type === "textStyle") {
        if (unknownKeys(attrs, ["color", "fontSize", "fontFamily"]).length > 0 || Object.keys(attrs).length === 0) push(at, "A text style has an unknown or empty setting.");
        if ("color" in attrs && !(typeof attrs.color === "string" && HEX.test(attrs.color))) push(at, "A text colour must be #rrggbb.");
        if ("fontSize" in attrs && !has(SIZES, attrs.fontSize)) push(at, `A text size must be one of ${FONT_SIZES.join(", ")}.`);
        if ("fontFamily" in attrs && !has(FONT_FAMILIES, attrs.fontFamily)) push(at, "A font must be sans-serif, serif or monospace.");
      } else if (mark.type === "highlight") {
        if (unknownKeys(attrs, ["color"]).length > 0 || !(typeof attrs.color === "string" && HEX.test(attrs.color))) push(at, "A highlight colour must be #rrggbb.");
      } else if (mark.type === "link") {
        const href = attrs.href;
        let https = false;
        try {
          https = typeof href === "string" && new URL(href).protocol === "https:";
        } catch {
          https = false;
        }
        if (unknownKeys(attrs, ["href"]).length > 0 || !https) push(at, "A link must be an https address.");
        else if ((href as string).length > RICH_LIMITS.href) push(at, `A link is too long (at most ${RICH_LIMITS.href} characters).`);
      }
    }
  };

  const checkInline = (node: unknown, at: string) => {
    count.nodes += 1;
    if (!isRecord(node)) {
      push(at, "A piece of text is not an object.");
      return;
    }
    if (node.type === "text") {
      if (unknownKeys(node, ["type", "text", "marks"]).length > 0) push(at, "A piece of text has an unknown key.");
      if (typeof node.text !== "string" || node.text.length === 0) push(at, "A piece of text is empty.");
      else if (node.text.length > RICH_LIMITS.textNodeChars) push(at, `A run of text is too long (at most ${RICH_LIMITS.textNodeChars} characters).`);
      // Braces would reach the PDF as typed, where `{{…}}` is how the signing service finds its fields: only real field chips may use them.
      else if (/\{\{[^{}]*\}\}/.test(node.text)) push(at, `The text "${node.text.slice(0, 40)}" uses double braces. Insert fields from the Fields list instead.`);
      else count.text += node.text.length;
      checkMarks(node.marks, at);
    } else if (node.type === "variable") {
      if (unknownKeys(node, ["type", "attrs", "marks"]).length > 0) push(at, "A field has an unknown key.");
      const name = isRecord(node.attrs) ? node.attrs.name : undefined;
      if (!isRecord(node.attrs) || unknownKeys(node.attrs, ["name"]).length > 0 || !has(TEMPLATE_VARIABLES, name)) push(at, `The page uses an unknown field: ${String(name)}.`);
      checkMarks(node.marks, at);
    } else if (node.type === "hardBreak") {
      if (unknownKeys(node, ["type"]).length > 0) push(at, "A line break has an unknown key.");
    } else {
      push(at, `${nameOf(node.type)} cannot sit inside a line of text.`);
    }
  };

  const checkInlineContent = (node: Record<string, unknown>, at: string) => {
    if (node.content === undefined) return;
    if (!Array.isArray(node.content)) {
      push(at, `${nameOf(node.type)} has content that is not a list.`);
      return;
    }
    node.content.forEach((child, index) => checkInline(child, `${at}.${index}`));
  };

  const checkAlign = (attrs: Record<string, unknown>, at: string) => {
    if ("textAlign" in attrs && !has(TEXT_ALIGNS, attrs.textAlign)) push(at, "Text must align left, center, right or justify.");
    if ("indent" in attrs && !(isWhole(attrs.indent) && attrs.indent >= 1 && attrs.indent <= 3)) push(at, "An indent must be 1, 2 or 3.");
  };

  const checkNode = (node: unknown, at: string, where: Where, depth: number) => {
    count.nodes += 1;
    if (depth > RICH_LIMITS.depth) {
      push(at, "The page is nested too deeply (lists or tables inside each other).");
      return;
    }
    if (!isRecord(node)) {
      push(at, "A part of the page is not an object.");
      return;
    }
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const children = Array.isArray(node.content) ? node.content : [];
    const needChildren = (label: string) => {
      if (children.length === 0) push(at, `${label} is empty.`);
    };
    const keys = (allowed: string[]) => {
      if (unknownKeys(node, allowed).length > 0) push(at, `${nameOf(node.type)} has an unknown key: ${unknownKeys(node, allowed)[0]}.`);
      if ("attrs" in node && !isRecord(node.attrs)) push(at, `${nameOf(node.type)} has settings that are not an object.`);
    };

    switch (node.type) {
      case "paragraph":
        keys(["type", "attrs", "content"]);
        if (unknownKeys(attrs, ["textAlign", "indent", "omitIfMissing"]).length > 0) push(at, "A paragraph has an unknown setting.");
        if ("omitIfMissing" in attrs && attrs.omitIfMissing !== true) push(at, "Hide when a field is empty must be on or absent.");
        checkAlign(attrs, at);
        checkInlineContent(node, at);
        return;
      case "heading":
        keys(["type", "attrs", "content"]);
        if (unknownKeys(attrs, ["textAlign", "indent", "level"]).length > 0) push(at, "A heading has an unknown setting.");
        if (!has([1, 2, 3], attrs.level)) push(at, "A heading level must be 1, 2 or 3.");
        checkAlign(attrs, at);
        checkInlineContent(node, at);
        return;
      case "bulletList":
      case "orderedList":
        keys(["type", "attrs", "content"]);
        if (node.type === "bulletList" && "attrs" in node) push(at, "A bullet list has no settings.");
        if (node.type === "orderedList" && (unknownKeys(attrs, ["start"]).length > 0 || ("start" in attrs && !(isWhole(attrs.start) && attrs.start >= 0 && attrs.start <= RICH_LIMITS.orderedStart)))) {
          push(at, "A numbered list must start at a whole number.");
        }
        needChildren(nameOf(node.type));
        children.forEach((child, index) => {
          if (!isRecord(child) || child.type !== "listItem") push(`${at}.${index}`, "A list holds list items only.");
          else checkNode(child, `${at}.${index}`, "list", depth + 1);
        });
        return;
      case "listItem":
        keys(["type", "content"]);
        needChildren("A list item");
        children.forEach((child, index) => {
          const type = isRecord(child) ? child.type : undefined;
          if (index === 0 && type !== "paragraph") push(`${at}.${index}`, "A list item starts with a line of text.");
          else if (!LIST_CHILDREN.includes(String(type))) push(`${at}.${index}`, `${nameOf(type)} cannot sit inside a list.`);
          else checkNode(child, `${at}.${index}`, "list", depth + 1);
        });
        return;
      case "table": {
        keys(["type", "content"]);
        if (where !== "top") {
          push(at, "A table cannot sit inside a table or a list.");
          return;
        }
        count.tables += 1;
        const n = count.tables;
        if (children.length < 1 || children.length > RICH_LIMITS.tableRows) push(at, `Table ${n} needs 1 to ${RICH_LIMITS.tableRows} rows.`);
        let width = -1;
        children.forEach((row, r) => {
          const rowAt = `${at}.${r}`;
          count.nodes += 1;
          if (!isRecord(row) || row.type !== "tableRow" || !Array.isArray(row.content) || unknownKeys(row, ["type", "content"]).length > 0) {
            push(rowAt, `Table ${n} has a row that is not a row.`);
            return;
          }
          if (width === -1) width = row.content.length;
          if (row.content.length < 1 || row.content.length > RICH_LIMITS.tableColumns) push(rowAt, `Table ${n} needs 1 to ${RICH_LIMITS.tableColumns} columns.`);
          else if (row.content.length !== width) push(rowAt, `Every row of table ${n} must have the same number of cells.`);
          row.content.forEach((cell, c) => {
            const cellAt = `${rowAt}.${c}`;
            count.nodes += 1;
            if (!isRecord(cell) || (cell.type !== "tableCell" && cell.type !== "tableHeader")) {
              push(cellAt, `Table ${n} has a cell that is not a cell.`);
              return;
            }
            if (unknownKeys(cell, ["type", "attrs", "content"]).length > 0) push(cellAt, `A cell of table ${n} has an unknown key.`);
            const cellAttrs = isRecord(cell.attrs) ? cell.attrs : {};
            if ("colspan" in cellAttrs || "rowspan" in cellAttrs) push(cellAt, `Table ${n} has merged cells, which the PDF cannot draw. Split them.`);
            else if (unknownKeys(cellAttrs, ["background", "colwidth"]).length > 0) push(cellAt, `A cell of table ${n} has an unknown setting.`);
            if ("background" in cellAttrs && !(typeof cellAttrs.background === "string" && HEX.test(cellAttrs.background))) push(cellAt, "A cell colour must be #rrggbb.");
            if ("colwidth" in cellAttrs && !(Array.isArray(cellAttrs.colwidth) && cellAttrs.colwidth.length === 1 && isWhole(cellAttrs.colwidth[0]) && cellAttrs.colwidth[0] > 0 && cellAttrs.colwidth[0] <= 2000)) {
              push(cellAt, "A column width must be a whole number of pixels.");
            }
            const content = Array.isArray(cell.content) ? cell.content : [];
            if (content.length === 0) push(cellAt, `A cell of table ${n} is empty.`);
            content.forEach((child, index) => checkNode(child, `${cellAt}.${index}`, "cell", depth + 2));
          });
        });
        return;
      }
      case "image": {
        keys(["type", "attrs"]);
        count.images += 1;
        if (unknownKeys(attrs, ["asset", "width", "align"]).length > 0) push(at, "A picture has an unknown setting.");
        const asset = attrs.asset;
        if (typeof asset !== "string" || !IMAGE_ASSET.test(asset)) push(at, "A picture is not one of your uploads. Upload it again.");
        else if (spec.orgId !== undefined && !asset.startsWith(`${spec.orgId}/`)) push(at, "A picture belongs to another company. Upload it again.");
        if (!(isWhole(attrs.width) && attrs.width >= 10 && attrs.width <= 100)) push(at, "A picture's width must be 10 to 100 percent.");
        if (!has(IMAGE_ALIGNS, attrs.align)) push(at, "A picture must sit left, center or right.");
        return;
      }
      case "companyLogo":
        keys(["type", "attrs"]);
        if (unknownKeys(attrs, ["size", "align"]).length > 0 || !has(LOGO_NODE_SIZES, attrs.size) || !has(IMAGE_ALIGNS, attrs.align)) {
          push(at, "The company logo needs a size (small, medium or large) and a place (left, center or right).");
        }
        return;
      case "horizontalRule":
        keys(["type"]);
        return;
      case "pageBreak":
        keys(["type"]);
        if (spec.header) push(at, "A header holds no page breaks.");
        else if (where !== "top") push(at, "A page break must sit on the page, not inside a table or a list.");
        return;
      case "section": {
        keys(["type", "attrs"]);
        if (spec.header) {
          push(at, "A header holds no live sections; put them on the page.");
          return;
        }
        if (where !== "top") {
          push(at, "A live section must sit on the page, not inside a table or a list.");
          return;
        }
        const key = attrs.key;
        if (unknownKeys(attrs, ["key", "options"]).length > 0) push(at, "A live section has an unknown setting.");
        if (typeof key !== "string" || !(spec.sections as readonly string[]).includes(key)) {
          push(at, `The page has a live section this ${spec.noun} does not have: ${String(key)}.`);
          return;
        }
        sections.set(key, (sections.get(key) ?? 0) + 1);
        if (sections.get(key) === 2) push(at, `The ${SECTION_LABELS[key as SectionKey]} is on the page more than once; keep one.`);
        if ("options" in attrs) {
          const found: LayoutError[] = [];
          checkSectionOptions(key as SectionKey, attrs.options, at, sections.size, found);
          for (const error of found) push(error.field, error.message.replace(/ of item \d+/g, "").replace(/item \d+/g, "this section"));
        }
        return;
      }
      default:
        push(at, `${nameOf(node.type)} is not something this editor draws.`);
    }
  };

  input.content.forEach((node, index) => checkNode(node, `content.${index}`, "top", 1));

  if (count.nodes > RICH_LIMITS.nodes) push("content", `The page has too many parts (${count.nodes}, at most ${RICH_LIMITS.nodes}). Split it or remove some.`);
  if (count.text > RICH_LIMITS.textChars) push("content", `The page has too much text (${count.text} characters, at most ${RICH_LIMITS.textChars}).`);
  if (count.images > RICH_LIMITS.images) push("content", `The page has too many pictures (${count.images}, at most ${RICH_LIMITS.images}).`);
  for (const key of spec.required) {
    if (!sections.has(key)) push("content", `The page needs the ${SECTION_LABELS[key]}.`);
  }
  return errors;
}

/** What each live section is called on screen. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  price: "price lines table",
  schedule: "visit schedule",
  included: "service included",
  equipment: "equipment list",
  terms: "terms",
  signatures: "signatures",
};

/** Notes that do not stop a save: an agreement page with no price lines table shows the customer no price. */
export function richWarnings(doc: RichDoc, noun: "agreement" | "contract"): string[] {
  const keys = new Set(doc.content.flatMap((node) => (node.type === "section" ? [node.attrs.key] : [])));
  const warnings: string[] = [];
  if (!keys.has("price")) warnings.push(`No price lines table: your customer won't see prices on this ${noun}.`);
  return warnings;
}

/** The rules of a page's header: the page's rules, with no live sections and no page breaks. */
export const HEADER_SPEC = (noun: "agreement" | "contract", orgId?: string): RichSpec => ({ sections: [], required: [], noun, orgId, header: true });
