"use client";

import { createContext, useContext } from "react";
import type { TemplateFormLine } from "@/domain/agreement/template-form";
import type { EditorDocument } from "@/domain/templates/editor-model";

/** What the page's drawings need beyond the node itself; node views are rendered inside the editor, so they read it from here. */
export type RichEditorEnv = {
  document: EditorDocument;
  /** The public address of an uploaded picture. */
  imageUrl: (key: string) => string;
  /** The company's logo as Settings holds it, `null` when it has none. */
  logoUrl: string | null;
  /** The template's preset lines, which the price table shows while designing. */
  presetLines: readonly TemplateFormLine[];
  /** The colour headings and section titles print in. */
  accent: string;
  /** When set, fields show these values (an agreement's data) instead of their names. */
  fieldValues?: Partial<Record<string, string | null>>;
};

const Context = createContext<RichEditorEnv | null>(null);

export const RichEditorEnvProvider = Context.Provider;

export function useRichEditorEnv(): RichEditorEnv {
  const env = useContext(Context);
  if (!env) throw new Error("useRichEditorEnv needs a RichEditorEnvProvider");
  return env;
}
