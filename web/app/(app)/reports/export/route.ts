import { makeReportExport } from "@/application/use-cases/report-export";
import { getContainer } from "@/composition";
import { isIsoDate, isReportKey, MONEY_REPORT_KEYS, parseReportRange, reportAccess } from "@/domain/reports";
import { today } from "@/lib/business-day";

const refuse = (status: number, message: string) => Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * `GET /reports/export?report=<key>&from=&to=` returns one report as CSV (reporting Surface). Signed out is 401, a viewer or an
 * estimator asking a money report is 403, an unknown report or a bad date is 400, and a report the database could not read is 503.
 */
export async function GET(request: Request): Promise<Response> {
  const { currentMember, reports, clock } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") return refuse(401, "Sign in to download a report.");
  if (member.status !== "member") return refuse(403, "No workspace.");

  // A frozen workspace keeps its owner's role for reports: they only read (reporting AC 17).
  const access = reportAccess(member.billingRole ?? member.role);
  if (access === "none") return refuse(403, "Your role cannot download reports.");

  const params = new URL(request.url).searchParams;
  const key = params.get("report") ?? "";
  if (!isReportKey(key)) return refuse(400, "Unknown report.");
  if (MONEY_REPORT_KEYS.includes(key) && access !== "money") return refuse(403, "Your role cannot download this report.");

  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  if ((from !== undefined && !isIsoDate(from)) || (to !== undefined && !isIsoDate(to)) || (from !== undefined && to !== undefined && from > to)) {
    return refuse(400, "Dates must be YYYY-MM-DD, with the start on or before the end.");
  }
  const { range } = parseReportRange({ from, to }, today(clock.now()));

  const result = await makeReportExport(reports)(key, range, access);
  if (!result.ok) return result.code === "forbidden" ? refuse(403, "Your role cannot download this report.") : refuse(503, "The report could not be read. Try again.");
  return new Response(result.value.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.value.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
