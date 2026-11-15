import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ReportReader, ReportResult } from "@/application/ports";
import type { Aging, CustomerRevenue, FunnelRow, FunnelStage, Headline, LossRow, RenewalRow, TypeRevenue } from "@/domain/reports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;
type Reply<T> = { data: T | null; error: PostgrestError | null };

const num = (value: number | string | null) => (value === null ? null : Number(value));

/**
 * Runs one report function as the signed-in member (reporting door 1). 42501 is the role being refused; anything else is
 * `unavailable`, logged by its code only, so the page can show that section's error line and render the rest (AC 19).
 */
async function read<T, R>(what: string, run: () => PromiseLike<Reply<T[]>>, map: (rows: T[]) => R | null): Promise<ReportResult<R>> {
  try {
    const { data, error } = await run();
    if (error) {
      if (error.code === "42501") return { ok: false, code: "forbidden" };
      console.error(`Reading the ${what} report failed: ${error.code}`);
      return { ok: false, code: "unavailable" };
    }
    const value = map(data ?? []);
    if (value === null) {
      console.error(`Reading the ${what} report failed: the answer was not a row`);
      return { ok: false, code: "unavailable" };
    }
    return { ok: true, value };
  } catch (cause) {
    console.error(`Reading the ${what} report failed: ${cause instanceof Error ? cause.name : "a non-error"}`);
    return { ok: false, code: "unavailable" };
  }
}

/** The reports of the member's own org, from the `report_*` functions. Money is null for an estimator because the database says so. */
export function supabaseReportReader(client: Client): ReportReader {
  return {
    headline: ({ from, to }) =>
      read<Database["public"]["Functions"]["report_headline"]["Returns"][number], Headline>(
        "headline",
        () => client.rpc("report_headline", { p_from: from, p_to: to }),
        ([row]) =>
          row
            ? {
                recurringCents: Number(row.recurring_cents),
                pipelineCents: Number(row.pipeline_cents),
                accepted: Number(row.accepted_n),
                refused: Number(row.refused_n),
                expired: Number(row.expired_n),
                signed: Number(row.signed_n),
                avgDaysToSign: num(row.avg_days_to_sign),
              }
            : null,
      ),
    funnel: ({ from, to }) =>
      read("funnel", () => client.rpc("report_funnel", { p_from: from, p_to: to }), (rows): FunnelRow[] =>
        rows.map((row) => ({ stage: row.stage as FunnelStage, n: Number(row.n), valueCents: num(row.value_cents) })),
      ),
    aging: ({ from, to }) =>
      read("aging", () => client.rpc("report_aging", { p_from: from, p_to: to }), (rows): Aging => ({
        medians: rows.filter((row) => row.kind === "median").map((row) => ({ stage: row.stage ?? "", days: num(row.days) })),
        stuck: rows
          .filter((row) => row.kind === "stuck")
          .map((row) => ({
            agreementId: row.agreement_id ?? "",
            number: row.number ?? "",
            customer: row.customer_name ?? "",
            site: row.site_name ?? "",
            status: row.status ?? "",
            ageDays: Number(row.days),
          })),
      }),
    ),
    losses: ({ from, to }) =>
      read("losses", () => client.rpc("report_losses", { p_from: from, p_to: to }), (rows): LossRow[] =>
        rows.map((row) => ({
          agreementId: row.agreement_id,
          number: row.number ?? "",
          customer: row.customer_name,
          site: row.site_name,
          outcome: row.outcome as LossRow["outcome"],
          reason: row.reason,
          occurred: row.occurred,
          valueCents: num(row.value_cents),
        })),
      ),
    renewals: () =>
      read("renewals", () => client.rpc("report_renewals"), (rows): RenewalRow[] =>
        rows.map((row) => ({
          agreementId: row.agreement_id,
          number: row.number ?? "",
          customer: row.customer_name,
          site: row.site_name,
          termEnd: row.term_end,
          daysLeft: Number(row.days_left),
          bucket: Number(row.bucket) as RenewalRow["bucket"],
          kind: row.kind as RenewalRow["kind"],
          valueCents: num(row.value_cents),
        })),
      ),
    revenueByCustomer: () =>
      read("revenue by customer", () => client.rpc("report_revenue_by_customer"), (rows): CustomerRevenue[] =>
        rows.map((row) => ({ customerId: row.customer_id, customer: row.customer_name, agreements: Number(row.agreements), valueCents: Number(row.value_cents) })),
      ),
    revenueByType: () =>
      read("revenue by type", () => client.rpc("report_revenue_by_type"), (rows): TypeRevenue[] =>
        rows.map((row) => ({ type: row.type_name, valueCents: Number(row.value_cents) })),
      ),
  };
}
