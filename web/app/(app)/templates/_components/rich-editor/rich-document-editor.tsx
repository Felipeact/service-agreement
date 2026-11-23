"use client";

import "./rich-page.css";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { EditorContent, type Editor } from "@tiptap/react";
import { PanelTop, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { THEME_ACCENTS, type DocOptions, type SectionKey } from "@/domain/agreement/layout";
import { STANDARD_HEADER } from "@/domain/agreement/rich-form";
import type { TemplateFormLine } from "@/domain/agreement/template-form";
import type { RichDoc } from "@/domain/rich-document";
import type { EditorDocument } from "@/domain/templates/editor-model";
import { HeaderPopover } from "../block-options";
import { RichEditorEnvProvider, type RichEditorEnv } from "./context";
import type { EditorPageEnv } from "./env";
import { uploadPicture, prepareInBrowser, putPicture } from "./image-upload";
import { SelectedOptions, usePageParts } from "./insert-panel";
import { PageTab } from "./page-tab";
import { PreviewPane } from "./preview-pane";
import { HomeTab, Inspector, InsertTab, type EditingPart } from "./ribbon";
import { useRichEditor } from "./use-rich-editor";
import { prepareTemplateImageAction } from "../../_actions/image";

/** What the editor edits: the document options, the page and its header (`null` for none). */
export type RichValues = { doc: DocOptions; content: RichDoc; header: RichDoc | null };

type Props<V extends RichValues> = {
  document: EditorDocument;
  env: EditorPageEnv;
  values: V;
  onChange: (next: V) => void;
  /** Messages by the validator's field name, live and from the last save. */
  errors: Record<string, string>;
  /** Notes that do not stop a save. */
  warnings: string[];
  /** The left of the top bar: the template's name field, or the contract's title. */
  heading: ReactNode;
  /** The agreement's description and term, under a Details button. */
  details?: ReactNode;
  /** More top bar controls, such as the contract's Import. */
  extra?: ReactNode;
  /** What the price section shows under its options: the agreement's preset lines. */
  partExtras?: (key: SectionKey) => ReactNode;
  presetLines?: readonly TemplateFormLine[];
  dirty: boolean;
  saveLabel: string;
  pending: boolean;
  /** Saves the values as the page holds them now. */
  onSubmit: (values: V) => void;
  notices?: ReactNode;
  cancelHref: string;
  preview: { endpoint: string; fileName: string; frameTitle: string; note: string };
  /** Puts new content on the page (an imported contract) when the token changes; it can be undone. */
  replaceContent?: { content: RichDoc; token: number } | null;
};

const TABS = ["Home", "Insert", "Page"] as const;
type Tab = (typeof TABS)[number];

/** Which editor the cursor was last in: the ribbon acts on that one. */
function useEditingPart(header: Editor | null, body: Editor | null): [EditingPart, (part: EditingPart) => void] {
  const [part, setPart] = useState<EditingPart>("body");
  useEffect(() => {
    const onHeader = () => setPart("header");
    const onBody = () => setPart("body");
    header?.on("focus", onHeader);
    body?.on("focus", onBody);
    return () => {
      header?.off("focus", onHeader);
      body?.off("focus", onBody);
    };
  }, [header, body]);
  return [part, setPart];
}

/**
 * The template editor (rich-templates, the owner's final design): Word's ribbon (Home, Insert, Page) over a Letter page with a header the
 * tenant edits on the page, as in Word. The header is optional; the ribbon acts on whichever part the cursor is in; a selected section,
 * picture or logo shows its options beside the page. Preview shows the real PDF of what is on screen. It holds the screen; the values,
 * the rules and the save belong to the wrapper that renders it.
 */
export function RichDocumentEditor<V extends RichValues>(props: Props<V>) {
  const { document: kind, env, values, onChange, errors, warnings, heading, details, extra, partExtras, presetLines = [], dirty, saveLabel, pending, onSubmit, notices, cancelHref, preview, replaceContent } = props;
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tab, setTab] = useState<Tab>("Home");
  const [previewValues, setPreviewValues] = useState<V | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [upload, setUpload] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  // The values as last rendered, for the editors' hand-back, save and preview, which run outside render.
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  }, [values]);

  const hasHeader = values.header !== null;
  const onBody = useCallback((content: RichDoc) => onChange({ ...latest.current, content }), [onChange]);
  const onHeader = useCallback((header: RichDoc) => {
    if (latest.current.header !== null) onChange({ ...latest.current, header });
  }, [onChange]);
  const body = useRichEditor({ kind, content: values.content, onContent: onBody });
  // A page with no header still keeps one ready: adding it back brings back what it last held.
  const head = useRichEditor({ kind: "agreement", content: values.header ?? STANDARD_HEADER, onContent: onHeader, placeholder: "Your header: logo, company name, contact details…", label: "Header" });
  const [part, setPart] = useEditingPart(head, body);
  const active = part === "header" && hasHeader ? head : body;
  const { selected } = usePageParts(active);

  // An import replaces the page in one step, so Undo brings the old page back.
  const seenReplace = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!body || !replaceContent || replaceContent.token === seenReplace.current) return;
    seenReplace.current = replaceContent.token;
    body.chain().setContent(replaceContent.content, { emitUpdate: true }).run();
  }, [body, replaceContent]);

  const accent = values.doc.theme?.accent ? THEME_ACCENTS[values.doc.theme.accent] : env.accent;
  const envValue: RichEditorEnv = useMemo(
    () => ({ document: kind, imageUrl: (key: string) => `${env.imageBase}${key}`, logoUrl: env.logoUrl, presetLines, accent }),
    [kind, env.imageBase, env.logoUrl, presetLines, accent],
  );

  /** The values with both parts as they are this moment, not as the last pause in typing left them. */
  const current = (): V => {
    const next = {
      ...latest.current,
      content: body ? (body.getJSON() as RichDoc) : latest.current.content,
      header: latest.current.header === null ? null : head ? (head.getJSON() as RichDoc) : latest.current.header,
    };
    if (JSON.stringify(next.content) !== JSON.stringify(latest.current.content) || JSON.stringify(next.header) !== JSON.stringify(latest.current.header)) onChange(next);
    return next;
  };

  const showHeader = (on: boolean) => {
    const next = { ...latest.current, header: on ? (head ? (head.getJSON() as RichDoc) : STANDARD_HEADER) : null };
    onChange(next);
    setPart(on ? "header" : "body");
    if (on) setTimeout(() => head?.commands.focus("end"), 0);
  };
  const resetHeader = () => {
    head?.chain().setContent(STANDARD_HEADER, { emitUpdate: true }).focus().run();
    onChange({ ...latest.current, header: STANDARD_HEADER });
    setPart("header");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(current());
  };

  const addPicture = async (file: File) => {
    const target = active;
    setUpload({ busy: true, error: null });
    const result = await uploadPicture(file, { prepare: prepareInBrowser, sign: prepareTemplateImageAction, put: putPicture });
    if (result.ok) target?.chain().focus().insertPicture(result.path).run();
    setUpload({ busy: false, error: result.ok ? null : result.error });
  };

  const setDoc = (doc: DocOptions) => onChange({ ...latest.current, doc });
  const messages = [...new Set(Object.values(errors))];
  const every = values.doc.pageHeader === "every";
  const counted = JSON.stringify(values.content) + JSON.stringify(values.header ?? "");
  const words = (body?.state.doc.textContent.match(/\S+/g) ?? []).length;

  return (
    <RichEditorEnvProvider value={envValue}>
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-4">
        <div className="z-20 overflow-hidden rounded-panel border border-hairline bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
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
            </div>
            <div className="flex items-center gap-2 md:border-l md:border-hairline md:pl-3">
              <div role="group" aria-label="Mode" className="inline-flex rounded-control border border-hairline p-0.5">
                {(["edit", "preview"] as const).map((each) => (
                  <button
                    key={each}
                    type="button"
                    aria-pressed={mode === each}
                    onClick={() => {
                      if (each === "preview") setPreviewValues(current());
                      setMode(each);
                    }}
                    className="inline-flex min-h-10 items-center rounded-[6px] px-3 text-[13px] font-semibold text-ink-2 aria-pressed:bg-ink aria-pressed:text-surface lg:min-h-8"
                  >
                    {each === "edit" ? "Edit" : "Preview"}
                  </button>
                ))}
              </div>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : saveLabel}
              </Button>
            </div>
          </div>

          {mode === "edit" && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2 border-t border-hairline px-3 pt-1">
                <div role="tablist" aria-label="Ribbon" className="flex gap-1">
                  {TABS.map((each) => (
                    <button
                      key={each}
                      type="button"
                      role="tab"
                      aria-selected={tab === each}
                      onClick={() => setTab(each)}
                      className="min-h-11 rounded-t-control px-4 text-[13px] font-semibold text-ink-2 aria-selected:bg-board aria-selected:text-ink lg:min-h-9"
                    >
                      {each}
                    </button>
                  ))}
                </div>
                <p role="status" className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${part === "header" && hasHeader ? "bg-action text-surface" : "bg-board text-ink-2"}`}>
                  <PanelTop className="size-3.5" aria-hidden="true" />
                  {part === "header" && hasHeader ? "Editing the header" : "Editing the page"}
                </p>
              </div>
              <div role="tabpanel" aria-label={tab} className="flex items-stretch overflow-x-auto bg-board px-2 py-2 [scrollbar-width:thin]">
                {active && tab === "Home" && <HomeTab editor={active} />}
                {active && tab === "Insert" && <InsertTab editor={active} document={kind} part={part === "header" && hasHeader ? "header" : "body"} onPicture={addPicture} uploading={upload.busy} />}
                {tab === "Page" && <PageTab doc={values.doc} onDoc={setDoc} hasHeader={hasHeader} onHeader={showHeader} onResetHeader={resetHeader} companyAccent={env.accent} />}
              </div>
              {upload.error && (
                <p role="alert" className="border-t border-hairline px-3 py-2 text-[13px] font-medium text-danger">
                  {upload.error}
                </p>
              )}
            </>
          )}
        </div>

        {notices}
        {(messages.length > 0 || warnings.length > 0) && (
          <section aria-label="Before you save" className="flex flex-col gap-1 rounded-panel border border-hairline bg-surface px-4 py-3 shadow-card">
            <h2 className="text-[14px] font-semibold">Before you save</h2>
            <ul className="flex flex-col gap-1 text-[13px]">
              {messages.map((message) => (
                <li key={message} role="alert" className="font-medium text-danger">
                  {message}
                </li>
              ))}
              {warnings.map((warning) => (
                <li key={warning} className="text-attention-fg">
                  {warning}
                </li>
              ))}
            </ul>
          </section>
        )}

        {mode === "preview" && previewValues && (
          <PreviewPane values={previewValues} endpoint={preview.endpoint} agreements={env.agreements} fileName={preview.fileName} frameTitle={preview.frameTitle} note={preview.note} />
        )}

        {/* The editors stay mounted while previewing, so the cursor and the undo history are where they were. */}
        <div className={mode === "edit" ? "flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start" : "hidden"}>
          <div className="min-w-0 flex-1 rounded-panel bg-board/60 px-2 py-4 sm:px-6 sm:py-8">
            <article
              data-editor-document={kind}
              className="rich-page mx-auto flex w-full max-w-[816px] flex-col gap-[10pt] rounded-[3px] bg-surface px-[calc(20*var(--pt))] py-[calc(28*var(--pt))] shadow-card lg:min-h-[1056px] lg:px-[calc(48*var(--pt))] lg:py-[calc(54*var(--pt))]"
              style={{ ["--rich-accent" as string]: accent }}
            >
              <section
                aria-label="Header"
                hidden={!hasHeader}
                onClick={() => head?.commands.focus()}
                className={`group relative -mx-[6pt] rounded-[3px] px-[6pt] py-[3pt] outline-1 -outline-offset-1 transition-colors ${part === "header" ? "bg-action-tint/20 outline-action/60" : "outline-transparent hover:outline-hairline"}`}
              >
                <span className={`absolute -top-2 right-1 flex items-center gap-1 text-[10px] font-semibold ${part === "header" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                  <span className="rounded-full bg-action px-1.5 py-0.5 text-surface">Header, {every ? "every page" : "first page"}</span>
                  <button
                    type="button"
                    aria-label="Remove the header"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      showHeader(false);
                    }}
                    className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-danger lg:size-5 lg:bg-surface lg:shadow-card"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
                {head && <EditorContent editor={head} />}
              </section>
              {!hasHeader && (
                <button
                  type="button"
                  onClick={() => showHeader(true)}
                  className="group -mx-[6pt] flex min-h-11 items-center gap-2 rounded-[3px] px-[6pt] text-[12px] font-medium text-ink-2 hover:text-action lg:min-h-8"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add a header
                  <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-hairline group-hover:border-action/50" />
                </button>
              )}
              <label htmlFor="document-title" className="sr-only">
                Document title
              </label>
              <input
                id="document-title"
                value={values.doc.title}
                placeholder="Document title (optional)"
                onChange={(event) => setDoc({ ...values.doc, title: event.target.value })}
                aria-invalid={errors["doc.title"] ? true : undefined}
                className={`-mx-1 min-h-11 rounded-[3px] border bg-transparent px-1 text-[calc(13*var(--pt))] font-bold text-ink placeholder:font-normal placeholder:text-ink-2/70 hover:border-hairline lg:min-h-9 ${errors["doc.title"] ? "border-danger" : "border-transparent"}`}
              />
              {values.doc.showMeta && (
                <p aria-label="Number, customer and site lines" className="-mt-[6pt] text-ink-2">
                  AG-0000 &nbsp; Version 1 &nbsp; Customer name &nbsp; Site name
                </p>
              )}
              {body ? <EditorContent editor={body} /> : <div aria-hidden="true" className="h-[420px] animate-pulse rounded-[3px] bg-ground motion-reduce:animate-none" />}
              <footer aria-label="Page footer" className="mt-auto border-t border-hairline pt-[6pt] text-[calc(8*var(--pt))] text-ink-2">
                {values.doc.pageFooter === "letterhead" ? [env.orgName, env.address, env.phone].filter(Boolean).join("   ") : "AG-0000   Page 1 of 1"}
              </footer>
            </article>
          </div>
          {active && (
            <div className="hidden lg:contents">
              <Inspector editor={active} document={kind} partExtras={partExtras} />
            </div>
          )}
        </div>

        {mode === "edit" && (
          <footer className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-panel border border-hairline bg-surface px-4 py-2 text-[12px] text-ink-2 shadow-card">
            <span>{words} words</span>
            <span>{(counted.match(/"type":"variable"/g) ?? []).length} fields</span>
            <span>{(JSON.stringify(values.content).match(/"type":"section"/g) ?? []).length} live sections</span>
            {/* Below the widest layout a selected part's options open in a sheet. */}
            {selected && (
              <button type="button" onClick={() => setOptionsOpen(true)} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-4 text-[13px] font-semibold text-surface lg:hidden">
                <SlidersHorizontal className="size-4" aria-hidden="true" /> Options
              </button>
            )}
          </footer>
        )}

        <Sheet open={optionsOpen && selected !== null} onOpenChange={setOptionsOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-panel px-4 pb-6 lg:hidden">
            <SheetHeader className="px-0">
              <SheetTitle>Options</SheetTitle>
              <SheetDescription>For the part selected on the page.</SheetDescription>
            </SheetHeader>
            {active && <SelectedOptions editor={active} document={kind} partExtras={partExtras} />}
          </SheetContent>
        </Sheet>
      </form>
    </RichEditorEnvProvider>
  );
}
