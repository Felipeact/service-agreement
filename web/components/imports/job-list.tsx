import type { ImportJobStatus, ImportJobView } from "@/application/ports";
import { formatFileSize } from "@/domain/imports";
import { StatusPill } from "@/components/ui/status-pill";
import { DiscardControl } from "./discard-control";
import type { DiscardState } from "./state";

const STATUS_LABELS: Record<ImportJobStatus, string> = {
  uploaded: "Uploaded",
  uploading: "Upload not finished",
};

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

type ImportJobListProps = {
  jobs: ImportJobView[];
  /** The discard action per job; absent for members who may not write, so no Discard shows. */
  discard?: (jobId: string) => () => Promise<DiscardState>;
};

/** A site's import jobs, in the order given (newest first). */
export function ImportJobList({ jobs, discard }: ImportJobListProps) {
  if (jobs.length === 0) {
    return <p className="rounded-panel border border-hairline bg-surface px-4 py-8 text-center text-[13px] text-ink-2">No equipment lists imported yet</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
      {jobs.map((job) => (
        <li key={job.id} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold break-all">{job.originalName}</p>
            <StatusPill tone={job.status === "uploaded" ? "neutral" : "attention"} label={STATUS_LABELS[job.status]} />
          </div>
          <p className="text-[13px] text-ink-2">
            {formatFileSize(job.sizeBytes)} · {job.uploadedBy ?? "Former member"} · {date.format(job.createdAt)}
          </p>
          {discard && <DiscardControl name={job.originalName} action={discard(job.id)} />}
        </li>
      ))}
    </ul>
  );
}
