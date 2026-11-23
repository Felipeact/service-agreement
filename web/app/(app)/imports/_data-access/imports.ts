import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import type { ImportFilter } from "@/domain/imports";

/**
 * What the Imports page reads: the member's role and item words, the import jobs the filter asks for, and every site for the
 * site filter, inactive ones included (their jobs stay listed). Signed out goes to /login.
 */
export async function loadImports(filter: ImportFilter) {
  const { currentMember, listImportHistory, listSites, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [rows, sites, words] = await Promise.all([listImportHistory(filter), listSites({ showInactive: true }), getItemWords(member.orgId)]);
  return { role: member.role, rows, sites: sites.map((site) => ({ id: site.id, name: site.name, customer: site.customer })), words };
}
