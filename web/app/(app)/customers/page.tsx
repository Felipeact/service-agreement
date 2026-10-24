import type { Metadata } from "next";
import { CustomersView } from "@/components/customers/customers-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { listCustomers } = await getContainer();
  return <CustomersView customers={await listCustomers()} />;
}
