"use client";

import { useState, type ReactNode } from "react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";
import { useItemWords } from "@/components/shell/item-words";
import { Button } from "@/components/ui/button";
import type { SectionKey } from "@/domain/agreement/layout";
import type { SectionRow } from "@/domain/agreement/layout-form";
import { sectionOptionsOf, sectionRowOf } from "@/domain/agreement/rich-form";
import { VARIABLES, VARIABLE_LABELS, type EditorDocument } from "@/domain/templates/editor-model";
import { OptionsCard, PartOptions } from "../block-options";
import { sectionName } from "./section-sample";

const SEGMENT = "inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-hairline px-2 text-[12px] font-semibold aria-pressed:border-action aria-pressed:bg-action-tint aria-pressed:text-action lg:min-h-8";

type Selected = { type: "section" | "image" | "companyLogo"; attrs: Record<string, unknown>; pos: number } | null;

function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-[13px] font-medium">{label}</legend>
      <div className="flex gap-1.5">
        {options.map((option) => (
          <button key={String(option.value)} type="button" className={SEGMENT} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const SIDES = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

/** A live section's options, held here as typed (so a space at the end of a title survives) and written to the page on each change. */
function SectionOptions({ editor, selected, document, extra }: { editor: Editor; selected: NonNullable<Selected>; document: EditorDocument; extra?: (key: SectionKey) => ReactNode }) {
  const key = selected.attrs.key as SectionKey;
  const [row, setRow] = useState<SectionRow>(() => sectionRowOf(key, selected.attrs.options as Record<string, unknown> | null));
  const words = useItemWords();
  const locked = document === "contract" && key === "signatures";
  const write = (next: SectionRow) => {
    setRow(next);
    editor.chain().setNodeSelection(selected.pos).updateAttributes("section", { options: sectionOptionsOf(next) }).run();
  };
  return (
    <OptionsCard label={sectionName(key, words)}>
      <PartOptions row={row} id={`rich-${key}`} at={() => undefined} onChange={(patch) => write({ ...row, ...patch })} />
      {extra?.(key)}
      {locked ? (
        <p className="text-[12px] text-ink-2">A contract always has its signatures: the signing service places its fields there.</p>
      ) : (
        <Button variant="danger" onClick={() => editor.chain().focus().setNodeSelection(selected.pos).deleteSelection().run()}>
          Remove from the page
        </Button>
      )}
    </OptionsCard>
  );
}

function PictureOptions({ editor, selected }: { editor: Editor; selected: NonNullable<Selected> }) {
  const set = (attrs: Record<string, unknown>) => editor.chain().setNodeSelection(selected.pos).updateAttributes(selected.type, attrs).run();
  return (
    <OptionsCard label={selected.type === "image" ? "Picture" : "Company logo"}>
      {selected.type === "image" ? (
        <Segments
          label="Width"
          value={Number(selected.attrs.width)}
          options={[25, 50, 75, 100].map((width) => ({ value: width, label: `${width}%` }))}
          onChange={(width) => set({ width })}
        />
      ) : (
        <Segments
          label="Size"
          value={String(selected.attrs.size)}
          options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
          onChange={(size) => set({ size })}
        />
      )}
      <Segments label="Place" value={String(selected.attrs.align)} options={SIDES} onChange={(align) => set({ align })} />
      <Button variant="danger" onClick={() => editor.chain().focus().setNodeSelection(selected.pos).deleteSelection().run()}>
        Remove from the page
      </Button>
    </OptionsCard>
  );
}

type PanelProps = {
  editor: Editor;
  document: EditorDocument;
  /** What the price section shows under its options: the template's preset lines. */
  partExtras?: (key: SectionKey) => ReactNode;
  /** Called after an insert, so a panel opened as a sheet can close. */
  onInserted?: () => void;
};

/** The part selected on the page (a live section, a picture, the logo) and the live sections already on it. */
export function usePageParts(editor: Editor | null): { selected: Selected; onPage: Set<string> } {
  const found = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) return { selected: null as Selected, used: "" };
      const selection = current.state.selection;
      const node = selection instanceof NodeSelection ? selection.node : null;
      const keys: string[] = [];
      current.state.doc.forEach((child) => {
        if (child.type.name === "section") keys.push(String(child.attrs.key));
      });
      const kind = node?.type.name;
      return {
        selected: node && (kind === "section" || kind === "image" || kind === "companyLogo") ? ({ type: kind, attrs: { ...node.attrs }, pos: selection.from } as Selected) : null,
        used: keys.join(","),
      };
    },
    equalityFn: (a, b) => b !== null && a.used === b.used && JSON.stringify(a.selected) === JSON.stringify(b.selected),
  });
  return { selected: found?.selected ?? null, onPage: new Set((found?.used ?? "").split(",").filter(Boolean)) };
}

/** The options of the selected part, or nothing when no part is selected. */
export function SelectedOptions({ editor, document, partExtras }: Pick<PanelProps, "editor" | "document" | "partExtras">) {
  const { selected } = usePageParts(editor);
  if (selected?.type === "section") return <SectionOptions key={`${selected.pos}-${String(selected.attrs.key)}`} editor={editor} selected={selected} document={document} extra={partExtras} />;
  if (selected?.type === "image" || selected?.type === "companyLogo") return <PictureOptions editor={editor} selected={selected} />;
  return null;
}

/** One chip per field; a tap puts it at the cursor. */
export function FieldChips({ editor, onInserted }: Pick<PanelProps, "editor" | "onInserted">) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VARIABLES.map((name) => (
        <button
          key={name}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            editor.chain().focus().insertField(name).run();
            onInserted?.();
          }}
          className="inline-flex min-h-11 items-center rounded-full border border-action/30 bg-action-tint px-3 text-[12px] font-medium text-action hover:border-action lg:min-h-8"
        >
          {VARIABLE_LABELS[name]}
        </button>
      ))}
    </div>
  );
}
