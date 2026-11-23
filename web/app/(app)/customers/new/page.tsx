import type { Metadata } from "next";
import { CustomerForm } from "@/components/records/customer-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { loadMemberRole } from "../_data-access/customers";
import { createCustomerAction } from "../../record-actions";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const role = await loadMemberRole();

  return (
    <RecordPage title="New customer" back={{ href: "/customers", label: "Customers" }} canWrite={canWriteRecords(role)}>
      <CustomerForm initial={{ name: "" }} submitLabel="Add customer" cancelHref={cancelHrefFor("new-customer")} action={createCustomerAction} />
    </RecordPage>
  );
}
