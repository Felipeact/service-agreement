import { describe, expect, test } from "vitest";
import { cardLine, canChangeBilling, isEnded, dateLine, invoiceRows, statusLabel, type BillingOverview, type InvoiceSummary } from "./overview";

/** Noon in Vancouver on the given day, as unix seconds (UTC-8 in winter, so 20:00 UTC). */
const noon = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day, 20) / 1000;

const base: BillingOverview = { status: "active", trialEnd: null, periodEnd: noon(2026, 12, 10), endsAt: null, plan: "team", extraSeats: 0, card: null, invoices: [] };

describe("the status label", () => {
  test.each([
    ["trialing", "Trial"],
    ["active", "Active"],
    ["past_due", "Payment overdue"],
    ["unpaid", "Unpaid"],
    ["canceled", "Canceled"],
    ["incomplete", "Incomplete"],
    ["incomplete_expired", "Expired"],
    ["paused", "Paused"],
    ["something_new", "Unknown"],
  ])("C3100: %s is labelled %s", (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });
});

describe("the date line", () => {
  test("C3101: a trial not ending says when the trial ends", () => {
    expect(dateLine({ ...base, status: "trialing", trialEnd: noon(2026, 11, 24), periodEnd: noon(2026, 11, 24) })).toBe("Trial ends Nov 24, 2026");
  });

  test("C3101: an active subscription not ending says when it renews", () => {
    expect(dateLine(base)).toBe("Renews Dec 10, 2026");
  });

  test.each(["active", "trialing"])("C3101: a %s subscription set to end says when it ends, whatever else it holds", (status) => {
    expect(dateLine({ ...base, status, trialEnd: noon(2026, 11, 24), endsAt: noon(2026, 12, 10) })).toBe("Ends Dec 10, 2026");
  });

  test("C3101: the day is the Vancouver day, not the UTC one (late evening UTC is still the same day in Vancouver)", () => {
    // 2026-12-11 03:00 UTC is 2026-12-10 19:00 in Vancouver.
    expect(dateLine({ ...base, periodEnd: Date.UTC(2026, 11, 11, 3) / 1000 })).toBe("Renews Dec 10, 2026");
  });
});

describe("the card line", () => {
  test("C3102: brand capitalised, last four, month padded", () => {
    expect(cardLine({ brand: "visa", last4: "4242", expMonth: 4, expYear: 2030 })).toBe("Visa ending 4242, expires 04/2030");
    expect(cardLine({ brand: "mastercard", last4: "0005", expMonth: 12, expYear: 2031 })).toBe("Mastercard ending 0005, expires 12/2031");
  });

  test("C3102: no card reads No payment method", () => {
    expect(cardLine(null)).toBe("No payment method");
  });
});

const invoice = (over: Partial<InvoiceSummary> & { id: string; created: number }): InvoiceSummary => ({
  number: "INV-1",
  total: 9900,
  currency: "cad",
  status: "paid",
  hostedUrl: "https://invoice.stripe.com/i/x",
  ...over,
});

describe("the invoice rows", () => {
  test("C3103: a row shows number, day, amount in its own currency, status and a View url", () => {
    const rows = invoiceRows([invoice({ id: "in_1", created: noon(2026, 11, 10), number: "INV-0007" })]);
    expect(rows).toEqual([{ id: "in_1", number: "INV-0007", day: "Nov 10, 2026", amount: "$99.00", status: "paid", url: "https://invoice.stripe.com/i/x" }]);
  });

  test("C3103: a url that is not https has no View link", () => {
    const [row] = invoiceRows([invoice({ id: "in_1", created: noon(2026, 11, 10), hostedUrl: "http://invoice.stripe.com/i/x" })]);
    expect(row.url).toBeNull();
    const [none] = invoiceRows([invoice({ id: "in_2", created: noon(2026, 11, 10), hostedUrl: null })]);
    expect(none.url).toBeNull();
    const [script] = invoiceRows([invoice({ id: "in_3", created: noon(2026, 11, 10), hostedUrl: "javascript:alert(1)" })]);
    expect(script.url).toBeNull();
  });

  test("C3103: newest first and at most 12", () => {
    const many = Array.from({ length: 15 }, (_, index) => invoice({ id: `in_${index}`, created: noon(2026, 1, 1) + index * 86_400 }));
    const rows = invoiceRows([...many].reverse());
    expect(rows).toHaveLength(12);
    expect(rows[0].id).toBe("in_14");
    expect(rows[11].id).toBe("in_3");
  });

  test("C3103: an invoice with no number shows a dash", () => {
    expect(invoiceRows([invoice({ id: "in_1", created: noon(2026, 11, 10), number: null })])[0].number).toBe("—");
  });

  test("C3103: no invoices is an empty list", () => {
    expect(invoiceRows([])).toEqual([]);
  });
});

describe("the actions gate", () => {
  test.each([
    ["trialing", true],
    ["active", true],
    ["past_due", true],
    ["unpaid", false],
    ["canceled", false],
    ["incomplete", true],
    ["incomplete_expired", false],
    ["paused", true],
    ["something_new", true],
  ])("C3104: %s allows actions: %s", (status, allowed) => {
    expect(canChangeBilling(status)).toBe(allowed);
  });
});

describe("an ended plan freezes the workspace", () => {
  test.each([
    ["canceled", true],
    ["unpaid", true],
    ["incomplete_expired", true],
    ["active", false],
    ["trialing", false],
    ["past_due", false],
  ])("%s is ended: %s, and billing changes are allowed only when it is not", (status, ended) => {
    expect(isEnded(status)).toBe(ended);
    expect(canChangeBilling(status)).toBe(!ended);
  });
});
