import Link from "next/link";
import type { ImportJobView } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { ImportUploader } from "./import-upload";
import { ImportJobList } from "./job-list";
import type { ConfirmState, DiscardState, ExtractState, ReadState, StartState } from "./state";

type ImportPageViewProps = {
  site: { id: string; name: string };
  jobs: ImportJobView[];
  /** The writer's actions; absent for a viewer, who sees the jobs only. */
  actions?: {
    start: (formData: FormData) => Promise<StartState>;
    confirm: (jobId: string) => Promise<ConfirmState>;
    discard: (jobId: string) => () => Promise<DiscardState>;
    read: (jobId: string) => Promise<ReadState>;
    extract: (jobId: string) => Promise<ExtractState>;
  };
};

/** The import page body: the site, the upload form for writers, then the site's jobs. */
export function ImportPageView({ site, jobs, actions }: ImportPageViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href={`/sites/${site.id}`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          Back to site
        </Link>
        <PageHeader title={site.name} />
      </div>
      {actions && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Import equipment list</h2>
          <ImportUploader start={actions.start} confirm={actions.confirm} read={actions.read} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Imported lists</h2>
        <ImportJobList jobs={jobs} discard={actions?.discard} read={actions && ((jobId) => () => actions.read(jobId))} extract={actions?.extract} />
      </section>
    </div>
  );
}
