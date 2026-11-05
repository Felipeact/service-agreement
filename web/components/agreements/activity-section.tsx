import type { TimelineEntry } from "@/domain/agreement";

const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" });

/**
 * Everything that happened to the agreement across its versions, newest first, read from `events`
 * (activity-timeline S1-S3). Read-only, so it shows the same to every role and for an inactive site.
 */
export function ActivitySection({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <section aria-label="Activity" className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold">Activity</h2>
      <ol className="flex flex-col gap-3">
        {timeline.map((entry, index) => (
          <li key={`${entry.type}-${index}`} data-activity={entry.type} className="flex flex-col gap-0.5 text-[13px]">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{entry.label}</span>
              {entry.versionNo !== null && <span className="text-ink-2">Version {entry.versionNo}</span>}
              <span className="text-ink-2">{dateTime.format(entry.at)}</span>
              {entry.by && <span className="text-ink-2">· {entry.by}</span>}
            </div>
            {entry.detail && <p className="break-words text-ink-2">{entry.detail}</p>}
            {entry.reason && (
              <p data-reason className="break-words text-ink">
                {entry.reason}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
