/**
 * Synthetic product visuals for the public site. Every name, number and date here is invented demonstration data
 * (a fictitious contractor and fictitious sites) and each visual says so in a "Sample data" label. They are drawn
 * from design tokens only and never imply a customer, a result or a metric.
 */

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"] as const;

export function SampleLabel({ className = "" }: { className?: string }) {
  return <span className={`rounded-full bg-board px-2 py-0.5 text-[11px] font-semibold text-ink-2 ${className}`}>Sample data</span>;
}

type Card = { site: string; customer: string; amount: string; age: string; attention?: string };
type Column = { key: string; label: string; dot: string; well: string; total: string; cards: Card[] };

const COLUMNS: Column[] = [
  {
    key: "in_progress",
    label: "In progress",
    dot: "bg-stage-in-progress",
    well: "bg-tint-in-progress",
    total: "$21,400/yr",
    cards: [
      { site: "Harbour Point Tower", customer: "Northgate Properties", amount: "$14,280/yr", age: "Updated 2 days ago" },
      { site: "Elm Street School", customer: "Westside District", amount: "$7,120/yr", age: "Updated 5 days ago" },
    ],
  },
  {
    key: "sent",
    label: "Sent to customer",
    dot: "bg-stage-sent",
    well: "bg-tint-sent",
    total: "$18,900/yr",
    cards: [{ site: "Maple Court Plaza", customer: "Ridgeline Realty", amount: "$18,900/yr", age: "Sent 9 days ago", attention: "No reply in 9 days" }],
  },
  {
    key: "accepted",
    label: "Accepted",
    dot: "bg-stage-accepted",
    well: "bg-tint-accepted",
    total: "$9,640/yr",
    cards: [{ site: "Cedar Medical Centre", customer: "Cedar Health Group", amount: "$9,640/yr", age: "Accepted today" }],
  },
  {
    key: "completed",
    label: "Completed",
    dot: "bg-stage-completed",
    well: "bg-board/60",
    total: "$18,800/yr signed",
    cards: [{ site: "Pine Ridge Offices", customer: "Pine Ridge Holdings", amount: "$18,800/yr", age: "Signed last week" }],
  },
];

