import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

/**
 * What the Search page reads: the groups of records matching the query, and the org's item words. A blank query reads nothing
 * (global-search Surface, AC 15). Signed out goes to /login.
 */
export async function loadSearch(query: string) {
  const { currentMember, searchRecords, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [results, words] = await Promise.all([query ? searchRecords(query) : null, getItemWords(member.orgId)]);
  return { results, words };
}
