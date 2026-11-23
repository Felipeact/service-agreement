"use client";

import { useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { Popover } from "radix-ui";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  EyeOff,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Rows3,
  ScissorsLineDashed,
  Stamp,
  Strikethrough,
  Table2,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { FONT_SIZES, toHex } from "@/domain/rich-document";
import { THEME_ACCENTS } from "@/domain/agreement/layout";

/** Every tool is a 44px touch target below desktop and a compact 32px one on it. */
export const TOOL =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-control px-2 text-[12px] font-semibold text-ink hover:bg-board focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action disabled:pointer-events-none disabled:opacity-35 aria-pressed:bg-action-tint aria-pressed:text-action data-[state=open]:bg-board lg:min-h-8 lg:min-w-8";
const SELECT =
  "min-h-11 shrink-0 rounded-control border border-hairline bg-surface px-2 text-[12px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-action lg:min-h-8";
const PANEL = "z-50 rounded-panel border border-hairline bg-surface p-3 shadow-card";

/** The colours offered for text, highlight and cells: the theme colours, ink and greys, then soft fills. */
export const TEXT_COLOURS = ["#111827", "#4b5563", "#9ca3af", ...Object.values(THEME_ACCENTS), "#15803d", "#b91c1c"];
export const FILL_COLOURS = ["#fef08a", "#fde68a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#f1f5f9", "#e2e8f0", "#dbeafe", "#ccfbf1"];

export function Tool({ label, onClick, pressed, disabled, children }: { label: string; onClick: () => void; pressed?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={TOOL} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

export const Divider = () => <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-hairline" />;

/** A grid of colours and a hex field; "None" clears. Buttons only, so it works by touch. */
export function ColourPicker({ label, icon, colours, current, onPick }: { label: string; icon: ReactNode; colours: string[]; current: string | null; onPick: (hex: string | null) => void }) {
  const [typed, setTyped] = useState("");
  const typedHex = toHex(typed.startsWith("#") ? typed : `#${typed}`);
  return (
    <Popover.Root>
      <Popover.Trigger className={TOOL} aria-label={label} title={label}>
        {icon}
        <span aria-hidden="true" className="h-1 w-4 rounded-full border border-hairline" style={{ backgroundColor: current ?? "transparent" }} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`${PANEL} w-60`} sideOffset={6} align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
          <p className="mb-2 text-[13px] font-semibold">{label}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {colours.map((colour) => (
              <Popover.Close key={colour} asChild>
                <button
                  type="button"
                  aria-label={colour}
                  aria-pressed={current === colour}
                  onClick={() => onPick(colour)}
                  className="size-11 rounded-control border border-hairline ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink lg:size-9"
                  style={{ backgroundColor: colour }}
                />
              </Popover.Close>
            ))}
          </div>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (typedHex) onPick(typedHex);
            }}
          >
            <label className="flex flex-1 flex-col gap-1 text-[12px] font-medium">
              Hex colour
              <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="#1d4ed8" className="min-h-11 rounded-control border border-hairline px-2 text-[13px] lg:min-h-9" />
            </label>
            <button type="submit" disabled={!typedHex} className={`${TOOL} border border-hairline`}>
              Use
            </button>
          </form>
          <Popover.Close asChild>
            <button type="button" onClick={() => onPick(null)} className={`${TOOL} mt-2 w-full border border-hairline`}>
              No colour
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Pick a table's size on a grid, or type it. */
export function TablePicker({ onInsert, disabled }: { onInsert: (rows: number, columns: number) => void; disabled: boolean }) {
  const [hover, setHover] = useState<[number, number]>([2, 3]);
  return (
    <Popover.Root>
      <Popover.Trigger className={TOOL} aria-label="Insert table" title="Insert table" disabled={disabled}>
        <Table2 className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={PANEL} sideOffset={6} align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
          <p className="mb-2 text-[13px] font-semibold">
            Insert table: {hover[0]} × {hover[1]}
          </p>
          <div className="grid grid-cols-6 gap-1" role="grid" aria-label="Table size">
            {Array.from({ length: 6 }, (_, row) =>
              Array.from({ length: 6 }, (_, column) => (
                <Popover.Close key={`${row}-${column}`} asChild>
                  <button
                    type="button"
                    aria-label={`${row + 1} rows by ${column + 1} columns`}
                    onMouseEnter={() => setHover([row + 1, column + 1])}
                    onFocus={() => setHover([row + 1, column + 1])}
                    onClick={() => onInsert(row + 1, column + 1)}
                    className={`size-7 rounded-[3px] border ${row < hover[0] && column < hover[1] ? "border-action bg-action-tint" : "border-hairline bg-surface"}`}
                  />
                </Popover.Close>
              )),
            )}
          </div>
          <p className="mt-2 text-[12px] text-ink-2">The first row is a header. Add more rows and columns from the table menu.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TableMenu({ editor }: { editor: Editor }) {
  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => action(editor.chain().focus()).run();
  const item = "flex min-h-11 w-full items-center rounded-control px-2 text-left text-[13px] hover:bg-board disabled:opacity-40 lg:min-h-8";
  const entries: [string, () => void, boolean?][] = [
    ["Add row above", () => run((chain) => chain.addRowBefore())],
    ["Add row below", () => run((chain) => chain.addRowAfter())],
    ["Add column left", () => run((chain) => chain.addColumnBefore()), !editor.can().addColumnBefore()],
    ["Add column right", () => run((chain) => chain.addColumnAfter()), !editor.can().addColumnAfter()],
    ["Delete row", () => run((chain) => chain.deleteRow())],
    ["Delete column", () => run((chain) => chain.deleteColumn())],
    ["Header row on or off", () => run((chain) => chain.toggleHeaderRow())],
    ["Split merged cell", () => run((chain) => chain.splitCell()), !editor.can().splitCell()],
  ];
  return (
    <Popover.Root>
      <Popover.Trigger className={`${TOOL} border border-action/40 text-action`} aria-label="Table menu" title="Table menu">
        <Rows3 className="size-4" />
        <span className="hidden sm:inline">Table</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`${PANEL} w-60`} sideOffset={6} align="start" onOpenAutoFocus={(event) => event.preventDefault()}>
          <div className="flex flex-col">
            {entries.map(([label, action, disabled]) => (
              <Popover.Close key={label} asChild>
                <button type="button" className={item} onClick={action} disabled={disabled}>
                  {label}
                </button>
              </Popover.Close>
            ))}
          </div>
          <p className="mt-2 mb-1 text-[12px] font-semibold">Cell colour</p>
          <div className="grid grid-cols-6 gap-1.5">
            {[null, ...FILL_COLOURS].map((colour) => (
              <Popover.Close key={colour ?? "none"} asChild>
                <button
                  type="button"
                  aria-label={colour ?? "No colour"}
                  onClick={() => run((chain) => chain.setCellAttribute("background", colour))}
                  className="flex size-9 items-center justify-center rounded-control border border-hairline text-[10px] text-ink-2"
                  style={colour ? { backgroundColor: colour } : undefined}
                >
                  {colour ? "" : "None"}
                </button>
              </Popover.Close>
            ))}
          </div>
          <Popover.Close asChild>
            <button type="button" className={`${item} mt-2 text-danger`} onClick={() => run((chain) => chain.deleteTable())}>
              Delete table
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function LinkTool({ editor, active }: { editor: Editor; active: boolean }) {
  const [href, setHref] = useState("");
  const valid = /^https:\/\/[^\s]+\.[^\s]+/.test(href.trim());
  return (
    <Popover.Root onOpenChange={(open) => open && setHref((editor.getAttributes("link").href as string | undefined) ?? "https://")}>
      <Popover.Trigger className={TOOL} aria-label="Link" title="Link" aria-pressed={active}>
        <Link2 className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={`${PANEL} w-72`} sideOffset={6} align="start">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
            }}
          >
            <label className="flex flex-col gap-1 text-[12px] font-medium">
              Web address (https only)
              <input value={href} onChange={(event) => setHref(event.target.value)} className="min-h-11 rounded-control border border-hairline px-2 text-[13px] lg:min-h-9" />
            </label>
            <div className="flex gap-2">
              <Popover.Close asChild>
                <button type="submit" disabled={!valid} className={`${TOOL} flex-1 border border-hairline`}>
                  Set link
                </button>
              </Popover.Close>
              <Popover.Close asChild>
                <button type="button" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} className={`${TOOL} flex-1 border border-hairline`}>
                  Remove
                </button>
              </Popover.Close>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** What the tools show as on or off for the cursor's place. */
export function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      link: current.isActive("link"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      table: current.isActive("table"),
      paragraph: current.isActive("paragraph"),
      omit: current.isActive("paragraph", { omitIfMissing: true }),
      level: ([1, 2, 3] as const).find((level) => current.isActive("heading", { level })) ?? 0,
      align: (["center", "right", "justify"] as const).find((align) => current.isActive({ textAlign: align })) ?? "left",
      color: (current.getAttributes("textStyle").color as string | undefined) ?? null,
      size: (current.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      family: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      highlight: (current.getAttributes("highlight").color as string | undefined) ?? null,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
}

export type ToolbarState = ReturnType<typeof useToolbarState>;
type ToolProps = { editor: Editor; state: ToolbarState };

export function HistoryTools({ editor, state }: ToolProps) {
  const chain = () => editor.chain().focus();
  return (
    <>
      <Tool label="Undo" onClick={() => chain().undo().run()} disabled={!state.canUndo}>
        <Undo2 className="size-4" />
      </Tool>
      <Tool label="Redo" onClick={() => chain().redo().run()} disabled={!state.canRedo}>
        <Redo2 className="size-4" />
      </Tool>
    </>
  );
}

/** Paragraph style, font and size. `idPrefix` keeps the ids apart when two toolbars are on screen. */
export function TypeTools({ editor, state, idPrefix = "rich" }: ToolProps & { idPrefix?: string }) {
  const chain = () => editor.chain().focus();
  return (
    <>
      <label className="sr-only" htmlFor={`${idPrefix}-style`}>
        Paragraph style
      </label>
      <select
        id={`${idPrefix}-style`}
        className={`${SELECT} w-[8.5rem]`}
        value={String(state.level)}
        onChange={(event) => {
          const level = Number(event.target.value);
          if (level === 0) chain().setParagraph().run();
          else chain().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
      >
        <option value="0">Normal text</option>
        <option value="1">Title</option>
        <option value="2">Heading</option>
        <option value="3">Subheading</option>
      </select>
      <label className="sr-only" htmlFor={`${idPrefix}-font`}>
        Font
      </label>
      <select
        id={`${idPrefix}-font`}
        className={`${SELECT} w-[7.5rem]`}
        value={state.family}
        onChange={(event) => (event.target.value ? chain().setMark("textStyle", { fontFamily: event.target.value }).run() : chain().setMark("textStyle", { fontFamily: null }).removeEmptyTextStyle().run())}
      >
        <option value="">Page font</option>
        <option value="sans-serif">Sans serif</option>
        <option value="serif">Serif</option>
        <option value="monospace">Monospace</option>
      </select>
      <label className="sr-only" htmlFor={`${idPrefix}-size`}>
        Text size
      </label>
      <select
        id={`${idPrefix}-size`}
        className={`${SELECT} w-[4.75rem]`}
        value={state.size}
        onChange={(event) => (event.target.value ? chain().setMark("textStyle", { fontSize: event.target.value }).run() : chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run())}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={`${size}px`}>
            {size}
          </option>
        ))}
      </select>
    </>
  );
}

/** Bold, italic, underline, strikethrough, text colour and highlight. */
export function MarkTools({ editor, state }: ToolProps) {
  const chain = () => editor.chain().focus();
  return (
    <>
      <Tool label="Bold" pressed={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </Tool>
      <Tool label="Italic" pressed={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </Tool>
      <Tool label="Underline" pressed={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline className="size-4" />
      </Tool>
      <Tool label="Strikethrough" pressed={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Tool>
      <ColourPicker label="Text colour" icon={<Type className="size-4" />} colours={TEXT_COLOURS} current={state.color} onPick={(hex) => (hex ? chain().setColor(hex).run() : chain().unsetColor().run())} />
      <ColourPicker label="Highlight" icon={<Highlighter className="size-4" />} colours={FILL_COLOURS} current={state.highlight} onPick={(hex) => (hex ? chain().setHighlight({ color: hex }).run() : chain().unsetHighlight().run())} />
    </>
  );
}

/** Alignment. */
export function AlignTools({ editor, state }: ToolProps) {
  const chain = () => editor.chain().focus();
  return (
    <>
      <Tool label="Align left" pressed={state.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
        <AlignLeft className="size-4" />
      </Tool>
      <Tool label="Align center" pressed={state.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
        <AlignCenter className="size-4" />
      </Tool>
      <Tool label="Align right" pressed={state.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
        <AlignRight className="size-4" />
      </Tool>
      <Tool label="Justify" pressed={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
        <AlignJustify className="size-4" />
      </Tool>
    </>
  );
}

/** Lists, indent, "hide when a field is empty" and the link. */
export function ParagraphTools({ editor, state }: ToolProps) {
  const chain = () => editor.chain().focus();
  return (
    <>
      <Tool label="Bullet list" pressed={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List className="size-4" />
      </Tool>
      <Tool label="Numbered list" pressed={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Tool>
      <Tool label="Decrease indent" onClick={() => (state.bullet || state.ordered ? chain().liftListItem("listItem").run() : chain().indentBy(-1).run())}>
        <IndentDecrease className="size-4" />
      </Tool>
      <Tool label="Increase indent" onClick={() => (state.bullet || state.ordered ? chain().sinkListItem("listItem").run() : chain().indentBy(1).run())}>
        <IndentIncrease className="size-4" />
      </Tool>
      <Tool label="Hide this paragraph when a field in it is empty" pressed={state.omit} disabled={!state.paragraph} onClick={() => chain().updateAttributes("paragraph", { omitIfMissing: !state.omit }).run()}>
        <EyeOff className="size-4" />
      </Tool>
      <LinkTool editor={editor} active={state.link} />
    </>
  );
}

/** A hidden picture input and the function that opens it. */
export function usePicturePicker(onPicture: (file: File) => Promise<void>) {
  const file = useRef<HTMLInputElement | null>(null);
  const input = (
    <input
      ref={file}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        const picked = event.target.files?.[0];
        event.target.value = "";
        if (picked) void onPicture(picked);
      }}
    />
  );
  return { input, open: () => file.current?.click() };
}

/** Table, picture, logo, line and page break. */
export function InsertTools({ editor, state, onPicture, uploading }: ToolProps & { onPicture: (file: File) => Promise<void>; uploading: boolean }) {
  const chain = () => editor.chain().focus();
  const picker = usePicturePicker(onPicture);
  return (
    <>
      <TablePicker disabled={state.table || state.bullet || state.ordered} onInsert={(rows, cols) => chain().insertTable({ rows, cols, withHeaderRow: true }).run()} />
      {state.table && <TableMenu editor={editor} />}
      <Tool label={uploading ? "Uploading the picture" : "Picture"} disabled={uploading} onClick={picker.open}>
        <ImagePlus className="size-4" />
      </Tool>
      {picker.input}
      <Tool label="Company logo" onClick={() => chain().insertCompanyLogo().run()}>
        <Stamp className="size-4" />
      </Tool>
      <Tool label="Line" onClick={() => chain().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </Tool>
      <Tool label="Page break" onClick={() => chain().insertPageBreak().run()}>
        <ScissorsLineDashed className="size-4" />
      </Tool>
    </>
  );
}
