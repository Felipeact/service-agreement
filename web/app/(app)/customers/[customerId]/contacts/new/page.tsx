import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContactForm } from "@/components/records/contact-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { createContactAction } from "../../../../record-actions";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({ params }: PageProps<"/customers/[customerId]/contacts/new">) {
  const { customerId } = await params;
  const { currentMember, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!(await customerDetail(customerId))) notFound();

  return (
    <RecordPage title="New contact" canWrite={canWriteRecords(member.role)}>
      <ContactForm
        initial={{ name: "", email: "", phone: "" }}
        submitLabel="Add contact"
        cancelHref={cancelHrefFor("new-contact", { customerId })}
        action={createContactAction.bind(null, customerId)}
      />
    </RecordPage>
  );
}
