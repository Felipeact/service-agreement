"use client";

import { useEffect, useState, type DragEvent, type KeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { useItemWords } from "@/components/shell/item-words";
import { MAX_INDENT, PRICE_COLUMN_KEYS, type DocOptions, type PriceColumns } from "@/domain/agreement/layout";
import { messagesByRow, type BlockRow, type LayoutRow, type SectionRow } from "@/domain/agreement/layout-form";
import type { TemplateFormLine } from "@/domain/agreement/template-form";
import { itemText, type ItemWords } from "@/domain/org-settings";
import { canMove, DRAG_TYPE, dropPosition, isRequired, readDragPayload, variableLabel, type DragPayload, type EditorDocument } from "@/domain/templates/editor-model";
import { partName } from "./add-element-panel";

const BLOCK_NAME = { heading: "Heading", paragraph: "Text", clause: "Clause" } as const;
const DEFAULT_COLUMNS: PriceColumns = { description: "Description", visits: "Visits per year", perVisit: "Per visit", perYear: "Per year", total: "Total per year" };
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** The 44px touch size below desktop, shared by every control on the page. */
const TOOL = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-ink hover:bg-ground disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-action aria-pressed:text-action lg:min-h-8 lg:min-w-8";

/** A text with its `{{variables}}` drawn as chips; a name that is not on the whitelist stays as typed and flagged. */
export function WithChips({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^{}]*\}\})/);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\{\{([^{}]*)\}\}$/.exec(part);
        if (!match) return <span key={index}>{part}</span>;
        const name = match[1].trim();
        const label = variableLabel(name);
        return label ? (
          <span key={index} data-variable={name} className="mx-0.5 inline-flex rounded-full bg-action-tint px-2 text-[12px] font-medium text-action">
            {label}
          </span>
        ) : (
          <span key={index} className="mx-0.5 inline-flex rounded-full bg-attention-bg px-2 text-[12px] font-medium text-attention-fg">
            {part}
          </span>
        );
      })}
    </>
  );
}

