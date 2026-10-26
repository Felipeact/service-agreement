import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/customers/[customerId]">) {
  const { customerId } = await params;
  const { currentMember, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const customer = await customerDetail(customerId);
  if (!customer) notFound();
  return <CustomerDetailView customer={customer} role={member.role} />;
}
