import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/customers/[customerId]">) {
  const { customerId } = await params;
  const { customerDetail } = await getContainer();
  const customer = await customerDetail(customerId);
  if (!customer) notFound();
  return <CustomerDetailView customer={customer} />;
}
