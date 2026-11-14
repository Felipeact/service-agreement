"use client";

import { useState, type ReactNode } from "react";
import { STEPS } from "@/components/site/content";
import { AgreementMock, BoardMock, PortalMock, SampleLabel, ScheduleMock } from "@/components/site/mock-ui";

function ImportMock() {
  const rows: [string, string, string][] = [
    ["RTU", "RTU-01", "Rooftop, east"],
    ["Rooftop unit", "RTU-02", "Rooftop, west"],
    ["MAU", "MUA-01", "Roof, north"],
    ["Boiler (condensing)", "B-01", "Mechanical room"],
  ];
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 rounded-panel bg-surface p-4 shadow-panel sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[15px] font-semibold">harbour-point-units.xlsx</p>
          <span className="rounded-full bg-pill-completed px-2 py-0.5 text-[11px] font-semibold text-pill-completed-ink">3 of 4 recognized</span>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-ink-2">
              <th className="pb-1 font-semibold">As written</th>
              <th className="pb-1 font-semibold">Unit</th>
              <th className="pb-1 font-semibold">Matched to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([raw, unit, loc], i) => (
              <tr key={unit} className="border-t border-hairline">
                <td className="py-1.5">{raw}</td>
                <td className="py-1.5 text-ink-2">{unit}</td>
                <td className="py-1.5">
                  {i === 3 ? (
                    <span className="rounded-full bg-attention-bg px-2 py-0.5 text-[11px] font-semibold text-attention-fg">Needs a type</span>
                  ) : (
                    <span className="font-medium">{["Rooftop unit", "Rooftop unit", "Make-up air"][i]}</span>
                  )}
                  <span className="sr-only">{loc}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex items-center gap-2 text-[12px] text-ink-2">
        <SampleLabel /> Spellings are mapped to your types; doubts are flagged.
      </figcaption>
    </figure>
  );
}

const VISUALS: ReactNode[] = [<ImportMock key="import" />, <ScheduleMock key="build" />, <PortalMock key="send" />, <PortalMock key="decide" />, <AgreementMock key="sign" />, <BoardMock key="renew" />];

/** The six steps as tabs, each with a sample screen. Starts on step 1 and works without motion. */
export function DemoWalkthrough() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Steps" className="flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.n}
            role="tab"
            type="button"
            id={`demo-tab-${i}`}
            aria-selected={i === active}
            aria-controls="demo-panel"
            onClick={() => setActive(i)}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-control border px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
              i === active ? "border-action bg-action-tint text-action" : "border-hairline bg-surface text-ink hover:bg-ground"
            }`}
          >
            <span className="text-ink-2">{s.n}</span> {s.title}
          </button>
        ))}
      </div>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`} className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
        <div className="flex flex-col gap-3">
          <p className="w-fit rounded-full bg-board px-2 py-0.5 text-[11px] font-semibold text-ink-2">{step.who}</p>
          <h2 className="font-display text-[28px] leading-tight font-semibold tracking-tight">{step.summary}</h2>
          <p className="text-[15px] leading-relaxed text-ink-2">{step.detail}</p>
          <div className="flex gap-2 pt-2">
            <button type="button" disabled={active === 0} onClick={() => setActive(active - 1)} className="h-11 rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold disabled:opacity-50">
              Previous
            </button>
            <button type="button" disabled={active === STEPS.length - 1} onClick={() => setActive(active + 1)} className="h-11 rounded-control bg-action px-4 text-[13px] font-semibold text-surface disabled:opacity-50">
              Next step
            </button>
          </div>
        </div>
        <div>{VISUALS[active]}</div>
      </div>
    </div>
  );
}
