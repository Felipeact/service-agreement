import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportsView } from "@/components/reports/reports-view";
import { getContainer } from "@/composition";
import { parseReportRange, reportAccess } from "@/domain/reports";
import { today } from "@/lib/business-day";

export const metadata: Metadata = { title: "Reports" };

type Params = Parameters<typeof parseReportRange>[0];

/** `?from=&to=` set the range; anything not a date gives the default 12 months and a notice (reporting AC 18). */
export async function ReportsForRequest({ params }: { params: Params }) {
  const { currentMember, reports, listAgreements, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  // A frozen workspace keeps its owner's role for reports: they only read (reporting AC 17).
  const access = reportAccess(member.billingRole ?? member.role);
  if (access === "none") redirect("/pipeline");

  const now = today(clock.now());
  const { range, notice } = parseReportRange(params, now);
  const money = access === "money";
  // One section failing never takes the others down: each read answers on its own (AC 19).
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
  return (
    <ReportsView
      range={range}
      notice={notice}
      empty={agreements !== null && agreements.length === 0}
      headline={headline}
      funnel={funnel}
      aging={aging}
      losses={losses}
      renewals={renewals}
      revenueByCustomer={revenueByCustomer}
      revenueByType={revenueByType}
    />
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return <ReportsForRequest params={await searchParams} />;
}
