import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AssetForm } from "@/components/records/asset-form";
import { DeactivateControl, ReactivateControl } from "@/components/records/active-control";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { reactivateAssetAction, removeAssetAction, updateAssetAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: PageProps<"/assets/[assetId]/edit">) {
  const { assetId } = await params;
  const { currentMember, assetForEdit, listAssetTypes, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const asset = await assetForEdit(assetId);
  if (!asset) notFound();
  const types = await listAssetTypes();
  const type = types.find((option) => option.id === asset.assetTypeId);
  const name = [type?.code ?? "Asset", asset.unitNo].filter(Boolean).join(" ");
  // The other units still in service on this site may be named as the replacement (deactivation AC 2).
  const replacements = asset.active
    ? ((await siteRegister(asset.siteId))?.assets ?? [])
        .filter((other) => other.active && other.id !== assetId)
        .map((other) => ({ id: other.id, label: [other.typeCode, other.unitNo].filter(Boolean).join(" ") }))
    : [];

  return (
    <RecordPage title="Edit asset" canWrite={canWriteRecords(member.role)}>
      <AssetForm
        initial={{ assetTypeId: asset.assetTypeId, unitNo: asset.unitNo ?? "", typeModel: asset.typeModel ?? "", location: asset.location ?? "" }}
        types={types}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-asset", { siteId: asset.siteId })}
        action={updateAssetAction.bind(null, assetId)}
      />
      {asset.active ? (
        <DeactivateControl kind="asset" name={name} replacements={replacements} action={removeAssetAction.bind(null, assetId)} />
      ) : (
        <ReactivateControl kind="asset" action={reactivateAssetAction.bind(null, assetId)} />
      )}
    </RecordPage>
  );
}
