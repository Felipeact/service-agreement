import type { ReactNode } from "react";
import { Image, Link, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ThemeFont } from "@/domain/agreement";
import type { TenantLogo } from "@/domain/org-settings/logo";
import type { CellContent, FontFamily, InlineNode, ListNode, RichBlock, RichMark, TableNode } from "@/domain/rich-document";
import { LOGO_BOXES, logoBox, logoSize } from "./logo";

/** The pictures a page draws, by upload key; a key with no bytes is left out of the PDF. */
export type RichImages = Record<string, TenantLogo>;

/** Letter width less the page's side margins (pdf-sections `styles.page`), in points. */
export const CONTENT_WIDTH = 612 - 2 * 48;
/** The tallest a picture may be drawn, so one can never be taller than a page. */
const MAX_IMAGE_HEIGHT = 600;
const INDENT = 16;
const INK = "#111827";
const HAIRLINE = "#d1d5db";
const LINK = "#2563eb";

const FACES: Record<FontFamily, { regular: string; bold: string; italic: string; boldItalic: string }> = {
  "sans-serif": { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique", boldItalic: "Helvetica-BoldOblique" },
  serif: { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic", boldItalic: "Times-BoldItalic" },
  monospace: { regular: "Courier", bold: "Courier-Bold", italic: "Courier-Oblique", boldItalic: "Courier-BoldOblique" },
};

/** The built-in PDF face for a family, weight and slant. */
export function richFace(family: FontFamily, bold: boolean, italic: boolean): string {
  const faces = FACES[family];
  return bold && italic ? faces.boldItalic : bold ? faces.bold : italic ? faces.italic : faces.regular;
}

type Context = {
  accent: string;
  /** The page's own family, from the template's font. */
  family: FontFamily;
  images: RichImages;
  logo?: TenantLogo;
  /** The width the current block can use, in points: the text width, or a table column's. */
  width: number;
};

/** What a heading of each level looks like: level 1 as the document's title style, level 2 as a section title in the accent colour. */
const HEADINGS = {
  1: { fontSize: 13, marginTop: 18, marginBottom: 4 },
  2: { fontSize: 11, marginTop: 18, marginBottom: 6 },
  3: { fontSize: 10, marginTop: 10, marginBottom: 4 },
} as const;

/** The style of one run of text: its face from the family, weight and slant, then its colour, size, highlight and lines. */
function runStyle(marks: readonly RichMark[] | undefined, context: Context, bold: boolean): Style {
  const has = (type: RichMark["type"]) => marks?.some((mark) => mark.type === type) ?? false;
  const style = marks?.find((mark) => mark.type === "textStyle")?.attrs;
  const highlight = marks?.find((mark) => mark.type === "highlight")?.attrs.color;
  const link = has("link");
  const decorations = [has("underline") || link ? "underline" : null, has("strike") ? "line-through" : null].filter(Boolean).join(" ");
  return {
    fontFamily: richFace(style?.fontFamily ?? context.family, bold || has("bold"), has("italic")),
    ...(style?.color ? { color: style.color } : link ? { color: LINK } : {}),
    ...(style?.fontSize ? { fontSize: Number.parseInt(style.fontSize, 10) } : {}),
    ...(highlight ? { backgroundColor: highlight } : {}),
    ...(decorations ? { textDecoration: decorations as Style["textDecoration"] } : {}),
  };
}

function Runs({ content, context, bold = false }: { content: readonly InlineNode[] | undefined; context: Context; bold?: boolean }) {
  // An empty line keeps its height, as it does in the editor.
  if (!content || content.length === 0) return <>{" "}</>;
  return (
    <>
      {content.map((node, index) => {
        if (node.type === "hardBreak") return <Text key={index}>{"\n"}</Text>;
        // A field is filled before drawing; one left here (a document drawn unfilled) prints nothing.
        if (node.type !== "text") return null;
        const style = runStyle(node.marks, context, bold);
        const href = node.marks?.find((mark) => mark.type === "link")?.attrs.href;
        return href ? (
          <Link key={index} src={href} style={style}>
            {node.text}
          </Link>
        ) : (
          <Text key={index} style={style}>
            {node.text}
          </Text>
        );
      })}
    </>
  );
}

const alignOf = (align: string | undefined): Style => (align ? { textAlign: align as Style["textAlign"] } : {});
const sideOf = (align: "left" | "center" | "right"): Style["alignItems"] => (align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start");

function Picture({ bytes, width, align, context }: { bytes: TenantLogo | undefined; width: number; align: "left" | "center" | "right"; context: Context }) {
  const size = bytes ? logoSize(bytes) : null;
  if (!bytes || !size || size.width <= 0 || size.height <= 0) return null;
  let drawn = context.width * (width / 100);
  let height = (drawn * size.height) / size.width;
  if (height > MAX_IMAGE_HEIGHT) {
    drawn = (drawn * MAX_IMAGE_HEIGHT) / height;
    height = MAX_IMAGE_HEIGHT;
  }
  return (
    <View style={{ alignItems: sideOf(align), marginBottom: 6 }} wrap={false}>
      {/* A react-pdf Image draws into the PDF; it is not an HTML img and has no alt prop. */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={{ data: Buffer.from(bytes.bytes), format: bytes.format }} style={{ width: drawn, height }} />
    </View>
  );
}

function List({ node, context }: { node: ListNode; context: Context }) {
  const start = node.type === "orderedList" ? (node.attrs?.start ?? 1) : 1;
  return (
    <View style={{ marginBottom: 4 }}>
      {node.content.map((item, index) => (
        <View key={index} style={{ flexDirection: "row" }}>
          <Text style={{ width: 16 }}>{node.type === "orderedList" ? `${start + index}.` : "•"}</Text>
          <View style={{ flex: 1 }}>
            {item.content.map((child, at) => (
              <Block key={at} node={child} context={{ ...context, width: context.width - 16 }} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function Table({ node, context }: { node: TableNode; context: Context }) {
  const first = node.content[0]?.content ?? [];
  const widths = first.map((cell) => cell.attrs?.colwidth?.[0]);
  // Columns keep the share of the width the editor gave them; with none set, they share it evenly.
  const shares = widths.every((width) => typeof width === "number") ? (widths as number[]) : first.map(() => 1);
  const total = shares.reduce((sum, share) => sum + share, 0) || 1;
  return (
    <View style={{ marginBottom: 8, borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: HAIRLINE }}>
      {node.content.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }} wrap={false}>
          {row.content.map((cell, c) => {
            const share = shares[c] ?? 1;
            const width = (context.width * share) / total;
            return (
              <View
                key={c}
                style={{
                  width,
                  padding: 4,
                  borderRightWidth: 0.5,
                  borderBottomWidth: 0.5,
                  borderColor: HAIRLINE,
                  ...(cell.attrs?.background ? { backgroundColor: cell.attrs.background } : {}),
                }}
              >
                {cell.content.map((child, at) => (
                  <Block key={at} node={child} context={{ ...context, width: width - 8 }} bold={cell.type === "tableHeader"} tight />
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Block({ node, context, bold = false, tight = false }: { node: RichBlock | CellContent; context: Context; bold?: boolean; tight?: boolean }) {
  switch (node.type) {
    case "paragraph":
      return (
        <Text style={[{ marginBottom: tight ? 0 : 4, marginLeft: (node.attrs?.indent ?? 0) * INDENT, color: INK }, alignOf(node.attrs?.textAlign)]}>
          <Runs content={node.content} context={context} bold={bold} />
        </Text>
      );
    case "heading": {
      const look = HEADINGS[node.attrs.level];
      return (
        <Text
          style={[
            { fontSize: look.fontSize, marginTop: tight ? 0 : look.marginTop, marginBottom: look.marginBottom, marginLeft: (node.attrs.indent ?? 0) * INDENT, color: node.attrs.level === 2 ? context.accent : INK },
            alignOf(node.attrs.textAlign),
          ]}
          minPresenceAhead={tight ? undefined : 40}
        >
          <Runs content={node.content} context={context} bold />
        </Text>
      );
    }
    case "bulletList":
    case "orderedList":
      return <List node={node} context={context} />;
    case "table":
      return <Table node={node} context={context} />;
    case "image":
      return <Picture bytes={context.images[node.attrs.asset]} width={node.attrs.width} align={node.attrs.align} context={context} />;
    case "companyLogo": {
      const size = context.logo ? logoSize(context.logo) : null;
      if (!context.logo || !size || size.width <= 0 || size.height <= 0) return null;
      return (
        <View style={{ alignItems: sideOf(node.attrs.align), marginBottom: 6 }} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={{ data: Buffer.from(context.logo.bytes), format: context.logo.format }} style={logoBox(size.width, size.height, LOGO_BOXES[node.attrs.size])} />
        </View>
      );
    }
    case "horizontalRule":
      return <View style={{ borderBottomWidth: 1, borderBottomColor: HAIRLINE, marginVertical: 8 }} />;
    case "pageBreak":
      return <View break />;
    default:
      return null;
  }
}

/** A run of a designed page (schema 3) in the PDF: the same nodes the editor shows, in the built-in faces. */
/** `compact`: the first block takes no space above it, as at the top of a header. */
export function RichContent({ nodes, accent, font, images = {}, logo, compact = false }: { nodes: readonly RichBlock[]; accent: string; font?: ThemeFont; images?: RichImages; logo?: TenantLogo; compact?: boolean }) {
  const context: Context = { accent, family: font === "serif" ? "serif" : "sans-serif", images, logo, width: CONTENT_WIDTH };
  return (
    <>
      {nodes.map((node, index) => (
        <Block key={index} node={node} context={context} tight={compact && index === 0 && node.type === "heading"} />
      ))}
    </>
  );
}

/**
 * The page's header in the PDF: a designed one (schema 3) as its blocks, `null` for none, or the letterhead the document options describe
 * (`fallback`) for a document with no designed header. Printed on every page when the options say so.
 */
export function PageHeaderBlock({ header, fallback, every, accent, font, images, logo }: { header: readonly RichBlock[] | null | undefined; fallback: ReactNode; every: boolean; accent: string; font?: ThemeFont; images?: RichImages; logo?: TenantLogo }) {
  if (header === null) return null;
  const drawn = header === undefined ? fallback : (
    <View style={{ marginBottom: 6 }}>
      <RichContent nodes={header} accent={accent} font={font} images={images} logo={logo} compact />
    </View>
  );
  return every ? <View fixed>{drawn}</View> : <>{drawn}</>;
}
