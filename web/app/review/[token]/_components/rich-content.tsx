import type { CSSProperties, ReactNode } from "react";
import type { CellContent, InlineNode, ListNode, RichBlock, RichMark, TableNode } from "@/domain/rich-document";

/**
 * A run of a designed page (schema 3) on the customer's review page: the same nodes the PDF draws, as plain React elements. Nothing is
 * read as HTML. The only inline styles are the tenant's own choices (a colour, a size, a column's share), which no class can hold.
 */
/** `bare`: drawn without its panel, as the page header is. */
export function RichContent({ nodes, accent, imageUrls, logoUrl, tenantName, bare = false }: { nodes: readonly RichBlock[]; accent: string; imageUrls: Record<string, string>; logoUrl: string | null; tenantName: string; bare?: boolean }) {
  return (
    <div data-rich-page className={`flex min-w-0 flex-col gap-2 text-[14px] leading-relaxed text-ink ${bare ? "[&>:first-child]:mt-0" : "rounded-panel border border-hairline bg-surface px-4 py-4 shadow-card sm:px-6"}`}>
      {nodes.map((node, index) => (
        <Block key={index} node={node} context={{ accent, imageUrls, logoUrl, tenantName }} />
      ))}
    </div>
  );
}

type Context = { accent: string; imageUrls: Record<string, string>; logoUrl: string | null; tenantName: string };

const FAMILIES = { "sans-serif": "font-sans", serif: "font-serif", monospace: "font-mono" } as const;
const ALIGN = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" } as const;
const INDENT = { 1: "ml-6", 2: "ml-12", 3: "ml-18" } as const;
const SIDE = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;
const LOGO = { small: "max-h-8 max-w-[100px]", medium: "max-h-12 max-w-[160px]", large: "max-h-20 max-w-[240px]" } as const;

function Run({ text, marks }: { text: string; marks?: readonly RichMark[] }) {
  const has = (type: RichMark["type"]) => marks?.some((mark) => mark.type === type) ?? false;
  const style = marks?.find((mark) => mark.type === "textStyle")?.attrs;
  const highlight = marks?.find((mark) => mark.type === "highlight")?.attrs.color;
  const href = marks?.find((mark) => mark.type === "link")?.attrs.href;
  const classes = [
    has("bold") ? "font-semibold" : "",
    has("italic") ? "italic" : "",
    has("underline") || href ? "underline" : "",
    has("strike") ? "line-through" : "",
    style?.fontFamily ? FAMILIES[style.fontFamily] : "",
    href && !style?.color ? "text-action" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const custom: CSSProperties = {
    ...(style?.color ? { color: style.color } : {}),
    ...(style?.fontSize ? { fontSize: style.fontSize } : {}),
    ...(highlight ? { backgroundColor: highlight } : {}),
  };
  const styled = Object.keys(custom).length > 0 ? custom : undefined;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} style={styled}>
        {text}
      </a>
    );
  }
  return classes || styled ? (
    <span className={classes || undefined} style={styled}>
      {text}
    </span>
  ) : (
    <>{text}</>
  );
}

function Inline({ content }: { content: readonly InlineNode[] | undefined }): ReactNode {
  if (!content || content.length === 0) return <br />;
  return content.map((node, index) => (node.type === "text" ? <Run key={index} text={node.text} marks={node.marks} /> : node.type === "hardBreak" ? <br key={index} /> : null));
}

function List({ node, context }: { node: ListNode; context: Context }) {
  const items = node.content.map((item, index) => (
    <li key={index} className="pl-1">
      {item.content.map((child, at) => (
        <Block key={at} node={child} context={context} />
      ))}
    </li>
  ));
  return node.type === "orderedList" ? (
    <ol start={node.attrs?.start ?? 1} className="list-decimal pl-6">
      {items}
    </ol>
  ) : (
    <ul className="list-disc pl-6">{items}</ul>
  );
}

function Table({ node, context }: { node: TableNode; context: Context }) {
  const first = node.content[0]?.content ?? [];
  const widths = first.map((cell) => cell.attrs?.colwidth?.[0]);
  const total = widths.every((width) => typeof width === "number") ? (widths as number[]).reduce((sum, width) => sum + width, 0) : 0;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        {total > 0 && (
          <colgroup>
            {(widths as number[]).map((width, index) => (
              <col key={index} style={{ width: `${(width / total) * 100}%` }} />
            ))}
          </colgroup>
        )}
        <tbody>
          {node.content.map((row, r) => (
            <tr key={r}>
              {row.content.map((cell, c) => {
                const Cell = cell.type === "tableHeader" ? "th" : "td";
                return (
                  <Cell
                    key={c}
                    scope={cell.type === "tableHeader" ? "col" : undefined}
                    className={`border border-hairline px-2 py-1.5 align-top ${cell.type === "tableHeader" ? "text-left font-semibold" : ""}`}
                    style={cell.attrs?.background ? { backgroundColor: cell.attrs.background } : undefined}
                  >
                    {cell.content.map((child, at) => (
                      <Block key={at} node={child} context={context} />
                    ))}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ node, context }: { node: RichBlock | CellContent; context: Context }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p className={`break-words ${node.attrs?.textAlign ? ALIGN[node.attrs.textAlign] : ""} ${node.attrs?.indent ? INDENT[node.attrs.indent] : ""}`}>
          <Inline content={node.content} />
        </p>
      );
    case "heading": {
      const Tag = (["h2", "h3", "h4"] as const)[node.attrs.level - 1];
      const size = node.attrs.level === 1 ? "text-[20px] mt-2" : node.attrs.level === 2 ? "text-[17px] mt-2" : "text-[15px]";
      return (
        <Tag
          className={`font-bold break-words ${size} ${node.attrs.textAlign ? ALIGN[node.attrs.textAlign] : ""} ${node.attrs.indent ? INDENT[node.attrs.indent] : ""}`}
          style={node.attrs.level === 2 ? { color: context.accent } : undefined}
        >
          <Inline content={node.content} />
        </Tag>
      );
    }
    case "bulletList":
    case "orderedList":
      return <List node={node} context={context} />;
    case "table":
      return <Table node={node} context={context} />;
    case "image": {
      const src = context.imageUrls[node.attrs.asset];
      if (!src) return null;
      return (
        <div className={`flex ${SIDE[node.attrs.align]}`}>
          {/* A tenant upload of any size from a public bucket; next/image would need the bucket host configured for a picture that is drawn once. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-auto max-w-full rounded-[2px]" style={{ width: `${node.attrs.width}%` }} />
        </div>
      );
    }
    case "companyLogo":
      return context.logoUrl ? (
        <div className={`flex ${SIDE[node.attrs.align]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={context.logoUrl} alt={`${context.tenantName} logo`} className={`h-auto w-auto ${LOGO[node.attrs.size]}`} />
        </div>
      ) : null;
    case "horizontalRule":
      return <hr className="my-2 border-hairline" />;
    case "pageBreak":
      // A page break is a PDF matter; on screen it is a little more room.
      return <div aria-hidden="true" className="h-2" />;
    default:
      return null;
  }
}
