import type { Metadata } from "next";
import { Suspense } from "react";
import { canWriteRecords } from "@/components/records/state";
import { PageLoading } from "@/components/shell/page-loading";
import { isUuid } from "@/domain/imports";
import { commitImportForAgreementAction } from "./_actions/commit-for-agreement";
import { commitImportAction, mapImportTypeAction, skipImportRowAction, suggestImportTypesAction, updateImportRowAction } from "../../import-actions";
import { ReviewView } from "./_components/content";
import { loadReview } from "./_data-access/review";

export const metadata: Metadata = { title: "Review rows" };

type ReviewProps = { jobId: string; searchParams: PageProps<"/imports/[jobId]">["searchParams"] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the job, its rows and `?show` / `?page` at request time. */
export async function ReviewForRequest({ jobId, searchParams }: ReviewProps) {
  const { role, review, types, siteAssets, words } = await loadReview(jobId);
  const params = await searchParams;
  const agreementId = isUuid(first(params.agreement) ?? "") ? first(params.agreement) : undefined;
  const actions = canWriteRecords(role)
    ? {
        update: (rowId: string) => updateImportRowAction.bind(null, rowId),
        skip: (rowId: string, skipped: boolean) => skipImportRowAction.bind(null, rowId, skipped),
        map: mapImportTypeAction.bind(null, jobId),
        suggest: suggestImportTypesAction.bind(null, jobId),
        // From the New agreement dialog, the commit also builds the agreement's lines and opens it.
        commit: agreementId ? commitImportForAgreementAction.bind(null, jobId, agreementId) : commitImportAction.bind(null, jobId),
      }
    : undefined;

  return (
    <ReviewView
      review={review}
      types={types}
      siteAssets={siteAssets}
      show={first(params.show) === "attention" ? "attention" : "all"}
      page={first(params.page)}
      actions={actions}
      words={words}
      agreementId={agreementId}
    />
  );
}

export default async function ImportReviewPage({ params, searchParams }: PageProps<"/imports/[jobId]">) {
  const { jobId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Review rows" />}>
      <ReviewForRequest jobId={jobId} searchParams={searchParams} />
    </Suspense>
  );
}
