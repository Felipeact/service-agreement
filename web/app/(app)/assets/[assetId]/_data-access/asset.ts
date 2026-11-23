import { notFound, redirect } from "next/navigation";
import { replacementOptions } from "@/components/records/state";
import { getContainer } from "@/composition";

/**
 * What the edit asset page reads: the asset, the org's equipment types, and for an asset still in service the other units on
 * its site that can replace it. Signed out goes to /login; a missing or foreign id is a 404.
 */
export async function loadAssetToEdit(assetId: string) {
  const { currentMember, assetForEdit, listAssetTypes, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const asset = await assetForEdit(assetId);
  if (!asset) notFound();
  const types = await listAssetTypes();
  const type = types.find((option) => option.id === asset.assetTypeId);
  const name = [type?.code ?? "Asset", asset.unitNo].filter(Boolean).join(" ");
  const replacements = asset.active ? replacementOptions((await siteRegister(asset.siteId))?.assets ?? [], assetId) : [];
  return { role: member.role, asset, types, name, replacements };
}
