"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useItemWords } from "@/components/shell/item-words";
import { sectionRowOf } from "@/domain/agreement/rich-form";
import type { SectionKey } from "@/domain/agreement/layout";
import { useRichEditorEnv } from "./context";
import { selectOnTap } from "./select-on-tap";
import { SectionSample, sectionName } from "./section-sample";

/**
 * A live section on the page: a tinted block tagged "Live data", so the tenant always tells their own words from what each
 * agreement fills in. Selecting it opens its options in the side panel; it can be dragged by its handle.
 */
export function SectionView({ node, selected, editor, getPos }: NodeViewProps) {
  const env = useRichEditorEnv();
  const words = useItemWords();
  const key = node.attrs.key as SectionKey;
  const row = sectionRowOf(key, node.attrs.options);
  return (
    <NodeViewWrapper
      onClick={selectOnTap({ editor, getPos })}
      data-live-section={key}
      className={`rich-live my-[6pt] rounded-control border bg-action-tint/40 px-[8pt] pt-[4pt] pb-[6pt] ${selected ? "border-action ring-2 ring-action/30" : "border-action/25"}`}
    >
      <div className="mb-[3pt] flex items-center justify-between gap-2" contentEditable={false}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-action not-italic">
          <span data-drag-handle className="cursor-grab select-none px-0.5 text-ink-2" aria-hidden="true">
            ⠿
          </span>
          Live data · {sectionName(key, words)}
        </span>
        {selected && <span className="text-[11px] text-ink-2">Options are in the side panel</span>}
      </div>
      <div contentEditable={false} className="select-none">
        <SectionSample row={row} lines={env.presetLines} accent={env.accent} />
      </div>
    </NodeViewWrapper>
  );
}
