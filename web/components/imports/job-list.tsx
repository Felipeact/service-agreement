import type { ImportJobStatus, ImportJobView } from "@/application/ports";
import { formatFileSize, READ_ERROR_MESSAGES, readSummary } from "@/domain/imports";
import { StatusPill } from "@/components/ui/status-pill";
import { DiscardControl } from "./discard-control";
import { ReadFileControl } from "./read-file-control";
import type { DiscardState, ReadState } from "./state";

const STATUS_LABELS: Record<ImportJobStatus, string> = {
  uploaded: "Uploaded",
  uploading: "Upload not finished",
  parsed: "Read",
  unreadable: "Can't read",
};

const ATTENTION = new Set<ImportJobStatus>(["uploading", "unreadable"]);

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

/** What the read found, or why it could not read the file; nothing before a read. */
function outcomeLine(job: ImportJobView): string | null {
  if (job.outcome?.status === "parsed") return readSummary(job.outcome.tables, job.outcome.rows);
  if (job.outcome?.status === "unreadable") return READ_ERROR_MESSAGES[job.outcome.reason];
  return null;
}

type ImportJobListProps = {
  jobs: ImportJobView[];
  /** The discard action per job; absent for members who may not write, so no Discard shows. */
  discard?: (jobId: string) => () => Promise<DiscardState>;
  /** The read action per job; absent for members who may not write, so no "Read file" shows. */
  read?: (jobId: string) => () => Promise<ReadState>;
};

/** A site's import jobs, in the order given (newest first). */
export function ImportJobList({ jobs, discard, read }: ImportJobListProps) {
  if (jobs.length === 0) {
    return <p className="rounded-panel border border-hairline bg-surface px-4 py-8 text-center text-[13px] text-ink-2">No equipment lists imported yet</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
      {jobs.map((job) => {
        const line = outcomeLine(job);
        return (
          <li key={job.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[14px] font-semibold break-all">{job.originalName}</p>
              <StatusPill tone={ATTENTION.has(job.status) ? "attention" : "neutral"} label={STATUS_LABELS[job.status]} />
            </div>
            <p className="text-[13px] text-ink-2">
              {formatFileSize(job.sizeBytes)} · {job.uploadedBy ?? "Former member"} · {date.format(job.createdAt)}
            </p>
            {line && <p className="text-[13px] text-ink">{line}</p>}
            {read && job.status === "uploaded" && <ReadFileControl action={read(job.id)} />}
            {discard && <DiscardControl name={job.originalName} action={discard(job.id)} />}
          </li>
        );
      })}
    </ul>
  );
}
