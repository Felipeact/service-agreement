import { isRecord } from "../guards";
import { inlineFromText } from "./from-layout";
import { FONT_SIZES, type FontFamily, type RichMark } from "./types";

/**
 * The editor's JSON made into the stored shape (rich-templates): attributes the editor fills with `null` or a default are dropped,
 * colours become `#rrggbb`, a pasted size snaps to the nearest size the toolbar offers, a pasted font becomes one of the three faces,
 * and a link that is not https keeps its text but loses the link. Unknown nodes and marks are left for the validator to name.
 * Pure: the input is not changed.
 */
export function normalizeRichDoc(input: unknown): unknown {
  return normalizeNode(input);
}

/** `#rrggbb` from `#rgb`, `#rrggbb` or `rgb(r, g, b)`; `null` for anything else (a named colour, a transparent one). */
export function toHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null;
    const parts = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (parts.some((part) => part > 255)) return null;
    return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

/** The toolbar size nearest a pasted one (`13.33px`, `11pt`, `14`), as `14px`; `null` when it is not a size. */
export function toFontSize(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^\s*([\d.]+)\s*(px|pt)?\s*$/i.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * (match[2]?.toLowerCase() === "pt" ? 4 / 3 : 1);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let best: number = FONT_SIZES[0];
  for (const size of FONT_SIZES) if (Math.abs(size - amount) < Math.abs(best - amount)) best = size;
  return `${best}px`;
}

/** One of the three faces for any font name: a monospace one, a serif one, else sans-serif. */
export function toFontFamily(value: unknown): FontFamily | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const name = value.toLowerCase();
  if (/mono|courier|consolas|menlo/.test(name)) return "monospace";
  if (/sans/.test(name)) return "sans-serif";
  if (/serif|times|georgia|cambria|garamond|palatino|book/.test(name)) return "serif";
  return "sans-serif";
}

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

function normalizeMark(mark: unknown): unknown | null {
  if (!isRecord(mark)) return mark;
  const attrs = isRecord(mark.attrs) ? mark.attrs : {};
  switch (mark.type) {
    case "bold":
    case "italic":
    case "underline":
    case "strike":
      return { type: mark.type };
    case "textStyle": {
      const out: Record<string, string> = {};
      const color = toHex(attrs.color);
      const size = toFontSize(attrs.fontSize);
      const family = toFontFamily(attrs.fontFamily);
      if (color !== null) out.color = color;
      if (size !== null) out.fontSize = size;
      if (family !== null) out.fontFamily = family;
      return Object.keys(out).length === 0 ? null : { type: "textStyle", attrs: out };
    }
    case "highlight": {
      const color = toHex(attrs.color) ?? "#fef08a";
      return { type: "highlight", attrs: { color } };
    }
    case "link":
      return isHttpsUrl(attrs.href) ? { type: "link", attrs: { href: attrs.href } } : null;
    default:
      return mark;
  }
}

function normalizeMarks(marks: unknown): unknown[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out = marks.map(normalizeMark).filter((mark) => mark !== null);
  return out.length > 0 ? out : undefined;
}

function blockAttrs(attrs: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...extra };
  if (typeof attrs.textAlign === "string" && attrs.textAlign !== "left") out.textAlign = attrs.textAlign;
  const indent = Number(attrs.indent);
  if (Number.isInteger(indent) && indent > 0) out.indent = Math.min(indent, 3);
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A text node that spells known fields as `{{name}}` (typed or pasted) split into text and field nodes, its marks on each. */
function splitTypedFields(node: unknown): unknown[] {
  if (!isRecord(node) || node.type !== "text" || typeof node.text !== "string" || !node.text.includes("{{")) return [node];
  return inlineFromText(node.text, (Array.isArray(node.marks) ? node.marks : []) as RichMark[]);
}

function withContent(node: Record<string, unknown>, out: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(node.content)) {
    const content = node.content.map(normalizeNode).flatMap(splitTypedFields);
    if (content.length > 0) out.content = content;
  }
  return out;
}

const isEmptyParagraph = (node: unknown) => isRecord(node) && node.type === "paragraph" && node.attrs === undefined && (!Array.isArray(node.content) || node.content.length === 0);

function normalizeNode(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  switch (node.type) {
    case "doc": {
      const content = Array.isArray(node.content) ? node.content.map(normalizeNode) : [];
      // The editor keeps an empty line after the last part so there is always somewhere to type; at the end of the page it prints nothing.
      while (content.length > 1 && isEmptyParagraph(content[content.length - 1])) content.pop();
      return { type: "doc", content };
    }
    case "text": {
      const marks = normalizeMarks(node.marks);
      return marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
    }
    case "variable": {
      const marks = normalizeMarks(node.marks);
      return { type: "variable", attrs: { name: attrs.name }, ...(marks ? { marks } : {}) };
    }
    case "paragraph": {
      const out: Record<string, unknown> = { type: "paragraph" };
      const kept = blockAttrs(attrs, attrs.omitIfMissing === true ? { omitIfMissing: true } : {});
      if (kept) out.attrs = kept;
      return withContent(node, out);
    }
    case "heading":
      return withContent(node, { type: "heading", attrs: blockAttrs(attrs, { level: attrs.level }) });
    case "orderedList": {
      const start = Number(attrs.start);
      const out: Record<string, unknown> = { type: "orderedList" };
      if (Number.isInteger(start) && start !== 1) out.attrs = { start };
      return withContent(node, out);
    }
    case "bulletList":
    case "listItem":
    case "table":
    case "tableRow":
      return withContent(node, { type: node.type });
    case "tableCell":
    case "tableHeader": {
      const out: Record<string, unknown> = {};
      const background = toHex(attrs.background);
      if (background !== null) out.background = background;
      if (Array.isArray(attrs.colwidth) && attrs.colwidth.every((width) => typeof width === "number" && width > 0)) out.colwidth = attrs.colwidth.map(Math.round);
      // A merged cell is kept as it is so the validator can say merged cells are not drawn.
      if (attrs.colspan !== undefined && attrs.colspan !== 1) out.colspan = attrs.colspan;
      if (attrs.rowspan !== undefined && attrs.rowspan !== 1) out.rowspan = attrs.rowspan;
      return withContent(node, Object.keys(out).length > 0 ? { type: node.type, attrs: out } : { type: node.type });
    }
    case "image":
      return { type: "image", attrs: { asset: attrs.asset, width: attrs.width, align: attrs.align } };
    case "companyLogo":
      return { type: "companyLogo", attrs: { size: attrs.size, align: attrs.align } };
    case "section": {
      const options = isRecord(attrs.options) && Object.keys(attrs.options).length > 0 ? attrs.options : undefined;
      return { type: "section", attrs: options ? { key: attrs.key, options } : { key: attrs.key } };
    }
    case "hardBreak":
    case "horizontalRule":
    case "pageBreak":
      return { type: node.type };
    default:
      return node;
  }
}
