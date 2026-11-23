import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { parseReportRange, reportAccess, type ReportRange } from "@/domain/reports";
import { today } from "@/lib/business-day";

type Params = Parameters<typeof parseReportRange>[0];

/**
 * What the Reports page reads for a range. Signed out goes to /login and a role with no access goes back to the Pipeline. A frozen
 * workspace keeps its owner's role for reports: they only read (reporting AC 17). The money sections are read only for a member
 * who may see money. One section failing never takes the others down: each read answers on its own (AC 19).
 */
export async function loadReports(params: Params) {
  const { currentMember, reports, listAgreements, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const access = reportAccess(member.billingRole ?? member.role);
  if (access === "none") redirect("/pipeline");

  const now = today(clock.now());
  const { range, notice }: { range: ReportRange; notice: string | null } = parseReportRange(params, now);
  const money = access === "money";
  const [headline, funnel, aging, losses, renewals, revenueByCustomer, revenueByType, agreements] = await Promise.all([
    money ? reports.headline(range) : null,
    reports.funnel(range),
    reports.aging(range),
    reports.losses(range),
    reports.renewals(),
    money ? reports.revenueByCustomer() : null,
    money ? reports.revenueByType() : null,
    listAgreements({}, now).catch(() => null),
  ]);
  return { range, notice, headline, funnel, aging, losses, renewals, revenueByCustomer, revenueByType, empty: agreements !== null && agreements.length === 0 };
}
