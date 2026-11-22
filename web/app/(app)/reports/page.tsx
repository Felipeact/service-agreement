import type { Metadata } from "next";
import type { parseReportRange } from "@/domain/reports";
import { ReportsView } from "./_components/content";
import { loadReports } from "./_data-access/reports";

export const metadata: Metadata = { title: "Reports" };

type Params = Parameters<typeof parseReportRange>[0];

/** `?from=&to=` set the range; anything not a date gives the default 12 months and a notice (reporting AC 18). */
export async function ReportsForRequest({ params }: { params: Params }) {
  const reports = await loadReports(params);
  return <ReportsView {...reports} />;
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return <ReportsForRequest params={await searchParams} />;
}
