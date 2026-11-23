"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Image as ImageIcon } from "lucide-react";
import { useRichEditorEnv } from "./context";
import { selectOnTap } from "./select-on-tap";

const SIDE = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;
const SIZE = { small: "max-h-[32pt] max-w-[100pt]", medium: "max-h-[48pt] max-w-[160pt]", large: "max-h-[80pt] max-w-[240pt]" } as const;

/** The company logo from Settings, at the size the PDF gives it; without one, a placeholder says where to add it. */
export function LogoView({ node, selected, editor, getPos }: NodeViewProps) {
  const { logoUrl } = useRichEditorEnv();
  const align = (node.attrs.align ?? "left") as keyof typeof SIDE;
  const size = (node.attrs.size ?? "medium") as keyof typeof SIZE;
  return (
    <NodeViewWrapper
      onClick={selectOnTap({ editor, getPos })}
      data-company-logo-view
      className={`my-[4pt] flex ${SIDE[align] ?? SIDE.left}`}>
      <div contentEditable={false} data-drag-handle className={`rounded-[2px] ${selected ? "outline-2 outline-offset-2 outline-action" : ""}`}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Company logo" draggable={false} className={`block h-auto w-auto ${SIZE[size] ?? SIZE.medium}`} />
        ) : (
          <span title="Your logo from Settings prints here. Add one in Settings." className="inline-flex items-center gap-1 rounded-[3px] border border-dashed border-field px-[5pt] py-[2pt] text-[calc(8*var(--pt))] font-medium text-ink-2">
            <ImageIcon className="size-[10pt]" aria-hidden="true" />
            Logo
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}
