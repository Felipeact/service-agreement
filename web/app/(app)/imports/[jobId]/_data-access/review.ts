import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";

/**
 * What the review page reads: the import job with its rows, the org's equipment types and item words, and the assets already
 * on the site (for the duplicate flags). Signed out goes to /login; a malformed or foreign id is a 404.
 */
export async function loadReview(jobId: string) {
  if (!isUuid(jobId)) notFound();
  const { currentMember, reviewImport, listAssetTypes, siteRegister, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const review = await reviewImport(jobId);
  if (!review) notFound();
  const [types, site, words] = await Promise.all([listAssetTypes(), siteRegister(review.job.siteId), getItemWords(member.orgId)]);

  // The register lists assets by type code; the flags compare type ids.
  const idOf = new Map(types.map((type) => [type.code, type.id]));
  const siteAssets = (site?.assets ?? []).flatMap((asset) => {
    const assetTypeId = idOf.get(asset.typeCode);
    return assetTypeId ? [{ assetTypeId, unitNo: asset.unitNo, typeModel: asset.typeModel, location: asset.location }] : [];
  });
  return { role: member.role, review, types, siteAssets, words };
}
