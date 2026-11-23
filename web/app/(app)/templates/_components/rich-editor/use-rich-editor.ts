"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import type { RichDoc } from "@/domain/rich-document";
import type { EditorDocument } from "@/domain/templates/editor-model";
import { richExtensions } from "./extensions";
import { KeepSection } from "./keep-section";

/** How long typing pauses before the page is handed back (a save or a preview reads the page at once). */
export const SYNC_MS = 200;

/**
 * The Word-style editor's engine, the same whatever screen is built around it: the schema that mirrors the save rules, the guard that
 * keeps a contract's signatures, and the page handed back to `onContent` once typing pauses.
 */
export function useRichEditor({ kind, content, onContent, placeholder = "Start writing, or insert a field or a live section…", label = "Page" }: { kind: EditorDocument; content: RichDoc; onContent: (content: RichDoc) => void; placeholder?: string; label?: string }): Editor | null {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handBack = useRef(onContent);
  useEffect(() => {
    handBack.current = onContent;
  }, [onContent]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const extensions = useMemo(() => [...richExtensions(placeholder), KeepSection.configure({ keys: kind === "contract" ? ["signatures"] : [] })], [kind, placeholder]);
  return useEditor({
    extensions,
    content,
    immediatelyRender: false,
    editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox", spellcheck: "true" } },
    onUpdate: ({ editor }) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => handBack.current(editor.getJSON() as RichDoc), SYNC_MS);
    },
  });
}
