import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { STATUS_FILTER_VALUES, type AgreementFilter } from "@/domain/agreement";
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
  const rows = await listAgreements(filter, day);
  const scope = { ...(filter.siteId && { siteId: filter.siteId }), ...(filter.expiring && { expiring: true }) };
  const counted = await Promise.all(STATUS_FILTER_VALUES.map(async (status) => [status, (await listAgreements({ ...scope, status }, day)).length] as const));
  const all = filter.status ? (await listAgreements(scope, day)).length : rows.length;
  return { role: member.role, rows, counts: { all, ...Object.fromEntries(counted) }, now };
}
