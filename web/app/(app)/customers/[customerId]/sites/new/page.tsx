import type { Metadata } from "next";
import { RecordPage } from "@/components/records/record-form";
import { SiteForm } from "@/components/records/site-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { loadCustomer } from "../../_data-access/customer";
import { createSiteAction } from "../../../../record-actions";

export const metadata: Metadata = { title: "New site" };

export default async function NewSitePage({ params }: PageProps<"/customers/[customerId]/sites/new">) {
  const { customerId } = await params;
  const { role, customer } = await loadCustomer(customerId);

  return (
    <RecordPage title="New site" canWrite={canWriteRecords(role)}>
      <SiteForm
        initial={{ name: "", address: "", siteContactId: "", approverContactId: "" }}
        contacts={customer.contacts}
        submitLabel="Add site"
        cancelHref={cancelHrefFor("new-site", { customerId })}
        action={createSiteAction.bind(null, customerId)}
      />
    </RecordPage>
  );
}
