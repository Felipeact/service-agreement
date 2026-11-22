import { agreementsCsv } from "@/application/use-cases/agreement-export";
import { getContainer } from "@/composition";
import { parseAgreementFilter } from "@/domain/agreement";
import { today } from "@/lib/business-day";

const refuse = (status: number, message: string) => Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * `GET /agreements/export?status=&site=&expiring=1` returns the Agreements list as CSV, with the filters the page was opened with.
 * Signed out is 401 and a signed-in user without a workspace is 403; any member who can read the list can download it.
 */
export async function GET(request: Request): Promise<Response> {
  const { currentMember, listAgreements, clock } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") return refuse(401, "Sign in to download agreements.");
  if (member.status !== "member") return refuse(403, "No workspace.");

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = parseAgreementFilter(params);
  const day = today(clock.now());
  const file = agreementsCsv(await listAgreements(filter, day), filter, day);
  return new Response(file.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
