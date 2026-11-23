"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useRichEditorEnv } from "./context";
import { selectOnTap } from "./select-on-tap";

const SIDE = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;

/** An uploaded picture at its width and side; its size and place are set from the side panel when it is selected. */
export function ImageView({ node, selected, editor, getPos }: NodeViewProps) {
  const { imageUrl } = useRichEditorEnv();
  const align = (node.attrs.align ?? "center") as keyof typeof SIDE;
  const asset = node.attrs.asset as string | null;
  return (
    <NodeViewWrapper
      onClick={selectOnTap({ editor, getPos })}
      data-picture
      className={`my-[4pt] flex ${SIDE[align] ?? SIDE.center}`}>
      <div contentEditable={false} data-drag-handle className={`rounded-[2px] ${selected ? "outline-2 outline-offset-2 outline-action" : ""}`} style={{ width: `${node.attrs.width}%` }}>
        {asset ? (
          // A tenant upload from the public bucket at any size; next/image would need the bucket host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(asset)} alt="" draggable={false} className="block h-auto w-full" />
        ) : (
          <span className="block rounded-[2px] bg-board p-3 text-center text-ink-2">Picture missing. Delete it and upload it again.</span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
