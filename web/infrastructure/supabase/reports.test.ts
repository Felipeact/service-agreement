import { afterEach, describe, expect, test, vi } from "vitest";
import { supabaseReportReader } from "./reports";
import { stubClient, type Reply } from "./stub-client";

afterEach(() => vi.restoreAllMocks());

const RANGE = { from: "2027-01-01", to: "2027-03-31" };
const ARGS = { p_from: "2027-01-01", p_to: "2027-03-31" };

function readerWith(reply: Reply) {
  const stub = stubClient({});
  stub.client.rpc.mockResolvedValue(reply);
  return { ...stub, reader: supabaseReportReader(stub.typed) };
}

describe("the report adapter (reporting door 3)", () => {
  test("C5731: the headline row is read with the range and mapped", async () => {
    const { reader, client } = readerWith({
      data: [{ recurring_cents: 119999, pipeline_cents: 239998, accepted_n: 1, refused_n: 2, expired_n: 3, signed_n: 4, avg_days_to_sign: 4.5 }],
      error: null,
    });
    expect(await reader.headline(RANGE)).toEqual({
      ok: true,
      value: { recurringCents: 119999, pipelineCents: 239998, accepted: 1, refused: 2, expired: 3, signed: 4, avgDaysToSign: 4.5 },
    });
    expect(client.rpc).toHaveBeenCalledWith("report_headline", ARGS);
  });

  test("C5731: a null average stays null", async () => {
    const { reader } = readerWith({
      data: [{ recurring_cents: 0, pipeline_cents: 0, accepted_n: 0, refused_n: 0, expired_n: 0, signed_n: 0, avg_days_to_sign: null }],
      error: null,
    });
    expect(await reader.headline(RANGE)).toMatchObject({ ok: true, value: { avgDaysToSign: null } });
  });

  test("C5731: the funnel rows keep their order and a null value", async () => {
    const { reader, client } = readerWith({
      data: [
        { stage: "created", ord: 1, n: 4, value_cents: null },
        { stage: "sent", ord: 2, n: 2, value_cents: null },
      ],
      error: null,
    });
    expect(await reader.funnel(RANGE)).toEqual({
      ok: true,
      value: [
        { stage: "created", n: 4, valueCents: null },
        { stage: "sent", n: 2, valueCents: null },
      ],
    });
    expect(client.rpc).toHaveBeenCalledWith("report_funnel", ARGS);
  });

  test("C5731: aging splits the medians from the stuck agreements", async () => {
    const { reader, client } = readerWith({
      data: [
        { kind: "median", stage: "Created to sent", days: 28.5, agreement_id: null, number: null, customer_name: null, site_name: null, status: null },
        { kind: "stuck", stage: null, days: 9, agreement_id: "a1", number: "AG-1", customer_name: "Acme", site_name: "Plant", status: "sent" },
      ],
      error: null,
    });
    expect(await reader.aging(RANGE)).toEqual({
      ok: true,
      value: {
        medians: [{ stage: "Created to sent", days: 28.5 }],
        stuck: [{ agreementId: "a1", number: "AG-1", customer: "Acme", site: "Plant", status: "sent", ageDays: 9 }],
      },
    });
    expect(client.rpc).toHaveBeenCalledWith("report_aging", ARGS);
  });

  test("C5731: losses, renewals and both revenue reports are mapped, and the argument-less ones send no arguments", async () => {
    const loss = readerWith({
      data: [{ agreement_id: "a1", number: "AG-1", customer_name: "Acme", site_name: "Plant", outcome: "refused", reason: "Price", occurred: "2027-03-11", value_cents: 100 }],
      error: null,
    });
    expect(await loss.reader.losses(RANGE)).toEqual({
      ok: true,
      value: [{ agreementId: "a1", number: "AG-1", customer: "Acme", site: "Plant", outcome: "refused", reason: "Price", occurred: "2027-03-11", valueCents: 100 }],
    });
    expect(loss.client.rpc).toHaveBeenCalledWith("report_losses", ARGS);

    const renewal = readerWith({
      data: [{ agreement_id: "a2", number: "AG-2", customer_name: "Acme", site_name: "Plant", term_end: "2027-04-01", days_left: 30, bucket: 30, kind: "auto", value_cents: null }],
      error: null,
    });
    expect(await renewal.reader.renewals()).toEqual({
      ok: true,
      value: [{ agreementId: "a2", number: "AG-2", customer: "Acme", site: "Plant", termEnd: "2027-04-01", daysLeft: 30, bucket: 30, kind: "auto", valueCents: null }],
    });
    expect(renewal.client.rpc).toHaveBeenCalledWith("report_renewals");

    const customer = readerWith({ data: [{ customer_id: "c1", customer_name: "Acme", agreements: 2, value_cents: 239998 }], error: null });
    expect(await customer.reader.revenueByCustomer()).toEqual({ ok: true, value: [{ customerId: "c1", customer: "Acme", agreements: 2, valueCents: 239998 }] });
    expect(customer.client.rpc).toHaveBeenCalledWith("report_revenue_by_customer");

    const byType = readerWith({ data: [{ type_name: "Aaa Type", value_cents: 10000 }], error: null });
    expect(await byType.reader.revenueByType()).toEqual({ ok: true, value: [{ type: "Aaa Type", valueCents: 10000 }] });
    expect(byType.client.rpc).toHaveBeenCalledWith("report_revenue_by_type");
  });

  test("C5731: SQLSTATE 42501 is forbidden", async () => {
    const { reader } = readerWith({ data: null, error: { code: "42501", message: "reports are not available to this role" } });
    expect(await reader.headline(RANGE)).toEqual({ ok: false, code: "forbidden" });
    expect(await reader.renewals()).toEqual({ ok: false, code: "forbidden" });
  });

  test("C5731: any other error is unavailable, and only its code is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { reader } = readerWith({ data: null, error: { code: "57014", message: "canceling statement SECRET-DETAIL" } });
    expect(await reader.funnel(RANGE)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("57014"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET-DETAIL");
  });

  test("C5731: a thrown error is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stub = stubClient({});
    stub.client.rpc.mockRejectedValue(new Error("network down"));
    expect(await supabaseReportReader(stub.typed).aging(RANGE)).toEqual({ ok: false, code: "unavailable" });
  });

  test("C5731: a headline answer with no row is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { reader } = readerWith({ data: [], error: null });
    expect(await reader.headline(RANGE)).toEqual({ ok: false, code: "unavailable" });
  });
});
