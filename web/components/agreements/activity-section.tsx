import type { TimelineEntry, TimelineType } from "@/domain/agreement";

const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" });

/** How many entries show before the rest fold away. */
const VISIBLE = 6;

/** The dot on the rail takes the colour of the stage the event moves the agreement to; the label always says it too. */
const DOT: Record<TimelineType, string> = {
  created: "bg-stage-in-progress",
  revised: "bg-stage-in-progress",
  renewal_drafted: "bg-stage-in-progress",
  sent: "bg-stage-sent",
  changes_requested: "bg-stage-sent",
  viewed: "bg-field",
  accepted: "bg-stage-accepted",
  renewed: "bg-stage-completed",
  refused: "bg-stage-refused",
  withdrawn: "bg-stage-refused",
  expired: "bg-stage-refused",
};

function Entry({ entry, last }: { entry: TimelineEntry; last: boolean }) {
  return (
    <li data-activity={entry.type} className="relative flex gap-3 pb-4 text-[13px] last:pb-0">
      {!last && <span aria-hidden="true" className="absolute top-4 bottom-0 left-[4.5px] w-px bg-hairline" />}
      <span aria-hidden="true" className={`mt-1.5 size-[10px] shrink-0 rounded-full ring-4 ring-ground ${DOT[entry.type]}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-ink">{entry.label}</span>
          {entry.versionNo !== null && <span className="rounded-full bg-board px-2 text-[11px] leading-5 font-medium text-ink-2">Version {entry.versionNo}</span>}
        </div>
        <p className="text-ink-2">
          {dateTime.format(entry.at)}
          {entry.by && ` · ${entry.by}`}
        </p>
        {entry.detail && <p className="break-words text-ink-2">{entry.detail}</p>}
        {entry.reason && (
          <p data-reason className="mt-0.5 rounded-control bg-surface px-3 py-2 break-words text-ink">
            {entry.reason}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Everything that happened to the agreement across its versions, newest first, read from `events` (activity-timeline S1-S3), as a
 * rail of dots. The latest few show; older ones fold behind one control. Read-only, so it shows the same to every role and for an
 * inactive site.
 */
export function ActivitySection({ timeline }: { timeline: TimelineEntry[] }) {
  const shown = timeline.slice(0, VISIBLE);
  const earlier = timeline.slice(VISIBLE);
  return (
    <section aria-label="Activity" className="flex flex-col gap-3">
      <h2 className="font-display text-[16px] font-semibold tracking-tight">Activity</h2>
      <ol className="flex flex-col">
        {shown.map((entry, index) => (
          <Entry key={`${entry.type}-${index}`} entry={entry} last={index === shown.length - 1 && earlier.length === 0} />
        ))}
      </ol>
      {earlier.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-action marker:hidden lg:min-h-9 [&::-webkit-details-marker]:hidden">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4l6 6-6 6" />
            </svg>
            {`Show ${earlier.length} earlier ${earlier.length === 1 ? "event" : "events"}`}
          </summary>
          <ol className="mt-3 flex flex-col">
            {earlier.map((entry, index) => (
              <Entry key={`${entry.type}-${index}`} entry={entry} last={index === earlier.length - 1} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
