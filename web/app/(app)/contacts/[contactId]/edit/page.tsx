import type { Metadata } from "next";
import { ContactForm } from "@/components/records/contact-form";
import { DeleteControl } from "@/components/records/delete-control";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { loadContactToEdit } from "../_data-access/contact";
import { deleteContactAction, updateContactAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({ params }: PageProps<"/contacts/[contactId]/edit">) {
  const { contactId } = await params;
  const { role, contact } = await loadContactToEdit(contactId);

  return (
    <RecordPage title="Edit contact" canWrite={canWriteRecords(role)}>
      <ContactForm
        initial={{ name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "" }}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-contact", { customerId: contact.customerId })}
        action={updateContactAction.bind(null, contactId)}
      />
      <DeleteControl label="Delete contact" name={contact.name} action={deleteContactAction.bind(null, contactId)} />
    </RecordPage>
  );
}
