"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { VARIABLE_LABELS } from "@/domain/templates/editor-model";
import { useRichEditorEnv } from "./context";

/**
 * A field on the page: a chip with its plain name, or, when the editor is showing an agreement's data, that agreement's value
 * (an empty value says so, as the PDF would print nothing there).
 */
export function VariableView({ node, selected }: NodeViewProps) {
  const { fieldValues } = useRichEditorEnv();
  const name = String(node.attrs.name);
  const label = VARIABLE_LABELS[name as keyof typeof VARIABLE_LABELS] ?? name;
  const showing = fieldValues !== undefined;
  const value = showing ? fieldValues[name] : undefined;
  return (
    <NodeViewWrapper
      as="span"
      data-variable={name}
      title={showing ? label : undefined}
      className={`rich-field${showing ? " rich-field-filled" : ""}${showing && !value ? " rich-field-empty" : ""}${selected ? " ProseMirror-selectednode" : ""}`}
    >
      {showing ? value || `${label} (empty)` : label}
    </NodeViewWrapper>
  );
}
