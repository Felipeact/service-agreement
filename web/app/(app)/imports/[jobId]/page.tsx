import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ReviewView } from "@/components/imports/review-view";
import { canWriteRecords } from "@/components/records/state";
import { PageLoading } from "@/components/shell/page-loading";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { commitImportAction, mapImportTypeAction, skipImportRowAction, updateImportRowAction } from "../../import-actions";

export const metadata: Metadata = { title: "Review rows" };

type ReviewProps = { jobId: string; searchParams: PageProps<"/imports/[jobId]">["searchParams"] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads the job, its rows and `?show` / `?page` at request time. */
export async function ReviewForRequest({ jobId, searchParams }: ReviewProps) {
  if (!isUuid(jobId)) notFound();
  const { currentMember, reviewImport, listAssetTypes, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const review = await reviewImport(jobId);
  if (!review) notFound();
  const [types, site, params] = await Promise.all([listAssetTypes(), siteRegister(review.job.siteId), searchParams]);

  // The register lists assets by type code; the flags compare type ids.
  const idOf = new Map(types.map((type) => [type.code, type.id]));
  const siteAssets = (site?.assets ?? []).flatMap((asset) => {
    const assetTypeId = idOf.get(asset.typeCode);
    return assetTypeId ? [{ assetTypeId, unitNo: asset.unitNo }] : [];
  });
  const actions = canWriteRecords(member.role)
    ? {
        update: (rowId: string) => updateImportRowAction.bind(null, rowId),
        skip: (rowId: string, skipped: boolean) => skipImportRowAction.bind(null, rowId, skipped),
        map: mapImportTypeAction.bind(null, jobId),
        commit: commitImportAction.bind(null, jobId),
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
