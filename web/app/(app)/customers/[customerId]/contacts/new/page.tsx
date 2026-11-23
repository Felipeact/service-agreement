import type { Metadata } from "next";
import { ContactForm } from "@/components/records/contact-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { loadCustomer } from "../../_data-access/customer";
import { createContactAction } from "../../../../record-actions";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({ params }: PageProps<"/customers/[customerId]/contacts/new">) {
  const { customerId } = await params;
  const { role } = await loadCustomer(customerId);

  return (
    <RecordPage title="New contact" canWrite={canWriteRecords(role)}>
      <ContactForm
        initial={{ name: "", email: "", phone: "" }}
        submitLabel="Add contact"
        cancelHref={cancelHrefFor("new-contact", { customerId })}
        action={createContactAction.bind(null, customerId)}
      />
    </RecordPage>
  );
}
