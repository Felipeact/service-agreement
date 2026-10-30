import { MONTH_NAMES, type ScheduleRow } from "@/domain/agreement";

/** "Visit schedule": each month with a visit, the equipment visited in it and its seasonal tasks (cadence AC 20 to 22, seasonal-tasks AC 16). */
export function VisitScheduleSection({ schedule }: { schedule: ScheduleRow[] }) {
  return (
    <section aria-label="Visit schedule" className="overflow-hidden rounded-panel border border-hairline bg-surface">
      <h2 className="border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold">Visit schedule</h2>
      {schedule.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-2">No visits scheduled yet</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {schedule.map((row) => (
            <li key={row.month} data-month={row.month} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 text-[13px]">
              <span className="font-medium">{MONTH_NAMES[row.month - 1]}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="break-words text-ink-2">{row.equipment.join(", ")}</span>
                {row.tasks.map((task) => (
                  <span key={`${task.type}:${task.description}`} className="break-words">{`${task.type}: ${task.description}`}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
