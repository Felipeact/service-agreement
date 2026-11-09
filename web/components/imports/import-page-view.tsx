import Link from "next/link";
import type { ImportJobView } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { ImportUploader } from "./import-upload";
import { ImportJobList } from "./job-list";
import type { ConfirmState, DiscardState, ExtractState, ReadState, StartState } from "./state";

type ImportPageViewProps = {
  site: { id: string; name: string };
  jobs: ImportJobView[];
  /** The agreement started with the list that is being read here (`?agreement=`), linked back from the top of the page. */
  agreementId?: string;
  /** The writer's actions; absent for a viewer, who sees the jobs only. */
  actions?: {
    start: (formData: FormData) => Promise<StartState>;
    confirm: (jobId: string) => Promise<ConfirmState>;
    discard: (jobId: string) => () => Promise<DiscardState>;
    read: (jobId: string) => Promise<ReadState>;
    extract: (jobId: string) => Promise<ExtractState>;
  };
  words?: ItemWords;
};

/** The import page body: the site, the upload form for writers, then the site's jobs. */
export function ImportPageView({ site, jobs, actions, agreementId, words = DEFAULT_ITEM_WORDS }: ImportPageViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href={`/sites/${site.id}`} className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          Back to site
        </Link>
        <PageHeader title={site.name} />
      </div>
      {agreementId && (
        <section aria-label="Your agreement" className="flex flex-col gap-2 rounded-panel bg-action-tint px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-ink">{itemText("Your agreement is started. Finish reading the equipment list here, add it to the site, then continue.", words)}</p>
          <Link href={`/agreements/${agreementId}`} className="inline-flex min-h-11 shrink-0 items-center font-semibold text-action lg:min-h-0">
            Skip to the agreement
          </Link>
        </section>
      )}
      {actions && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">{itemText("Import equipment list", words)}</h2>
          <ImportUploader start={actions.start} confirm={actions.confirm} read={actions.read} />
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Imported lists</h2>
        <ImportJobList words={words} jobs={jobs} discard={actions?.discard} read={actions && ((jobId) => () => actions.read(jobId))} extract={actions?.extract} />
      </section>
    </div>
  );
}
