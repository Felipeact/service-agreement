"use client";

import { useState } from "react";
import { useItemWords } from "@/components/shell/item-words";
import type { SectionKey } from "@/domain/agreement/layout";
import type { BlockType, TemplateVariable } from "@/domain/contract/template";
import { itemText, type ItemWords } from "@/domain/org-settings";
import { availableParts, VARIABLES, VARIABLE_LABELS, type EditorDocument } from "@/domain/templates/editor-model";
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

/** What a part is called in the panel and on the page; the equipment part takes the org's own word. */
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

const ITEM = "flex min-h-11 w-full items-center gap-3 border-b border-ink-nav px-3 text-left text-[13px] font-medium text-surface lg:min-h-10";

type Props = {
  document: EditorDocument;
  rows: readonly LayoutRow[];
  onAdd: (choice: AddChoice) => void;
  onVariable: (name: TemplateVariable) => void;
  /** Whether a text block is selected, so a field chip has somewhere to go. */
  canInsertVariable: boolean;
};

/**
 * The Add Element panel (template-editor-v2 S2): a short list on the left of the page, Writing and Document parts, and the merge fields as
 * chips. Below 1024 px it is a bottom sheet opened by an Add button, and choosing something closes it.
 */
export function AddElementPanel({ document, rows, onAdd, onVariable, canInsertVariable }: Props) {
  const words = useItemWords();
  const [tab, setTab] = useState<"writing" | "parts">("writing");
  const [sheet, setSheet] = useState(false);
  const parts = availableParts(rows, document);
  const choose = (choice: AddChoice) => {
    onAdd(choice);
    setSheet(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet(true)}
        className="fixed right-4 bottom-4 z-30 inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-action px-5 text-[13px] font-semibold text-surface shadow-card lg:hidden"
      >
        Add
      </button>
      <aside
        aria-label="Add element"
        className={`${sheet ? "fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] overflow-y-auto rounded-t-panel" : "hidden"} flex-col bg-night text-night-ink shadow-card lg:static lg:flex lg:max-h-none lg:rounded-panel`}
      >
        <header className="flex min-h-12 items-center justify-between px-4 font-display text-[16px] font-semibold text-surface">
          Add element
          <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="inline-flex size-11 items-center justify-center text-night-ink lg:hidden">
            ×
          </button>
        </header>
        <div role="tablist" aria-label="Kinds of element" className="flex bg-ink text-[11px] font-semibold tracking-wide uppercase">
          {(
            [
              ["writing", "Writing"],
              ["parts", "Document parts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-11 flex-1 border-b-[3px] px-2 ${tab === id ? "border-action text-surface" : "border-transparent text-night-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "writing" ? (
          <div role="tabpanel" aria-label="Writing" className="flex flex-col">
            {WRITING.map(({ type, label, glyph }) => (
              <button key={type} type="button" onClick={() => choose({ kind: "block", type })} className={`${ITEM} hover:bg-action`}>
                <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-control bg-ink-nav font-semibold">
                  {glyph}
                </span>
                {label}
              </button>
            ))}
            <div className="flex flex-col gap-2 px-3 py-3">
              <p className="text-[11px] font-semibold tracking-wide uppercase">Insert a field</p>
              {!canInsertVariable && <p className="text-[12px]">Select a text block to insert a field into it.</p>}
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={!canInsertVariable}
                    // The field keeps its caret: pressing a chip must not take focus from the text.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onVariable(name)}
                    className="inline-flex min-h-11 items-center rounded-full bg-ink-nav px-3 text-[12px] text-surface disabled:opacity-50 lg:min-h-8"
                  >
                    {VARIABLE_LABELS[name]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Document parts" className="flex flex-col">
            {parts.every((part) => part.onPage) && <p className="px-3 py-3 text-[12px]">Every part is on the page.</p>}
            {parts.map(({ key, onPage }) => (
              <button
                key={key}
                type="button"
                aria-disabled={onPage}
                onClick={() => {
                  if (!onPage) choose({ kind: "part", key });
                }}
                className={`${ITEM} ${onPage ? "cursor-default text-night-ink" : "hover:bg-action"}`}
              >
                <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-control bg-ink-nav font-semibold">
                  {partGlyph(key)}
                </span>
                <span className="flex-1">{partName(key, words)}</span>
                {onPage && <span className="text-[11px]">On page</span>}
              </button>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
