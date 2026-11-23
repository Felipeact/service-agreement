import type { LayoutItem } from "../agreement/layout";
import { TEMPLATE_VARIABLES, type TemplateVariable } from "../contract/template";
import type { InlineNode, ParagraphNode, RichDoc, RichMark, TableCellNode, TopNode } from "./types";

const VARIABLE = /\{\{([^{}]*)\}\}/g;
const isVariable = (name: string): name is TemplateVariable => (TEMPLATE_VARIABLES as readonly string[]).includes(name);

/** Text with `{{name}}` fields as inline nodes, each carrying `marks`. An unknown name stays as typed, so nothing is lost. */
export function inlineFromText(text: string, marks: RichMark[] = []): InlineNode[] {
  const out: InlineNode[] = [];
  const withMarks = <T extends object>(node: T) => (marks.length > 0 ? { ...node, marks } : node);
  let last = 0;
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1].trim();
    if (!isVariable(name)) continue;
    if (match.index > last) out.push(withMarks({ type: "text" as const, text: text.slice(last, match.index) }));
    out.push(withMarks({ type: "variable" as const, attrs: { name } }));
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(withMarks({ type: "text" as const, text: text.slice(last) }));
  return out;
}

const paragraphOf = (text: string): ParagraphNode => {
  const content = inlineFromText(text);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
};

/**
 * A schema 1 or 2 layout as a designed page (rich-templates), for opening an older template in the Word-style editor: headings and
 * paragraphs keep their text, fields, alignment, weight and indent; a clause becomes a paragraph that is left out when a field is
 * empty (as a clause was); a page break before a block becomes a page break; a table keeps its cells and header row; each section
 * becomes the same live section with the same options. Nothing is stored until the tenant saves.
 */
export function richFromLayout(layout: readonly LayoutItem[]): RichDoc {
  const content: TopNode[] = [];
  for (const item of layout) {
    if (item.kind === "section") {
      const options = "options" in item && item.options ? (item.options as Record<string, unknown>) : undefined;
      // `heading` is a drawing-only option (a schema 1 contract's "Signatures" title); the page says it as a heading instead.
      if (options && "heading" in options) {
        const { heading, ...rest } = options;
        content.push({ type: "heading", attrs: { level: 2 }, content: inlineFromText(String(heading)) });
        content.push({ type: "section", attrs: Object.keys(rest).length > 0 ? { key: item.key, options: rest } : { key: item.key } });
      } else {
        content.push({ type: "section", attrs: options ? { key: item.key, options } : { key: item.key } });
      }
    } else if (item.kind === "table") {
      const rows = item.rows.map((row, index) => ({
        type: "tableRow" as const,
        content: row.map((text): TableCellNode => ({ type: item.header && index === 0 ? "tableHeader" : "tableCell", content: [paragraphOf(text)] })),
      }));
      content.push({ type: "table", content: rows });
    } else if (item.kind === "block") {
      if (item.pageBreakBefore) content.push({ type: "pageBreak" });
      const marks: RichMark[] = [...(item.style?.bold ? [{ type: "bold" as const }] : []), ...(item.style?.italic ? [{ type: "italic" as const }] : [])];
      const inline = inlineFromText(item.text, marks);
      const attrs = {
        ...(item.style?.align && item.style.align !== "left" ? { textAlign: item.style.align } : {}),
        ...(item.indent ? { indent: item.indent as 1 | 2 | 3 } : {}),
      };
      if (item.type === "heading") {
        content.push({ type: "heading", attrs: { ...attrs, level: item.level === 2 ? 2 : 1 }, content: inline });
      } else {
        const clause = item.type === "clause" ? { omitIfMissing: true as const } : {};
        const all = { ...attrs, ...clause };
        content.push({ type: "paragraph", ...(Object.keys(all).length > 0 ? { attrs: all } : {}), ...(inline.length > 0 ? { content: inline } : {}) });
      }
    } else {
      content.push(...(item.nodes as TopNode[]));
    }
  }
  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}
