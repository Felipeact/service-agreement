import Link from "next/link";
import type { VersionEvent, VersionView } from "@/application/ports";
import { StatusPill } from "@/components/ui/status-pill";

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });
const dateTime = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" });

const link = "inline-flex min-h-11 items-center font-medium text-action lg:min-h-0";

const EVENT_LABELS: Record<VersionEvent["type"], string> = {
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  refused: "Refused",
  changes_requested: "Changes requested",
};

type VersionsSectionProps = {
  agreementId: string;
  versions: VersionView[];
  shownNo: number;
  sentVersion: number | null;
  acceptedVersion: number | null;
  comparedNo: number | null;
};

/** Whether the section has something to say: several versions, or one with a reason or events. */
export function hasVersionStory(versions: VersionView[]): boolean {
  return versions.length > 1 || versions.some((version) => version.reason !== null || version.events.length > 0);
}

/**
 * The versions as one list: the version on screen is tinted and marked, each row says when and by whom, carries the Current, Sent
 * and Accepted markers and the reason it exists, and folds its history away until it is asked for. Compare is a link on every other
 * version, so a viewer can use it too (versioning S1-S3).
 */
export function VersionsSection({ agreementId, versions, shownNo, sentVersion, acceptedVersion, comparedNo }: VersionsSectionProps) {
  const latest = versions[0]?.versionNo;
  return (
    <section aria-label="Versions" className="flex flex-col gap-2">
      <h2 className="font-display text-[16px] font-semibold tracking-tight">Versions</h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-panel border border-hairline bg-surface">
        {versions.map((version) => {
          const viewing = version.versionNo === shownNo;
          return (
            <li key={version.versionNo} data-version={version.versionNo} aria-current={viewing ? "true" : undefined} className={`flex flex-col gap-2 px-4 py-3 text-[13px] ${viewing ? "bg-action-tint" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Link href={`/agreements/${agreementId}?version=${version.versionNo}`} className={`${link} font-semibold`}>
                  {`Version ${version.versionNo}`}
                </Link>
                {viewing && <span className="text-[12px] font-medium text-ink-2">On screen</span>}
                {version.versionNo === latest && <StatusPill tone="neutral" label="Current" />}
                {version.versionNo === sentVersion && <StatusPill tone="neutral" label="Sent" />}
                {version.versionNo === acceptedVersion && <StatusPill tone="attention" label="Accepted" />}
                <span className="text-ink-2 sm:ml-auto">
                  {date.format(version.createdAt)}
                  {version.author && ` · ${version.author}`}
                </span>
              </div>
              {version.reason && (
                <p data-reason className="break-words text-ink">
                  {version.reason}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {version.events.length === 0 ? (
                  <p data-history className="text-ink-2">
                    Not sent yet
                  </p>
                ) : (
                  <details data-history className="group text-ink-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 marker:hidden lg:min-h-9 [&::-webkit-details-marker]:hidden">
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 transition-transform duration-150 group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 4l6 6-6 6" />
                      </svg>
                      {`History · ${version.events.length} ${version.events.length === 1 ? "event" : "events"}`}
                    </summary>
                    <ul className="flex flex-col gap-1 pb-1 pl-5.5">
                      {version.events.map((event, index) => (
                        <li key={`${event.type}-${index}`}>
                          {EVENT_LABELS[event.type]} · {dateTime.format(event.at)}
                          {event.by && ` · ${event.by}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {!viewing && (
                  <Link href={`/agreements/${agreementId}?version=${shownNo}&compare=${version.versionNo}`} className={link}>
                    {comparedNo === version.versionNo ? "Comparing" : `Compare with version ${shownNo}`}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
