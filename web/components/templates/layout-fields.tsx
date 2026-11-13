"use client";

import type { LayoutFormState } from "@/domain/agreement/layout-form";
import { BlockListEditor, type LayoutDocument } from "./block-list-editor";
import { DocumentOptionsPanel } from "./document-options-panel";

type Props = {
  value: LayoutFormState;
  onChange: (next: LayoutFormState) => void;
  document: LayoutDocument;
  errors?: Record<string, string>;
};

/** The block editor's two parts in order: the document options, then the layout rows (block-editor AC 29). Both documents use it. */
export function LayoutFields({ value, onChange, document, errors }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <DocumentOptionsPanel doc={value.doc} onChange={(doc) => onChange({ ...value, doc })} errors={errors} />
      <BlockListEditor rows={value.layout} onChange={(layout) => onChange({ ...value, layout })} document={document} errors={errors} />
    </div>
  );
}
