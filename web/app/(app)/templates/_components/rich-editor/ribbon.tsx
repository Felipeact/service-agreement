"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Popover } from "radix-ui";
import type { Editor } from "@tiptap/react";
import { Braces, CalendarDays, ClipboardList, DollarSign, ImagePlus, Minus, ScissorsLineDashed, ScrollText, Signature, Stamp, Wrench, type LucideIcon } from "lucide-react";
import { useItemWords } from "@/components/shell/item-words";
import type { SectionKey } from "@/domain/agreement/layout";
import { partsOf, type EditorDocument } from "@/domain/templates/editor-model";
import { FieldChips, SelectedOptions, usePageParts } from "./insert-panel";
import { sectionName } from "./section-sample";
import { AlignTools, Divider, HistoryTools, MarkTools, ParagraphTools, TableMenu, TablePicker, TypeTools, usePicturePicker, useToolbarState } from "./toolbar";

/** Which part of the page the cursor is in: the ribbon acts on that one. */
export type EditingPart = "header" | "body";

const SECTION_ICONS: Record<SectionKey, LucideIcon> = { price: DollarSign, schedule: CalendarDays, included: ClipboardList, equipment: Wrench, terms: ScrollText, signatures: Signature };

/** A ribbon group: its tools on one line and its name under them, as Word labels its groups. */
export function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={name} className="flex shrink-0 flex-col items-stretch gap-1 border-r border-hairline px-2 last:border-r-0">
      <div className="flex min-h-11 items-center gap-0.5">{children}</div>
      <span className="text-center text-[11px] text-ink-2">{name}</span>
    </div>
  );
}

/** A large labelled tool, for the Insert tab: an icon over its name, and a note under it when there is one. */
export function Tile({ icon: Icon, label, onClick, disabled, note }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean; note?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-control px-2 py-1.5 text-[12px] font-medium text-ink hover:bg-surface disabled:opacity-45"
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="leading-tight">{label}</span>
      {note && <span className="text-[10px] leading-none text-ink-2">{note}</span>}
    </button>
  );
}

/** Home: undo, the text's style, its look, and the paragraph; the table tools while the cursor is in a table. */
export function HomeTab({ editor }: { editor: Editor }) {
  const state = useToolbarState(editor);
  return (
    <>
      <Group name="Undo">
        <HistoryTools editor={editor} state={state} />
      </Group>
      <Group name="Text">
        <TypeTools editor={editor} state={state} />
      </Group>
      <Group name="Look">
        <MarkTools editor={editor} state={state} />
      </Group>
      <Group name="Paragraph">
        <AlignTools editor={editor} state={state} />
        <Divider />
        <ParagraphTools editor={editor} state={state} />
      </Group>
      {state.table && (
        <Group name="Table">
          <TableMenu editor={editor} />
        </Group>
      )}
    </>
  );
}

/**
 * Insert, for the part the cursor is in: the page takes everything; a header takes pictures, the logo, a table, a line and fields, and
 * no live sections or page breaks.
 */
export function InsertTab({ editor, document, part, onPicture, uploading }: { editor: Editor; document: EditorDocument; part: EditingPart; onPicture: (file: File) => Promise<void>; uploading: boolean }) {
  const words = useItemWords();
  const state = useToolbarState(editor);
  const { onPage } = usePageParts(editor);
  const picker = usePicturePicker(onPicture);
  const chain = () => editor.chain().focus();
  return (
    <>
      <Group name={part === "header" ? "In the header" : "Page parts"}>
        <TablePicker disabled={state.table || state.bullet || state.ordered} onInsert={(rows, cols) => chain().insertTable({ rows, cols, withHeaderRow: part === "body" }).run()} />
        <Tile icon={ImagePlus} label={uploading ? "Uploading…" : "Picture"} disabled={uploading} onClick={picker.open} />
        {picker.input}
        <Tile icon={Stamp} label="Logo" onClick={() => chain().insertCompanyLogo().run()} />
        <Tile icon={Minus} label="Line" onClick={() => chain().setHorizontalRule().run()} />
        {part === "body" && <Tile icon={ScissorsLineDashed} label="Page break" onClick={() => chain().insertPageBreak().run()} />}
      </Group>
      {part === "body" && (
        <Group name="Live sections, filled from each agreement">
          {partsOf(document).map((key) => (
            <Tile
              key={key}
              icon={SECTION_ICONS[key]}
              label={sectionName(key, words).replace(" table", "")}
              disabled={onPage.has(key)}
              note={onPage.has(key) ? "On the page" : undefined}
              onClick={() => chain().insertSection(key).run()}
            />
          ))}
        </Group>
      )}
      <Group name="Fields">
        <Popover.Root>
          <Popover.Trigger className="flex min-h-14 min-w-[4.75rem] flex-col items-center justify-center gap-1 rounded-control px-2 text-[12px] font-medium hover:bg-surface data-[state=open]:bg-surface">
            <Braces className="size-5" aria-hidden="true" />
            Field
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={6} align="end" className="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-panel border border-hairline bg-surface p-3 shadow-card" onOpenAutoFocus={(event) => event.preventDefault()}>
              <p className="mb-2 text-[13px] font-semibold">Put a field at the cursor</p>
              <FieldChips editor={editor} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Group>
      {state.table && (
        <Group name="Table">
          <TableMenu editor={editor} />
        </Group>
      )}
    </>
  );
}

/** The selected part's options (a live section, a picture, the logo), sliding in beside the page and away when nothing is selected. */
export function Inspector({ editor, document, partExtras }: { editor: Editor; document: EditorDocument; partExtras?: (key: SectionKey) => ReactNode }) {
  const { selected } = usePageParts(editor);
  const still = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {selected && (
        <motion.aside
          key="inspector"
          aria-label="Selected part"
          initial={still ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={still ? { opacity: 0 } : { opacity: 0, x: 24 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:w-80 lg:self-start lg:overflow-y-auto"
        >
          <SelectedOptions editor={editor} document={document} partExtras={partExtras} />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
