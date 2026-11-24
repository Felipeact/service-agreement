import type { TemplateVariable } from "../contract/template";

/**
 * A designed document page (rich-templates): the JSON a Word-style editor writes, a strict subset of the TipTap / ProseMirror
 * document format. The domain owns the shape and its rules; the editor, the PDF and the customer page each draw it. Nothing here is
 * HTML: every node, mark and attribute is listed below and a validator refuses anything else.
 */

export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;
export type RichAlign = (typeof TEXT_ALIGNS)[number];

/** The sizes the toolbar offers, in points on the page (CSS pixels in the editor). */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;
export type FontSize = `${(typeof FONT_SIZES)[number]}px`;

/** The three faces every PDF reader has (Helvetica, Times, Courier), named as CSS generic families so the editor draws them as is. */
export const FONT_FAMILIES = ["sans-serif", "serif", "monospace"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const IMAGE_ALIGNS = ["left", "center", "right"] as const;
export type ImageAlign = (typeof IMAGE_ALIGNS)[number];
export const LOGO_NODE_SIZES = ["small", "medium", "large"] as const;
export type LogoNodeSize = (typeof LOGO_NODE_SIZES)[number];

/** `#rrggbb`, lower case. */
export type HexColor = string;

export type BoldMark = { type: "bold" };
export type ItalicMark = { type: "italic" };
export type UnderlineMark = { type: "underline" };
export type StrikeMark = { type: "strike" };
export type TextStyleMark = { type: "textStyle"; attrs: { color?: HexColor; fontSize?: FontSize; fontFamily?: FontFamily } };
export type HighlightMark = { type: "highlight"; attrs: { color: HexColor } };
export type LinkMark = { type: "link"; attrs: { href: string } };
export type RichMark = BoldMark | ItalicMark | UnderlineMark | StrikeMark | TextStyleMark | HighlightMark | LinkMark;
export const MARK_TYPES = ["bold", "italic", "underline", "strike", "textStyle", "highlight", "link"] as const;

export type TextNode = { type: "text"; text: string; marks?: RichMark[] };
/** A merge field: drawn as the variable's value, with the marks of the text around it. */
export type VariableNode = { type: "variable"; attrs: { name: TemplateVariable }; marks?: RichMark[] };
export type HardBreakNode = { type: "hardBreak" };
export type InlineNode = TextNode | VariableNode | HardBreakNode;

export type BlockAttrs = { textAlign?: RichAlign; indent?: 1 | 2 | 3 };
/** `omitIfMissing`: the paragraph is left out when one of its fields has no value (what a clause did before schema 3). */
export type ParagraphNode = { type: "paragraph"; attrs?: BlockAttrs & { omitIfMissing?: true }; content?: InlineNode[] };
export type HeadingNode = { type: "heading"; attrs: BlockAttrs & { level: 1 | 2 | 3 }; content?: InlineNode[] };

export type ListItemNode = { type: "listItem"; content: CellContent[] };
export type BulletListNode = { type: "bulletList"; content: ListItemNode[] };
export type OrderedListNode = { type: "orderedList"; attrs?: { start?: number }; content: ListItemNode[] };
export type ListNode = BulletListNode | OrderedListNode;

/** A picture the tenant uploaded: its key in the `template-images` bucket, its width as a share of the text width, where it sits. */
export type ImageNode = { type: "image"; attrs: { asset: string; width: number; align: ImageAlign } };
/** The company's own logo from Settings, whatever it is when the document is drawn. */
export type CompanyLogoNode = { type: "companyLogo"; attrs: { size: LogoNodeSize; align: ImageAlign } };

export type CellContent = ParagraphNode | HeadingNode | ListNode | ImageNode | CompanyLogoNode | HorizontalRuleNode;
export type CellAttrs = { background?: HexColor; colwidth?: number[] };
export type TableCellNode = { type: "tableCell" | "tableHeader"; attrs?: CellAttrs; content: CellContent[] };
export type TableRowNode = { type: "tableRow"; content: TableCellNode[] };
export type TableNode = { type: "table"; content: TableRowNode[] };

export type HorizontalRuleNode = { type: "horizontalRule" };
export type PageBreakNode = { type: "pageBreak" };

/** A live part of the document drawn from the agreement's own data: the price lines table, the visit schedule and so on. */
export type SectionNode = { type: "section"; attrs: { key: string; options?: Record<string, unknown> } };

export type RichBlock = ParagraphNode | HeadingNode | ListNode | TableNode | ImageNode | CompanyLogoNode | HorizontalRuleNode | PageBreakNode;
export type TopNode = RichBlock | SectionNode;
export type RichDoc = { type: "doc"; content: TopNode[] };

export const EMPTY_RICH_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

/** The limits of one page design (rich-templates). */
export const RICH_LIMITS = {
  nodes: 5000,
  depth: 10,
  textChars: 80_000,
  textNodeChars: 10_000,
  images: 30,
  tableRows: 40,
  tableColumns: 8,
  href: 500,
  orderedStart: 9999,
} as const;
