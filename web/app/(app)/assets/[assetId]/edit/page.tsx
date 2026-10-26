import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AssetForm } from "@/components/records/asset-form";
import { DeleteControl } from "@/components/records/delete-control";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { deleteAssetAction, updateAssetAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: PageProps<"/assets/[assetId]/edit">) {
  const { assetId } = await params;
  const { currentMember, assetForEdit, listAssetTypes } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const asset = await assetForEdit(assetId);
  if (!asset) notFound();
  const types = await listAssetTypes();
  const typeName = types.find((type) => type.id === asset.assetTypeId)?.name ?? "asset";

  return (
    <RecordPage title="Edit asset" canWrite={canWriteRecords(member.role)}>
      <AssetForm
        initial={{ assetTypeId: asset.assetTypeId, unitNo: asset.unitNo ?? "", typeModel: asset.typeModel ?? "", location: asset.location ?? "" }}
        types={types}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-asset", { siteId: asset.siteId })}
        action={updateAssetAction.bind(null, assetId)}
      />
      <DeleteControl label="Delete asset" name={asset.unitNo ? `${typeName} ${asset.unitNo}` : `this ${typeName}`} action={deleteAssetAction.bind(null, assetId)} />
    </RecordPage>
  );
}
