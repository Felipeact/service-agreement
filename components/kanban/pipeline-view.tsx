"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { PIPELINE_STAGES, STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";
import type { PipelineCard } from "@/lib/sample-pipeline";
import { KanbanColumn } from "./kanban-column";

/** The Pipeline page body: header with search, then the board (tabs on mobile, scroll on tablet, grid on desktop). */
export function PipelineView({ cards }: { cards: PipelineCard[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PipelineStage>("in_progress");
  const searchRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Partial<Record<PipelineStage, HTMLButtonElement | null>>>({});

  const needle = query.trim().toLowerCase();
  const shown = needle ? cards.filter((card) => card.customer.toLowerCase().includes(needle)) : cards;
  const byStage = (stage: PipelineStage) => shown.filter((card) => card.stage === stage);

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = PIPELINE_STAGES[(index + step + PIPELINE_STAGES.length) % PIPELINE_STAGES.length];
    setSelected(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pipeline"
        badge={<StatusPill tone="neutral" label="Sample data" />}
        controls={
          <SearchInput
            ref={searchRef}
            label="Search agreements"
            placeholder="Search customers…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full md:w-60"
          />
        }
        action={
          <Button variant="primary" disabled title="The agreement builder arrives in a later release">
            New agreement
          </Button>
        }
      />

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-panel border border-hairline bg-surface px-4 py-12 text-center">
          <p className="text-[14px] font-semibold">No agreements match &quot;{query}&quot;</p>
          <Button onClick={clearSearch}>Clear search</Button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Pipeline stage" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
            {PIPELINE_STAGES.map((stage, index) => {
              const active = stage === selected;
              return (
                <button
                  key={stage}
                  ref={(node) => {
                    tabRefs.current[stage] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${stage}`}
                  aria-selected={active}
                  aria-controls={`panel-${stage}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelected(stage)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control border px-3 font-semibold whitespace-nowrap ${
                    active ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink"
                  }`}
                >
                  <span aria-hidden="true" className={`size-2 rounded-full ${STAGE_META[stage].dotClass}`} />
                  {STAGE_META[stage].shortLabel}
                  <span className={active ? "text-action" : "text-ink-2"}>{byStage(stage).length}</span>
                </button>
              );
            })}
          </div>

          <div
            data-board
            className="flex flex-col gap-3.5 md:flex-row md:overflow-x-auto md:pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0"
          >
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                cards={byStage(stage)}
                className={`${stage === selected ? "flex" : "hidden"} md:flex md:min-w-60 md:flex-1 lg:min-w-0`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
