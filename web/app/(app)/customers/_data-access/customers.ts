import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** What the Customers page reads: the signed-in member's role and the customers RLS lets them see. Signed out goes to /login. */
export async function loadCustomers() {
  const { currentMember, listCustomers } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  return { role: member.role, customers: await listCustomers() };
}
