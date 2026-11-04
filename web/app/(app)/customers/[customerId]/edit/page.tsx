import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeactivateControl, ReactivateControl } from "@/components/records/active-control";
import { CustomerForm } from "@/components/records/customer-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { deactivateCustomerAction, reactivateCustomerAction, updateCustomerAction } from "../../../record-actions";

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
        initial={{ name: customer.name, billingContactId: customer.billingContactId ?? "" }}
        contacts={customer.contacts}
        submitLabel="Save changes"
        cancelHref={cancelHrefFor("edit-customer", { customerId })}
        action={updateCustomerAction.bind(null, customerId)}
      />
      {customer.active ? (
        <DeactivateControl kind="customer" name={customer.name} action={deactivateCustomerAction.bind(null, customerId)} />
      ) : (
        <ReactivateControl kind="customer" action={reactivateCustomerAction.bind(null, customerId)} />
      )}
    </RecordPage>
  );
}
