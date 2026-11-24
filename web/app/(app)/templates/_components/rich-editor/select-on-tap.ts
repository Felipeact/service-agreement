import type { NodeViewProps } from "@tiptap/react";

/**
 * A tap or click on a part (a live section, a picture, the logo) selects it, so its options open. ProseMirror selects a clicked leaf
 * on its own with a mouse, but a tap on a touch screen while the cursor sits in text can leave the cursor where it was.
 */
export const selectOnTap =
  ({ editor, getPos }: Pick<NodeViewProps, "editor" | "getPos">) =>
  () => {
    const pos = getPos();
    if (typeof pos === "number" && editor.isEditable) editor.chain().focus().setNodeSelection(pos).run();
  };
