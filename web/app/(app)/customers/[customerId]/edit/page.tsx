import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CustomerForm } from "@/components/records/customer-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { updateCustomerAction } from "../../../record-actions";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[customerId]/edit">) {
  const { customerId } = await params;
  const { currentMember, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const customer = await customerDetail(customerId);
  if (!customer) notFound();

  return (
    <RecordPage title="Edit customer" canWrite={canWriteRecords(member.role)}>
      <CustomerForm
        initial={{ name: customer.name }}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-customer", { customerId })}
        action={updateCustomerAction.bind(null, customerId)}
      />
    </RecordPage>
  );
}
