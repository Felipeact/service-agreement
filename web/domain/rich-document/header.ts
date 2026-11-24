import type { LetterheadOptions } from "../agreement/layout";
import type { TemplateValues } from "../contract/template";
import { renderRichDoc } from "./render";
import type { RichBlock, RichDoc } from "./types";

const GREY = { type: "textStyle", attrs: { color: "#4b5563" } } as const;

/**
 * The header a page starts with, made from the letterhead options an older template set: the logo at its size and side, the company's
 * name as a heading in the page's colour, the address and the phone in grey, each as a field, then a rule. From here the tenant edits it
 * as any text.
 */
export function headerFromLetterhead(options: LetterheadOptions): RichDoc {
  const align = options.align === "center" ? { textAlign: "center" as const } : {};
  const content: RichDoc["content"] = [];
  if (options.logo) content.push({ type: "companyLogo", attrs: { size: options.logoSize, align: options.align === "center" ? "center" : "left" } });
  if (options.name) content.push({ type: "heading", attrs: { level: 2, ...align }, content: [{ type: "variable", attrs: { name: "tenant.legalName" }, marks: [{ type: "textStyle", attrs: { fontSize: "16px" } }] }] });
  const contact = [
    ...(options.address ? [{ type: "variable" as const, attrs: { name: "tenant.address" as const }, marks: [GREY] }] : []),
    ...(options.address && options.phone ? [{ type: "hardBreak" as const }] : []),
    ...(options.phone ? [{ type: "variable" as const, attrs: { name: "tenant.phone" as const }, marks: [GREY] }] : []),
  ];
  if (contact.length > 0) content.push({ type: "paragraph", ...(options.align === "center" ? { attrs: align } : {}), content: contact });
  content.push({ type: "horizontalRule" });
  return { type: "doc", content };
}

/** A header's blocks with its fields filled, as a document draws them. */
export function renderRichHeader(header: RichDoc, values: TemplateValues): RichBlock[] {
  return renderRichDoc(header, values).flatMap((item) => (item.kind === "rich" ? item.nodes : []));
}
