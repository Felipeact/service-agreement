import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecordPage } from "@/components/records/record-form";
import { SiteForm } from "@/components/records/site-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { createSiteAction } from "../../../../record-actions";

export const metadata: Metadata = { title: "New site" };

export default async function NewSitePage({ params }: PageProps<"/customers/[customerId]/sites/new">) {
  const { customerId } = await params;
  const { currentMember, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const customer = await customerDetail(customerId);
  if (!customer) notFound();

  return (
    <RecordPage title="New site" canWrite={canWriteRecords(member.role)}>
      <SiteForm
        initial={{ name: "", address: "", siteContactId: "" }}
        contacts={customer.contacts}
        submitLabel="Add site"
        cancelHref={cancelHrefFor("new-site", { customerId })}
        action={createSiteAction.bind(null, customerId)}
      />
    </RecordPage>
  );
}
