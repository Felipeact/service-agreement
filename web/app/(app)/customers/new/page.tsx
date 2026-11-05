import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerForm } from "@/components/records/customer-form";
import { RecordPage } from "@/components/records/record-form";
import { cancelHrefFor, canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { createCustomerAction } from "../../record-actions";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const { currentMember } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  return (
    <RecordPage title="New customer" canWrite={canWriteRecords(member.role)}>
      <CustomerForm initial={{ name: "" }} submitLabel="Add customer" cancelHref={cancelHrefFor("new-customer")} action={createCustomerAction} />
    </RecordPage>
  );
}