function PartSample({ row, lines, words }: { row: SectionRow; lines: TemplateFormLine[] | undefined; words: ItemWords }) {
  const title = row.title.trim() || partName(row.key, words);
  const heading = <p className="text-[14px] font-semibold text-ink">{title}</p>;
  switch (row.key) {
    case "price": {
      const label = (key: keyof PriceColumns) => row.columns[key].trim() || DEFAULT_COLUMNS[key];
      const shown = lines && lines.length > 0 ? lines : null;
      return (
        <div className="flex flex-col gap-1.5">
          {heading}
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-ink-2">
                {PRICE_COLUMN_KEYS.filter((key) => key !== "total").map((key) => (
                  <th key={key} className="border-b border-hairline py-1 font-semibold">
                    {label(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown ? (
                shown.map((line, index) => (
                  <tr key={index}>
                    <td className="border-b border-hairline py-1">{line.description || "New line"}</td>
                    <td className="border-b border-hairline py-1">{line.visitMonths.length}</td>
                    <td className="border-b border-hairline py-1">{line.costPerVisit || "-"}</td>
                    <td className="border-b border-hairline py-1">-</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border-b border-hairline py-1 text-ink-2" colSpan={4}>
                    The services, their visits and prices from each agreement
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-1 font-semibold" colSpan={3}>
                  {label("total")}
                </td>
                <td className="py-1 font-semibold">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
    case "schedule":
      return (
        <div className="flex flex-col gap-1.5">
          {heading}
          <div className="grid grid-cols-12 gap-0.5" aria-hidden="true">
            {MONTHS.map((month, index) => (
              <span key={index} className={`rounded-sm py-0.5 text-center text-[10px] ${[2, 5, 8, 11].includes(index) ? "bg-action text-surface" : "bg-board text-ink-2"}`}>
                {month}
              </span>
            ))}
          </div>
        </div>
      );
    case "included":
      return (
        <div className="flex flex-col gap-1">
          {heading}
          <p className="text-[12px] text-ink-2">{itemText("The checklist for each equipment type on site", words)}</p>
        </div>
      );
    case "terms":
      return (
        <div className="flex flex-col gap-1">
          {heading}
          <p className="text-[12px] text-ink-2">The agreement terms: payment, cancellation, repair discount and governing province.</p>
        </div>
      );
    case "signatures":
      return (
        <div className="flex flex-col gap-2">
          {heading}
          <div className="grid grid-cols-2 gap-4 text-[11px] text-ink-2" aria-hidden="true">
            <span className="border-t border-field pt-1">{row.customerLabel.trim() || "For the Customer"}</span>
            <span className="border-t border-field pt-1">{row.contractorLabel.trim() || "For the Contractor"}</span>
          </div>
        </div>
      );
    default:
      // The one part left: the list of units on site.
      return (
        <div className="flex flex-col gap-1">
          {heading}
          <p className="text-[12px] text-ink-2">{itemText("Every unit on site, by type", words)}</p>
        </div>
      );
  }
}

/** The line a drop would land on: one rule across the page at the edge between two blocks. */
function DropLine() {
  return <span data-drop-line="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-1.5 z-10 h-0.5 rounded-full bg-action" />;
}

type Props = {
  document: EditorDocument;
  /** The company's name for the letterhead. */
  orgName: string;
  doc: DocOptions;
  rows: LayoutRow[];
  /** The preset lines shown in the price table (agreement templates only). */
  presetLines?: TemplateFormLine[];
  selected: number | null;
  /** Messages by the validator's field name. */
  errors: Record<string, string>;
  onSelect: (index: number | null) => void;
  onTitle: (title: string) => void;
  onPatch: (index: number, patch: Partial<BlockRow> | Partial<SectionRow>) => void;
  onMove: (index: number, by: -1 | 1) => void;
  onDelete: (index: number) => void;
  /** Where the selected text block's field reports itself, so a field chip can read its caret. */
  textRef: MutableRefObject<HTMLTextAreaElement | null>;
  /** What sits under the selected part: its options. */
  options?: (index: number, row: SectionRow) => ReactNode;
  /** A drag was dropped on the line before the row at `at` (`rows.length` is the end of the page). */
  onDropAt: (at: number, payload: DragPayload) => void;
};

/**
 * The document as a page you click (template-editor-v2 S1): the letterhead, the title and one block per layout row. A click, or Enter or
 * Space, selects a block; the selected block shows its toolbar and, for text, a field to type in. Parts show a labelled sample.
 */
export function EditorPage({ document, orgName, doc, rows, presetLines, selected, errors, onSelect, onTitle, onPatch, onMove, onDelete, textRef, options, onDropAt }: Props) {
  const words = useItemWords();
  const byRow = messagesByRow(errors);
  // The drop line a drag is over (the number of rows before it), and the row being dragged by its grip.
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // A drag that ends anywhere, with or without a drop, takes the line away.
  useEffect(() => {
    const clear = () => {
      setDropAt(null);
      setDragging(null);
    };
    window.document.addEventListener("dragend", clear);
    window.document.addEventListener("drop", clear);
    return () => {
      window.document.removeEventListener("dragend", clear);
      window.document.removeEventListener("drop", clear);
    };
  }, []);

  const carriesElement = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes(DRAG_TYPE);
  const lineFor = (event: DragEvent<HTMLElement>, index: number) => {
    const box = event.currentTarget.getBoundingClientRect();
    return dropPosition(index, event.clientY > box.top + box.height / 2);
  };
  const drop = (event: DragEvent, at: number) => {
    event.preventDefault();
    const payload = readDragPayload(event.dataTransfer.getData(DRAG_TYPE));
    setDropAt(null);
    setDragging(null);
    if (payload) onDropAt(at, payload);
  };

  return (
    <article
      aria-label="Document page"
      data-editor-document={document}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
      }}
      className="mx-auto flex w-full max-w-[44rem] flex-col gap-5 rounded-control bg-surface p-5 shadow-card sm:p-10">
      <header className="flex items-center gap-3 border-b border-hairline pb-4">
        <span aria-hidden="true" className="size-9 rounded-control bg-night" />
        <p className="text-[14px] font-semibold text-ink">{orgName}</p>
      </header>
      <div className="flex flex-col gap-1">
        <label htmlFor="document-title" className="sr-only">
          Document title
        </label>
        <input
          id="document-title"
          value={doc.title}
          onChange={(event) => onTitle(event.target.value)}
          aria-invalid={errors["doc.title"] ? true : undefined}
          className={`min-h-11 w-full rounded-control border bg-transparent px-2 font-display text-[22px] font-semibold tracking-tight text-ink hover:border-hairline lg:min-h-10 ${errors["doc.title"] ? "border-danger" : "border-transparent"}`}
        />
        {errors["doc.title"] && <p className="px-2 text-[12px] font-medium text-danger">{errors["doc.title"]}</p>}
      </div>

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const isSelected = selected === index;
          const messages = byRow.get(index) ?? [];
          const name = row.kind === "block" ? BLOCK_NAME[row.type] : partName(row.key, words);
          const at = (suffix: string) => errors[`layout.${index}.${suffix}`];
          const frame = `rounded-control border-[1.5px] p-3 ${messages.length > 0 ? "border-danger" : isSelected ? "border-action bg-action-tint/40" : "border-transparent hover:border-hairline"}`;
          const select = () => onSelect(index);
          const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select();
            }
          };
          const required = row.kind === "section" && isRequired(row, document);

          return (
            <li
              key={index}
              onDragOver={(event) => {
                if (!carriesElement(event)) return;
                event.preventDefault();
                setDropAt(lineFor(event, index));
              }}
              onDrop={(event) => drop(event, lineFor(event, index))}
              className={`relative flex items-start gap-1 ${dragging === index ? "opacity-50" : ""}`}
            >
              {dropAt === index && <DropLine />}
              <button
                type="button"
                draggable
                aria-label="Drag to move"
                onDragStart={(event) => {
                  const payload: DragPayload = { kind: "move", from: index };
                  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
                  event.dataTransfer.effectAllowed = "move";
                  setDragging(index);
                }}
                className="mt-1 inline-flex min-h-11 min-w-11 shrink-0 cursor-grab items-center justify-center rounded-control text-[14px] text-ink-2 hover:bg-board lg:min-h-8 lg:min-w-8"
              >
                ⋮⋮
              </button>
              <div className="min-w-0 flex-1">
              {row.kind === "block" && row.pageBreakBefore && <p className="mb-1 border-t border-dashed border-field pt-0.5 text-[11px] text-ink-2">Page break</p>}
              {isSelected ? (
                <div aria-current="true" aria-label={`${name}, selected`} role="group" className={`${frame} flex flex-col gap-3`}>
                  <div role="toolbar" aria-label={`${name} tools`} className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className={TOOL} aria-label="Move up" disabled={!canMove(rows, index, -1)} onClick={() => onMove(index, -1)}>
                      ↑
                    </button>
                    <button type="button" className={TOOL} aria-label="Move down" disabled={!canMove(rows, index, 1)} onClick={() => onMove(index, 1)}>
                      ↓
                    </button>
                    {row.kind === "block" && (
                      <>
                        <button type="button" className={TOOL} aria-label="Indent less" disabled={row.indent === 0} onClick={() => onPatch(index, { indent: (row.indent - 1) as BlockRow["indent"] })}>
                          ⇤
                        </button>
                        <button type="button" className={TOOL} aria-label="Indent more" disabled={row.indent === MAX_INDENT} onClick={() => onPatch(index, { indent: (row.indent + 1) as BlockRow["indent"] })}>
                          ⇥
                        </button>
                        <button type="button" className={TOOL} aria-label="Page break before" aria-pressed={row.pageBreakBefore} onClick={() => onPatch(index, { pageBreakBefore: !row.pageBreakBefore })}>
                          Page break
                        </button>
                        {row.type === "heading" && (
                          <>
                            <button type="button" className={TOOL} aria-label="Size 1" aria-pressed={row.level === 1} onClick={() => onPatch(index, { level: 1 })}>
                              Size 1
                            </button>
                            <button type="button" className={TOOL} aria-label="Size 2" aria-pressed={row.level === 2} onClick={() => onPatch(index, { level: 2 })}>
                              Size 2
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {required ? (
                      <span className="ml-auto inline-flex min-h-8 items-center rounded-full bg-board px-2.5 text-[11px] font-semibold text-ink-2">Required</span>
                    ) : (
                      <button type="button" className={`${TOOL} ml-auto text-danger`} aria-label="Delete" onClick={() => onDelete(index)}>
                        Delete
                      </button>
                    )}
                  </div>
                  {row.kind === "block" ? (
                    <textarea
                      id={`block-${index}-text`}
                      aria-label={`${name} text`}
                      aria-invalid={messages.length > 0 ? true : undefined}
                      rows={Math.max(row.type === "heading" ? 1 : 3, row.text.split("\n").length)}
                      value={row.text}
                      onChange={(event) => onPatch(index, { text: event.target.value })}
                      ref={(element) => {
                        textRef.current = element;
                        if (element && element.dataset.focused !== "1") {
                          element.dataset.focused = "1";
                          element.focus();
                          element.setSelectionRange(element.value.length, element.value.length);
                        }
                      }}
                      style={{ paddingLeft: `${0.5 + row.indent * 1.5}rem` }}
                      className={`w-full resize-y rounded-control border border-field bg-surface px-2 py-1.5 text-ink ${row.type === "heading" ? (row.level === 1 ? "text-[18px] font-semibold" : "text-[15px] font-semibold") : "text-[13px]"}`}
                    />
                  ) : (
                    <>
                      <PartSample row={row} lines={presetLines} words={words} />
                      {options?.(index, row)}
                    </>
                  )}
                  {messages.length > 0 && (
                    <ul role="alert" className="flex flex-col gap-0.5">
                      {messages.map((message) => (
                        <li key={message} className="text-[12px] font-medium text-danger">
                          {message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {row.kind === "block" && at("text") && messages.length === 0 && <p className="text-[12px] font-medium text-danger">{at("text")}</p>}
                </div>
              ) : (
                <div role="button" tabIndex={0} aria-label={`Select ${name} ${index + 1}`} onClick={select} onKeyDown={onKey} className={`${frame} flex cursor-pointer flex-col gap-1 ${row.kind === "section" ? "bg-ground/60" : ""}`}>
                  {row.kind === "block" ? (
                    <p
                      style={{ paddingLeft: `${row.indent * 1.5}rem` }}
                      className={`whitespace-pre-wrap text-ink ${row.type === "heading" ? (row.level === 1 ? "text-[18px] font-semibold" : "text-[15px] font-semibold") : "text-[13px]"} ${row.text.trim() === "" ? "text-ink-2" : ""}`}
                    >
                      {row.text.trim() === "" ? `Empty ${name.toLowerCase()}. Click to write.` : <WithChips text={row.text} />}
                    </p>
                  ) : (
                    <PartSample row={row} lines={presetLines} words={words} />
                  )}
                  {required && <span className="self-start rounded-full bg-board px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">Required</span>}
                  {messages.length > 0 && (
                    <ul role="alert" className="flex flex-col gap-0.5">
                      {messages.map((message) => (
                        <li key={message} className="text-[12px] font-medium text-danger">
                          {message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              </div>
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden="true"
        data-drop-end=""
        onDragOver={(event) => {
          if (!carriesElement(event)) return;
          event.preventDefault();
          setDropAt(rows.length);
        }}
        onDrop={(event) => drop(event, rows.length)}
        className="relative -mt-2 h-6"
      >
        {dropAt === rows.length && <DropLine />}
      </div>
    </article>
  );
}
