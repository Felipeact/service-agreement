import type { Metadata } from "next";
import { showInactive } from "@/domain/records";
import { CustomerDetailView } from "./_components/content";
import { loadCustomer } from "./_data-access/customer";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[customerId]">) {
  const { customerId } = await params;
  const { role, customer } = await loadCustomer(customerId);
  return <CustomerDetailView customer={customer} role={role} showInactive={showInactive(await searchParams)} />;
}
