import type { Metadata } from "next";
import { DeactivateControl, ReactivateControl } from "@/components/records/active-control";
import { RecordPage } from "@/components/records/record-form";
import { SiteForm } from "@/components/records/site-form";
import { cancelHrefFor, canWriteRecords, withdrawnBy } from "@/components/records/state";
import { loadSiteToEdit } from "../_data-access/site";
import { deactivateSiteAction, reactivateSiteAction, updateSiteAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit site" };

export default async function EditSitePage({ params }: PageProps<"/sites/[siteId]/edit">) {
  const { siteId } = await params;
  const { role, site, customer } = await loadSiteToEdit(siteId);

  return (
    <RecordPage title="Edit site" canWrite={canWriteRecords(role)}>
      <SiteForm
        initial={{ name: site.name, address: site.address ?? "", siteContactId: site.siteContactId ?? "", approverContactId: site.approverContactId ?? "" }}
        contacts={customer.contacts}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-site", { customerId: site.customerId })}
        action={updateSiteAction.bind(null, siteId)}
      />
      {site.active ? (
        <DeactivateControl kind="site" name={site.name} withdraws={withdrawnBy(site.liveAgreement)} action={deactivateSiteAction.bind(null, siteId)} />
      ) : (
        <ReactivateControl kind="site" action={reactivateSiteAction.bind(null, siteId)} />
      )}
    </RecordPage>
  );
}
