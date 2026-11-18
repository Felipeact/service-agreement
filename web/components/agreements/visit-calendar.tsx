import type { ServiceLineView } from "@/application/ports";
import { MONTH_NAMES, type ScheduleRow } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { ScheduleList } from "./visit-schedule";

const SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

/**
 * The staff page's "Visit schedule": the year at a glance, one row per service line and one column per month, with the
 * number of visits each month beneath; the equipment and seasonal tasks of each month open below it.
 */
export function VisitCalendar({ lines, schedule, words = DEFAULT_ITEM_WORDS }: { lines: ServiceLineView[]; schedule: ScheduleRow[]; words?: ItemWords }) {
  const visits = lines.reduce((sum, line) => sum + line.visitMonths.length, 0);
  const perMonth = SHORT.map((_, index) => lines.filter((line) => line.visitMonths.includes(index + 1)).length);

  return (
    <section aria-label="Visit schedule" className="overflow-hidden rounded-panel border border-hairline bg-surface shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-3">
        <h2 className="font-display text-[16px] font-semibold tracking-tight">Visit schedule</h2>
        <p className="text-[12px] text-ink-2">
          {lines.length === 0 ? "No visits scheduled yet" : `${visits} ${visits === 1 ? "visit" : "visits"} a year across ${schedule.length} ${schedule.length === 1 ? "month" : "months"}`}
        </p>
      </div>
      {lines.length > 0 && (
        <div className="px-4 pb-4">
          <div role="table" aria-label="Visits by month" className="flex flex-col gap-2 text-[12px]">
            <div role="row" className="grid grid-cols-12 gap-1 md:grid-cols-[minmax(10rem,14rem)_repeat(12,minmax(0,1fr))]">
              <span role="columnheader" className="hidden md:block">
                <span className="sr-only">Service line</span>
              </span>
              {SHORT.map((month, index) => (
                <span key={month} role="columnheader" aria-label={MONTH_NAMES[index]} className="text-center font-semibold text-ink-2">
                  <span className="md:hidden">{month.charAt(0)}</span>
                  <span className="hidden md:inline">{month}</span>
                </span>
              ))}
            </div>
            {lines.map((line) => (
              <div key={line.id} role="row" className="grid grid-cols-12 items-center gap-1 md:grid-cols-[minmax(10rem,14rem)_repeat(12,minmax(0,1fr))]">
                <span role="rowheader" className="col-span-12 truncate font-medium text-ink md:col-span-1 md:pr-2" title={line.description}>
                  {line.description}
                </span>
                {SHORT.map((month, index) => {
                  const on = line.visitMonths.includes(index + 1);
                  return (
                    <span
                      key={month}
                      role="cell"
                      aria-label={`${MONTH_NAMES[index]}: ${on ? "visit" : "no visit"}`}
                      className={`h-6 rounded-[5px] ${on ? "bg-action" : "bg-board"}`}
                    />
                  );
                })}
              </div>
            ))}
            <div role="row" className="grid grid-cols-12 gap-1 border-t border-hairline pt-2 md:grid-cols-[minmax(10rem,14rem)_repeat(12,minmax(0,1fr))]">
              <span role="rowheader" className="hidden font-semibold text-ink-2 md:block">
                Visits
              </span>
              {perMonth.map((count, index) => (
                <span key={SHORT[index]} role="cell" aria-label={`${MONTH_NAMES[index]}: ${count} ${count === 1 ? "visit" : "visits"}`} className={`text-center ${count > 0 ? "font-semibold text-ink" : "text-ink-2"}`}>
                  {count > 0 ? count : "–"}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {schedule.length > 0 && (
        <details className="group border-t border-hairline">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-[13px] font-semibold text-action lg:min-h-10 [&::-webkit-details-marker]:hidden">
            {itemText("Equipment and tasks by month", words)}
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7.75 4.75 5.25 5.25-5.25 5.25" />
            </svg>
          </summary>
          <div className="border-t border-hairline">
            <ScheduleList schedule={schedule} />
          </div>
        </details>
      )}
    </section>
  );
}
