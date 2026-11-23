import { fillOptions, type LayoutItem, type SectionItem } from "../agreement/layout";
import type { TemplateValues } from "../contract/template";
import type { InlineNode, RichBlock, RichDoc, TopNode } from "./types";

type AnyNode = { type: string; content?: AnyNode[]; attrs?: Record<string, unknown>; marks?: unknown[]; text?: string };

/** The node with every merge field replaced by its value as plain text, in the field's own formatting; a field with no value prints nothing. */
function fillNode<T extends AnyNode>(node: T, values: TemplateValues): T | null {
  if (!node.content) return node;
  if (node.type === "paragraph" && node.attrs?.omitIfMissing === true && node.content.some((child) => child.type === "variable" && !values[(child.attrs?.name ?? "") as keyof TemplateValues])) {
    return null;
  }
  const content: AnyNode[] = [];
  for (const child of node.content) {
    if (child.type === "variable") {
      const name = (child.attrs?.name ?? "") as keyof TemplateValues;
      const value = values[name] ?? null;
      if (value === null || value === "") continue;
      content.push(child.marks ? { type: "text", text: value, marks: child.marks } : { type: "text", text: value });
    } else {
      const filled = fillNode(child, values);
      if (filled !== null) content.push(filled);
    }
  }
  return { ...node, content };
}

/**
 * What a designed page draws (schema 3), in order, merge fields filled: each live section becomes the section item the documents
 * already draw, and the parts between two sections become one `rich` item. Values are inserted as text and never read for fields again.
 * With `values` `null` the page is split but not filled (fields stay fields), as a thumbnail or an outline reads it.
 */
export function renderRichDoc(doc: RichDoc, values: TemplateValues | null): LayoutItem[] {
  const items: LayoutItem[] = [];
  let run: RichBlock[] = [];
  const flush = () => {
    if (run.length > 0) items.push({ kind: "rich", nodes: run });
    run = [];
  };
  for (const node of doc.content as TopNode[]) {
    if (node.type === "section") {
      flush();
      const section = { kind: "section", key: node.attrs.key, ...(node.attrs.options ? { options: node.attrs.options } : {}) } as SectionItem;
      items.push(values === null ? section : fillOptions(section, values));
    } else {
      const filled = values === null ? (node as AnyNode) : fillNode(node as AnyNode, values);
      if (filled !== null) run.push(filled as unknown as RichBlock);
    }
  }
  flush();
  return items;
}

/** The plain text of inline content, fields as their names: used for a page's outline and its thumbnail. */
export function inlineText(content: readonly InlineNode[] | undefined): string {
  return (content ?? []).map((node) => (node.type === "text" ? node.text : node.type === "variable" ? `{{${node.attrs.name}}}` : " ")).join("");
}

/** The upload keys a page draws, each once, in order. */
export function imageAssetsOf(nodes: readonly unknown[]): string[] {
  const keys: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const value = node as AnyNode;
    if (value.type === "image" && typeof value.attrs?.asset === "string" && !keys.includes(value.attrs.asset)) keys.push(value.attrs.asset);
    value.content?.forEach(walk);
  };
  nodes.forEach(walk);
  return keys;
}

/** The upload keys of a rendered layout's designed runs. */
export const layoutImageAssets = (layout: readonly LayoutItem[] | undefined): string[] =>
  imageAssetsOf((layout ?? []).flatMap((item) => (item.kind === "rich" ? item.nodes : [])));
