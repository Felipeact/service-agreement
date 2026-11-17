"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { SectionKey } from "@/domain/agreement/layout";
import { newBlockRow, newSectionRow, type BlockRow, type LayoutFormState, type LayoutRow, type SectionRow } from "@/domain/agreement/layout-form";
import type { TemplateVariable } from "@/domain/contract/template";
import { insertRow, insertRowAt, insertVariable, moveRow, moveRowTo, partsOf, removeRow, restoreRow, type DragPayload, type EditorDocument, type RemovedRow } from "@/domain/templates/editor-model";
import { AddElementDock, type AddChoice } from "./add-element-dock";
import { HeaderFields, HeaderPopover, OptionsCard, PageSettingsFields, PartOptions } from "./block-options";
import { EditorPage } from "./editor-page";
import { PreviewDialog } from "./preview-dialog";

type Props<V extends LayoutFormState> = {
  document: EditorDocument;
  orgName: string;
  values: V;
  onChange: (next: V) => void;
  /** Messages by the validator's field name: live ones and the last save's. */
  errors: Record<string, string>;
  /** The left of the header: the template's name field, or the contract's fixed title. */
  heading?: ReactNode;
  /** The agreement's description and term fields, shown under a Details button; absent for the contract. */
  details?: ReactNode;
  /** More header controls, such as the contract's Import. */
  extra?: ReactNode;
  /** What the Price lines part shows under its options: the agreement's preset lines. */
  partExtras?: (key: SectionKey) => ReactNode;
  presetLines?: Parameters<typeof EditorPage>[0]["presetLines"];
  /** Whether the form differs from what was last saved. */
  dirty: boolean;
  preview: { endpoint: string; canDraw: (values: V) => boolean; frameTitle: string };
  saveLabel: string;
  pending: boolean;
  onSubmit: () => void;
  /** Messages under the header: a refused save, a saved wording, an import notice. */
  notices?: ReactNode;
  /** The route to go back to without saving. */
  cancelHref: string;
  /** Selects a row when the token changes: the first block a refused save names. */
  jumpTo?: { row: number; token: number } | null;
};

/**
 * The one editor for an agreement template and for the contract wording (template-editor-v2 S5): the Add Element panel, the page and the
 * header. It holds only what the screen needs (what is selected, what was just deleted); the form values, the validation and the save
 * belong to the wrapper that renders it.
 */
