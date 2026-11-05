import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomersView } from "@/components/customers/customers-view";
import { getContainer } from "@/composition";
import { showInactive } from "@/domain/records";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { currentMember, listCustomers } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  return <CustomersView customers={await listCustomers()} role={member.role} showInactive={showInactive(await searchParams)} />;
}
