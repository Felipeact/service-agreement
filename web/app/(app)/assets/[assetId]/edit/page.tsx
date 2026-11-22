import type { Metadata } from "next";
import { AssetForm } from "@/components/records/asset-form";
import { DeactivateControl, ReactivateControl } from "@/components/records/active-control";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { loadAssetToEdit } from "../_data-access/asset";
import { reactivateAssetAction, removeAssetAction, updateAssetAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({ params }: PageProps<"/assets/[assetId]/edit">) {
  const { assetId } = await params;
  const { role, asset, types, name, replacements } = await loadAssetToEdit(assetId);

  return (
    <RecordPage title="Edit asset" canWrite={canWriteRecords(role)}>
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
