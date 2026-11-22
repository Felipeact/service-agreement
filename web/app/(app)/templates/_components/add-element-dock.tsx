"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { useItemWords } from "@/components/shell/item-words";
import type { SectionKey } from "@/domain/agreement/layout";
import type { BlockType, TemplateVariable } from "@/domain/contract/template";
import { itemText, type ItemWords } from "@/domain/org-settings";
import { availableParts, DRAG_TYPE, VARIABLES, VARIABLE_LABELS, type DragPayload, type EditorDocument } from "@/domain/templates/editor-model";
import type { LayoutRow } from "@/domain/agreement/layout-form";

export type AddChoice = { kind: "block"; type: BlockType } | { kind: "part"; key: SectionKey };

const WRITING: { type: BlockType; label: string; glyph: string }[] = [
  { type: "heading", label: "Heading", glyph: "H" },
  { type: "paragraph", label: "Text", glyph: "Aa" },
  { type: "clause", label: "Clause", glyph: "1." },
];

function partGlyph(key: SectionKey): string {
  switch (key) {
    case "price":
      return "$";
    case "schedule":
      return "▦";
    case "included":
      return "☰";
    case "equipment":
      return "▤";
    case "terms":
      return "§";
    case "signatures":
      return "✎";
  }
}

/** What a part is called in the dock and on the page; the equipment part takes the org's own word. */
export function partName(key: SectionKey, words: ItemWords): string {
  switch (key) {
    case "price":
      return "Price lines";
    case "schedule":
      return "Visit schedule";
    case "included":
      return "Service included";
    case "equipment":
      return itemText("Equipment", words);
    case "terms":
      return "Terms";
    case "signatures":
      return "Signatures";
  }
}

/** One dock control: a glyph over a label, 44px below desktop. */
const ITEM = "inline-flex min-h-11 min-w-11 shrink-0 cursor-grab flex-col items-center justify-center gap-0.5 rounded-control px-3 text-[11px] font-medium whitespace-nowrap text-night-ink hover:bg-ink-nav hover:text-surface lg:min-h-12";

type Props = {
  document: EditorDocument;
  rows: readonly LayoutRow[];
  onAdd: (choice: AddChoice) => void;
  onVariable: (name: TemplateVariable) => void;
  /** Whether a text block is selected, so a field has somewhere to go. */
  canInsertVariable: boolean;
  /** The letterhead controls, opened from a Header button at the end of the dock; absent, there is no button. */
  header?: ReactNode;
};

/**
 * The Add Element dock (template-editor-v2 S2): a dark pill that floats at the bottom of the page with Writing, Document parts and Field.
 * It sticks to the bottom of the screen while the page scrolls, and scrolls sideways inside itself when it is wider than the screen.
 * Click or tap an item to add it; on a computer an item can also be dragged onto the page.
 */
export function AddElementDock({ document, rows, onAdd, onVariable, canInsertVariable, header }: Props) {
  const words = useItemWords();
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const parts = availableParts(rows, document);

  const drag = (choice: AddChoice) => ({
    draggable: true as const,
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      const payload: DragPayload = { kind: "add", choice };
      event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
      event.dataTransfer.effectAllowed = "copy";
    },
  });

  return (
    <div className="sticky bottom-3 z-30 mx-auto flex w-fit max-w-full flex-col items-center gap-2">
      {headerOpen && header && (
        <div role="group" aria-label="Header" className="flex max-h-[60dvh] w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto rounded-panel border border-hairline bg-surface p-4 text-ink shadow-card">
          <p className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">Header</p>
          {header}
        </div>
      )}
      {fieldsOpen && (
        <div role="group" aria-label="Fields" className="flex max-h-[45dvh] w-[min(34rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto rounded-panel bg-night p-3 shadow-card">
          <p className="text-[11px] font-semibold tracking-wide text-night-ink uppercase">Insert a field</p>
          {!canInsertVariable && <p className="text-[12px] text-night-ink">Select a text block to insert a field into it.</p>}
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((name) => (
              <button
                key={name}
                type="button"
                disabled={!canInsertVariable}
                // The text keeps its caret: pressing a field must not take focus from it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onVariable(name);
                  setFieldsOpen(false);
                }}
                className="inline-flex min-h-11 items-center rounded-full bg-ink-nav px-3 text-[12px] text-surface disabled:opacity-50 lg:min-h-8"
              >
                {VARIABLE_LABELS[name]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div role="toolbar" aria-label="Add element" className="relative flex max-w-full items-center gap-1 overflow-x-auto rounded-panel bg-night p-1.5 shadow-card">
        {WRITING.map(({ type, label, glyph }) => (
          <button key={type} type="button" onClick={() => onAdd({ kind: "block", type })} {...drag({ kind: "block", type })} className={ITEM}>
            <span aria-hidden="true" className="text-[15px] font-semibold text-surface">
              {glyph}
            </span>
            {label}
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-ink-nav" />
        {parts.map(({ key, onPage }) => (
          <button
            key={key}
            type="button"
            aria-disabled={onPage}
            onClick={() => {
              if (!onPage) onAdd({ kind: "part", key });
            }}
            {...(onPage ? { draggable: false as const } : drag({ kind: "part", key }))}
            className={`${ITEM} ${onPage ? "cursor-default opacity-40" : ""}`}
          >
            <span aria-hidden="true" className="text-[15px] font-semibold text-surface">
              {partGlyph(key)}
            </span>
            {partName(key, words)}
            {onPage && <span className="sr-only">On page</span>}
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-ink-nav" />
        <button type="button" aria-expanded={fieldsOpen} aria-haspopup="true" onClick={() => {
            setFieldsOpen((was) => !was);
            setHeaderOpen(false);
          }} className={`${ITEM} cursor-pointer ${fieldsOpen ? "bg-action text-surface" : ""}`}>
          <span aria-hidden="true" className="text-[15px] font-semibold text-surface">
            {"{ }"}
          </span>
          Field
        </button>
        {header && (
          <>
            <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-ink-nav" />
            <button
              type="button"
              aria-expanded={headerOpen}
              aria-haspopup="true"
              onClick={() => {
                setHeaderOpen((was) => !was);
                setFieldsOpen(false);
              }}
              className={`${ITEM} cursor-pointer ${headerOpen ? "bg-action text-surface" : ""}`}
            >
              <span aria-hidden="true" className="text-[15px] font-semibold text-surface">
                ▭
              </span>
              Header
            </button>
          </>
        )}
      </div>
    </div>
  );
}
