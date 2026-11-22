import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** What the customer page reads: the member's role and the customer with its contacts, sites and agreements. Signed out goes to /login; a missing or foreign id is a 404. */
export async function loadCustomer(customerId: string) {
  const { currentMember, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const customer = await customerDetail(customerId);
  if (!customer) notFound();
  return { role: member.role, customer };
}
