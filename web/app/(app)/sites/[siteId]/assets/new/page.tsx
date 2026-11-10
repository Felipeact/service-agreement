import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AssetForm } from "@/components/records/asset-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { getContainer } from "@/composition";
import { itemText } from "@/domain/org-settings";
import { createAssetAction } from "../../../../record-actions";

export const metadata: Metadata = { title: "New asset" };

export default async function NewAssetPage({ params }: PageProps<"/sites/[siteId]/assets/new">) {
  const { siteId } = await params;
  const { currentMember, siteRegister, listAssetTypes, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!(await siteRegister(siteId))) notFound();
  const [types, words] = await Promise.all([listAssetTypes(), getItemWords(member.orgId)]);
  const cancelHref = cancelHrefFor("new-asset", { siteId });

  return (
    <RecordPage title="New asset" canWrite={canWriteRecords(member.role)}>
      {types.length === 0 ? (
        <EmptyPanel title={itemText("Your equipment catalog is empty.", words)} text={itemText("Equipment types come from your starter catalog.", words)}>
          <LinkButton href={cancelHref}>Back to site</LinkButton>
        </EmptyPanel>
      ) : (
        <AssetForm
          initial={{ assetTypeId: "", unitNo: "", typeModel: "", location: "" }}
          types={types}
          submitLabel="Add asset"
          cancelHref={cancelHref}
          action={createAssetAction.bind(null, siteId)}
        />
      )}
    </RecordPage>
  );
}
