import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** What the edit contact page reads: the contact. Signed out goes to /login; a missing or foreign id is a 404. */
export async function loadContactToEdit(contactId: string) {
  const { currentMember, contactForEdit } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const contact = await contactForEdit(contactId);
  if (!contact) notFound();
  return { role: member.role, contact };
}
