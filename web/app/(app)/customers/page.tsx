import type { Metadata } from "next";
import { showInactive } from "@/domain/records";
import { CustomersView } from "./_components/content";
import { loadCustomers } from "./_data-access/customers";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { role, customers } = await loadCustomers();
  return <CustomersView customers={customers} role={role} showInactive={showInactive(await searchParams)} />;
}