export function DocumentEditor<V extends LayoutFormState>({ document: kind, orgName, values, onChange, errors, heading, details, extra, partExtras, presetLines, dirty, preview, saveLabel, pending, onSubmit, notices, cancelHref, jumpTo }: Props<V>) {
  const [selectedAt, setSelected] = useState<number | null>(null);
  const [seenJump, setSeenJump] = useState<number | undefined>(undefined);
  if (jumpTo && jumpTo.token !== seenJump) {
    setSeenJump(jumpTo.token);
    setSelected(jumpTo.row);
  }
  const [removed, setRemoved] = useState<RemovedRow | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const rows = values.layout;
  const selected = selectedAt !== null && selectedAt < rows.length ? selectedAt : null;
  const selectedRow = selected === null ? null : rows[selected];

  const setRows = (layout: LayoutRow[]) => onChange({ ...values, layout });
  const patch = (index: number, change: Partial<BlockRow> | Partial<SectionRow>) => {
    setRemoved(null);
    setRows(rows.map((row, at) => (at === index ? ({ ...row, ...change } as LayoutRow) : row)));
  };

  const add = (choice: AddChoice) => {
    const row = choice.kind === "block" ? newBlockRow(choice.type) : newSectionRow(choice.key);
    const out = insertRow(rows, selected, row);
    setRemoved(null);
    setRows(out.rows);
    setSelected(out.index);
  };

  // A drag landed on the line before the row at `at`: a new block there, or the dragged block moved there.
  const dropAt = (at: number, payload: DragPayload) => {
    setRemoved(null);
    if (payload.kind === "move") {
      const out = moveRowTo(rows, payload.from, at);
      if (out.rows === rows) return;
      setRows(out.rows);
      setSelected(out.index);
      return;
    }
    const { choice } = payload;
    // A part the page already has cannot be added twice, and a part this document does not have (terms in a contract, signatures in an
    // agreement) cannot be dropped in from another window.
    if (choice.kind === "part" && (!partsOf(kind).includes(choice.key) || rows.some((row) => row.kind === "section" && row.key === choice.key))) return;
    const out = insertRowAt(rows, at, choice.kind === "block" ? newBlockRow(choice.type) : newSectionRow(choice.key));
    setRows(out.rows);
    setSelected(out.index);
  };

  const insertField = (name: TemplateVariable) => {
    if (selected === null || selectedRow?.kind !== "block") return;
    const field = textRef.current;
    const caret = field ? { start: field.selectionStart ?? selectedRow.text.length, end: field.selectionEnd ?? selectedRow.text.length } : null;
    patch(selected, { text: insertVariable(selectedRow.text, caret, name) });
  };

  // Any change other than the delete itself ends the chance to undo it.
  const edit = (next: V) => {
    setRemoved(null);
    onChange(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
      <div className="z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-hairline bg-surface px-3 py-2.5 shadow-card lg:sticky lg:top-2">
        <Link href={cancelHref} className="inline-flex min-h-11 items-center gap-1 rounded-control px-1.5 text-[13px] font-medium text-ink-2 hover:text-ink lg:min-h-8">
          <span aria-hidden="true">←</span> Templates
        </Link>
        <div className="min-w-0 flex-1 basis-48">{heading}</div>
        <span
          data-save-state={dirty ? "unsaved" : "saved"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${dirty ? "bg-attention-bg text-attention-fg" : "bg-board text-ink-2"}`}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {dirty ? "Unsaved changes" : "Saved"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          {details && <HeaderPopover label="Details">{details}</HeaderPopover>}
          <HeaderPopover label="Page settings">
            <PageSettingsFields doc={values.doc} onChange={(doc) => edit({ ...values, doc })} errors={errors} />
          </HeaderPopover>
        </div>
        <div className="flex items-center gap-2 md:border-l md:border-hairline md:pl-3">
          <PreviewDialog values={values} endpoint={preview.endpoint} canDraw={preview.canDraw} frameTitle={preview.frameTitle} />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>

      {notices}
      {removed && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-control bg-ground px-3 py-2 text-[13px] font-medium text-ink">
          Block removed.
          <Button
            onClick={() => {
              const back = restoreRow(rows, removed);
              setRows(back.rows);
              setSelected(back.index);
              setRemoved(null);
            }}
          >
            Undo
          </Button>
        </p>
      )}
      {errors.layout && <p role="alert" className="text-[13px] font-medium text-danger">{errors.layout}</p>}
      {errors.body && <p role="alert" className="text-[13px] font-medium text-danger">{errors.body}</p>}

      <div className="flex min-w-0 flex-col gap-4">
        <EditorPage
          document={kind}
          orgName={orgName}
          doc={values.doc}
          rows={rows}
          presetLines={presetLines}
          selected={selected}
          errors={errors}
          onSelect={setSelected}
          onTitle={(title) => edit({ ...values, doc: { ...values.doc, title } })}
          onPatch={patch}
          onMove={(index, by) => {
            setRemoved(null);
            setRows(moveRow(rows, index, by));
            setSelected(index + by);
          }}
          onDelete={(index) => {
            const out = removeRow(rows, index);
            setRows(out.rows);
            setRemoved(out.removed);
            setSelected(null);
          }}
          textRef={textRef}
          onDropAt={dropAt}
          options={(index, row) => (
            <OptionsCard label="Options">
              <PartOptions row={row} id={`layout-${index}`} at={(suffix) => errors[`layout.${index}.${suffix}`]} onChange={(change) => patch(index, change)} />
              {partExtras?.(row.key)}
            </OptionsCard>
          )}
        />
        <AddElementDock document={kind} rows={rows} onAdd={add} onVariable={insertField} canInsertVariable={selectedRow?.kind === "block"} header={<HeaderFields doc={values.doc} onChange={(doc) => edit({ ...values, doc })} errors={errors} />} />
      </div>
    </form>
  );
}
