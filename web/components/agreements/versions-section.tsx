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
 * The versions list: each version with why it exists, who made it, the Sent and Accepted markers and its history,
 * and a Compare link on every version but the shown one (a link, not a form, so a viewer can use it too; versioning S1-S3).
 */
export function VersionsSection({ agreementId, versions, shownNo, sentVersion, acceptedVersion, comparedNo }: VersionsSectionProps) {
  const latest = versions[0]?.versionNo;
  return (
    <section aria-label="Versions" className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold">Versions</h2>
      <ul className="flex flex-col gap-3">
        {versions.map((version) => (
          <li key={version.versionNo} data-version={version.versionNo} className="flex flex-col gap-1 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/agreements/${agreementId}?version=${version.versionNo}`} className={link}>
                {`Version ${version.versionNo}`}
              </Link>
              <span className="text-ink-2">{date.format(version.createdAt)}</span>
              {version.author && <span className="text-ink-2">by {version.author}</span>}
              {version.versionNo === latest && <StatusPill tone="neutral" label="Current" />}
              {version.versionNo === sentVersion && <StatusPill tone="neutral" label="Sent" />}
              {version.versionNo === acceptedVersion && <StatusPill tone="attention" label="Accepted" />}
              {version.versionNo !== shownNo && (
                <Link href={`/agreements/${agreementId}?version=${shownNo}&compare=${version.versionNo}`} className={link}>
                  {comparedNo === version.versionNo ? "Comparing" : `Compare with version ${shownNo}`}
                </Link>
              )}
            </div>
            {version.reason && (
              <p data-reason className="break-words text-ink">
                {version.reason}
              </p>
            )}
            {version.events.length === 0 ? (
              <p data-history className="text-ink-2">
                Not sent yet
              </p>
            ) : (
              <ul data-history className="flex flex-col text-ink-2">
                {version.events.map((event, index) => (
                  <li key={`${event.type}-${index}`}>
                    {EVENT_LABELS[event.type]} · {dateTime.format(event.at)}
                    {event.by && ` · ${event.by}`}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