/** A cropped slice of the pipeline board: four stages with stage-tinted wells, one stale deal flagged. */
export function BoardMock({ className = "" }: { className?: string }) {
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {COLUMNS.map((col, i) => (
          <div key={col.key} className={`${i > 1 ? "hidden lg:flex" : "flex"} flex-col gap-2 rounded-panel p-2.5 ${col.well}`}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`size-2 rounded-full ${col.dot}`} />
                <span className="font-display text-[14px] font-semibold">{col.label}</span>
                <span className="text-[12px] text-ink-2">{col.cards.length}</span>
              </div>
              <span className="text-[12px] text-ink-2">{col.total}</span>
            </div>
            {col.cards.map((card, k) => (
              <div key={card.site} style={{ animationDelay: `${650 + (i + k) * 90}ms` }} className="settle flex flex-col gap-1 rounded-control bg-surface px-3 py-2.5 shadow-card">
                <p className="text-[13.5px] leading-snug font-semibold">{card.site}</p>
                <p className="text-[12px] text-ink-2">{card.customer}</p>
                <p className="text-[12px] text-ink-2">{card.age}</p>
                {card.attention && <p className="w-fit rounded-full bg-attention-bg px-2 py-0.5 text-[11px] font-semibold text-attention-fg">{card.attention}</p>}
                <p className="mt-1 border-t border-hairline pt-1.5 text-[13px] font-semibold">{card.amount}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <figcaption className="flex items-center gap-2 text-[12px] text-ink-2">
        <SampleLabel /> A fictitious contractor&apos;s pipeline.<span className="lg:hidden"> Two of four stages shown.</span>
      </figcaption>
    </figure>
  );
}

/** One page of a priced agreement: price lines, visit months and the signature block, on a sheet. */
export function AgreementMock({ className = "", signed = true }: { className?: string; signed?: boolean }) {
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col gap-4 rounded-panel bg-surface p-5 text-ink shadow-panel sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-3">
          <div>
            <p className="font-display text-[18px] font-semibold tracking-tight">Service Agreement</p>
            <p className="text-[12px] text-ink-2">Harbour Point Tower · Jan 1 – Dec 31, 2027 · 12 months</p>
          </div>
          <span className="rounded-full bg-pill-accepted px-2 py-0.5 text-[11px] font-semibold text-pill-accepted-ink">Accepted</span>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-ink-2">
              <th className="pb-1 font-semibold">Service line</th>
              <th className="pb-1 font-semibold">Visits</th>
              <th className="pb-1 text-right font-semibold">Per year</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Heating and cooling units", "4 × $2,400", "$9,600"],
              ["Boilers", "1 × $3,200", "$3,200"],
              ["Exhaust fans", "2 × $740", "$1,480"],
            ].map(([line, visits, total]) => (
              <tr key={line} className="border-t border-hairline">
                <td className="py-1.5">{line}</td>
                <td className="py-1.5 text-ink-2">{visits}</td>
                <td className="py-1.5 text-right font-semibold">{total}</td>
              </tr>
            ))}
            <tr className="border-t border-ink">
              <td colSpan={2} className="pt-2 font-semibold">
                Annual total
              </td>
              <td className="pt-2 text-right text-[14px] font-semibold">$14,280/yr</td>
            </tr>
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-4 pt-1">
          {["Customer", "Contractor"].map((who, i) => (
            <div key={who} className="flex flex-col gap-1">
              <svg aria-hidden="true" viewBox="0 0 120 36" className="h-9 w-full fill-none stroke-action" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {signed && (
                  <path
                    d={i === 0 ? "M6 26c6-16 10-16 12-2s7 6 12-6 8 4 13-1 8-8 14-2 8 2 14-4" : "M8 22c8-12 12 4 18-8s8 14 16 0 12-6 18 4 10-6 16-2"}
                    pathLength={1}
                    className="sa-sign"
                    style={{ animationDelay: `${0.6 + i * 0.9}s` }}
                  />
                )}
              </svg>
              <div className="border-t border-field pt-1 text-[11px] text-ink-2">{who} signature</div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="flex items-center gap-2 text-[12px]">
        <SampleLabel /> <span className="opacity-80">An invented agreement.</span>
      </figcaption>
    </figure>
  );
}

const LINES: { name: string; months: number[] }[] = [
  { name: "Heating and cooling units", months: [2, 5, 8, 11] },
  { name: "Boilers", months: [9] },
  { name: "Exhaust fans", months: [3, 9] },
  { name: "Backflow preventers", months: [4] },
];

/** The 12-month visit grid: each service line lights its own months. */
export function ScheduleMock({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  const wrap = onDark ? "bg-surface text-ink" : "bg-surface text-ink";
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className={`flex flex-col gap-3 rounded-panel p-4 shadow-panel sm:p-5 ${wrap}`}>
        <div className="grid grid-cols-[minmax(7rem,1.4fr)_repeat(12,minmax(0,1fr))] items-center gap-x-1 gap-y-2">
          <span aria-hidden="true" />
          {MONTHS.map((m, i) => (
            <span key={i} className="text-center text-[11px] font-semibold text-ink-2">
              {m}
            </span>
          ))}
          {LINES.map((line) => (
            <Row key={line.name} name={line.name} months={line.months} />
          ))}
        </div>
        <p className="border-t border-hairline pt-2 text-[12px] text-ink-2">Each line holds its own months. The number lit is its visits per year.</p>
      </div>
      <figcaption className="flex items-center gap-2 text-[12px]">
        <SampleLabel /> <span className="opacity-80">An invented visit schedule.</span>
      </figcaption>
    </figure>
  );
}

function Row({ name, months }: { name: string; months: number[] }) {
  return (
    <>
      <span className="text-[12.5px] leading-tight font-medium">{name}</span>
      {MONTHS.map((_, i) => (
        <span
          key={i}
          className={`mx-auto h-6 w-full max-w-7 rounded-[4px] ${months.includes(i) ? "sa-pop bg-action" : "bg-board"}`}
          style={months.includes(i) ? { animationDelay: `${0.25 + i * 0.06}s` } : undefined}
        >
          <span className="sr-only">{months.includes(i) ? `Visit in month ${i + 1}` : ""}</span>
        </span>
      ))}
    </>
  );
}

const SCOPE: { type: string; tasks: string[] }[] = [
  { type: "Rooftop units", tasks: ["Replace filters", "Check belts and bearings", "Clean condensate drain"] },
  { type: "Boilers", tasks: ["Inspect burner and flame", "Test safety controls"] },
];

/** "Service included", written from the item types on site, each with its own checklist. */
export function ScopeMock({ className = "" }: { className?: string }) {
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col gap-4 rounded-panel bg-surface p-5 text-ink shadow-panel">
        <p className="font-display text-[16px] font-semibold tracking-tight">Service included</p>
        {SCOPE.map((group) => (
          <div key={group.type} className="flex flex-col gap-1.5">
            <p className="text-[13px] font-semibold">{group.type}</p>
            <ul className="flex flex-col gap-1">
              {group.tasks.map((task) => (
                <li key={task} className="flex items-center gap-2 text-[13px] text-ink-2">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 fill-none stroke-stage-completed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 10 4 4 8-9" />
                  </svg>
                  {task}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="flex items-center gap-2 text-[12px]">
        <SampleLabel /> Written from the types on site.
      </figcaption>
    </figure>
  );
}

const SEASONS: { label: string; span: number }[] = [
  { label: "Winter", span: 2 },
  { label: "Spring start-up", span: 3 },
  { label: "Summer cooling", span: 3 },
  { label: "Fall shut-down", span: 3 },
  { label: "Winter", span: 1 },
];

/** The whole service year on one wide panel: seasons over the twelve months, each line lighting its own visits. */
export function YearBand({ className = "" }: { className?: string }) {
  return (
    <figure className={`flex min-w-0 max-w-full flex-col gap-2 ${className}`}>
      <div className="relative flex w-full min-w-0 flex-col gap-3 overflow-x-auto rounded-panel bg-surface p-4 text-ink shadow-panel sm:p-6">
        <div className="grid min-w-[640px] grid-cols-[minmax(9rem,1.3fr)_repeat(12,minmax(0,1fr))] items-center gap-x-1 gap-y-2.5">
          <span aria-hidden="true" />
          {SEASONS.map((season, i) => (
            <span key={i} style={{ gridColumn: `span ${season.span}` }} className="truncate rounded-[4px] bg-board px-2 py-1 text-center text-[12px] font-semibold text-ink-2">
              {season.label}
            </span>
          ))}
          <span aria-hidden="true" />
          {MONTHS.map((m, i) => (
            <span key={i} className="text-center text-[11px] font-semibold text-ink-2">
              {m}
            </span>
          ))}
          {LINES.map((line) => (
            <YearRow key={line.name} name={line.name} months={line.months} />
          ))}
        </div>
      </div>
      <figcaption className="flex items-center gap-2 text-[12px] text-night-ink">
        <SampleLabel /> One contractor&apos;s invented service year. The customer signs once.
      </figcaption>
    </figure>
  );
}

function YearRow({ name, months }: { name: string; months: number[] }) {
  return (
    <>
      <span className="text-[13px] leading-tight font-medium">{name}</span>
      {MONTHS.map((_, i) => (
        <span key={i} className={`mx-auto h-8 w-full rounded-[4px] ${months.includes(i) ? "sa-pop bg-action" : "bg-board"}`} style={months.includes(i) ? { animationDelay: `${0.2 + i * 0.05}s` } : undefined}>
          <span className="sr-only">{months.includes(i) ? `Visit in month ${i + 1}` : ""}</span>
        </span>
      ))}
    </>
  );
}

/** A customer's review page, wearing a fictitious contractor's brand, with the three decisions. */
export function PortalMock({ className = "" }: { className?: string }) {
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-col gap-4 rounded-panel bg-surface p-5 shadow-panel">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-control bg-night font-display text-[13px] font-semibold text-surface">
            BH
          </span>
          <div>
            <p className="font-display text-[15px] font-semibold">Blue Heron Mechanical</p>
            <p className="text-[12px] text-ink-2">Service agreement for Harbour Point Tower</p>
          </div>
        </div>
        <p className="text-[24px] leading-none font-semibold tracking-tight">
          $14,280<span className="text-[13px] font-normal text-ink-2">/yr</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <span className="flex h-11 items-center justify-center rounded-control bg-night text-[13px] font-semibold text-surface">Accept</span>
          <span className="flex h-11 items-center justify-center rounded-control border border-hairline text-[13px] font-semibold">Request changes</span>
          <span className="flex h-11 items-center justify-center rounded-control border border-hairline text-[13px] font-semibold">Refuse</span>
        </div>
      </div>
      <figcaption className="flex items-center gap-2 text-[12px] text-ink-2">
        <SampleLabel /> A fictitious contractor&apos;s brand. Yours replaces it.
      </figcaption>
    </figure>
  );
}
