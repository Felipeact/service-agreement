import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { matchesStage, statusCounts, type AgreementFilter } from "@/domain/agreement";
import { today } from "@/lib/business-day";

/**
 * What the Agreements page reads: the member's role, the rows the filter asks for, and each status tab's count under the
 * same site and expiring filters, whichever tab is open. Signed out goes to /login.
 */
export async function loadAgreements(filter: AgreementFilter) {
  const { currentMember, listAgreements, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const now = clock.now();
  const day = today(now);
  // One read under the site and expiring filters; the open tab's rows and every tab's count come from it.
  const scoped = await listAgreements({ ...(filter.siteId && { siteId: filter.siteId }), ...(filter.expiring && { expiring: true }) }, day);
  const { status } = filter;
  const rows = status ? scoped.filter((row) => matchesStage(status, row.status, row.stage)) : scoped;
  return { role: member.role, rows, counts: statusCounts(scoped), now };
}
