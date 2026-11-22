import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** The signed-in member's role. Signed out goes to /login. */
export async function loadMemberRole() {
  const { currentMember } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  return member.role;
}

/** What the Customers page reads: the signed-in member's role and the customers RLS lets them see. Signed out goes to /login. */
export async function loadCustomers() {
  const { listCustomers } = await getContainer();
  const role = await loadMemberRole();
  return { role, customers: await listCustomers() };
}
