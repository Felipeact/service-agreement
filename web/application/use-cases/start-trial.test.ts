import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CheckoutStarter, WorkspaceEmailCheck } from "@/application/ports";
import { makeStartTrial } from "./start-trial";

const start = vi.fn<CheckoutStarter["start"]>();
const startTrial = makeStartTrial({ start });
const URL_OK = "https://checkout.example.com/c/pay_1";
/** Valid contact details; 10 seats are valid for every plan. */
const DETAILS = { seats: "10", email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };
const NORMAL = { seats: 10, email: "owner@shop.ca", company: "Shop Ltd", phone: "604-555-0199" };

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  start.mockResolvedValue({ ok: true, url: URL_OK });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
});

const file = () => new File(["x"], "x.txt");

describe("startTrial hands a valid selection to the starter", () => {
  test.each([
    { name: "shuffled and repeated", plan: "team", trades: ["other", "hvac", "hvac", "plumbing"], expected: ["hvac", "plumbing", "other"] },
    { name: "one trade", plan: "starter", trades: ["plumbing"], expected: ["plumbing"] },
    { name: "all four", plan: "business", trades: ["other", "electrical", "plumbing", "hvac"], expected: ["hvac", "plumbing", "electrical", "other"] },
    { name: "five values with repeats", plan: "team", trades: ["other", "other", "other", "hvac", "hvac"], expected: ["hvac", "other"] },
    { name: "already ordered", plan: "starter", trades: ["hvac", "electrical"], expected: ["hvac", "electrical"] },
  ])("C2414: $name reaches the starter once, de-duplicated and in order", async ({ plan, trades, expected }) => {
    await startTrial({ plan, trades, ...DETAILS });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith({ plan, trades: expected, ...NORMAL });
  });

  test("C2415: an ok answer with an https url is a redirect carrying that url, and the starter was called once", async () => {
    expect(await startTrial({ plan: "team", trades: ["hvac"], ...DETAILS })).toEqual({ status: "redirect", url: URL_OK });
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe("startTrial refuses without calling the starter", () => {
  test("C2416: a valid plan with no trade is no_trade", async () => {
    expect(await startTrial({ plan: "team", trades: [], ...DETAILS })).toEqual({ status: "no_trade", fields: {} });
    expect(start).not.toHaveBeenCalled();
  });

  test.each([
    { name: "plan missing", plan: null, trades: ["hvac"] },
    { name: "plan enterprise", plan: "enterprise", trades: ["hvac"] },
    { name: "plan Team in the wrong case", plan: "Team", trades: ["hvac"] },
    { name: "plan as a File", plan: file(), trades: ["hvac"] },
    { name: "trade fire", plan: "team", trades: ["fire"] },
    { name: "trade empty", plan: "team", trades: [""] },
    { name: "trade HVAC in the wrong case", plan: "team", trades: ["HVAC"] },
    { name: "a valid trade beside an unknown one", plan: "team", trades: ["hvac", "fire"] },
    { name: "trade as a File", plan: "team", trades: [file()] },
  ])("C2417: $name is invalid_choice", async ({ plan, trades }) => {
    expect(await startTrial({ plan, trades, ...DETAILS })).toEqual({ status: "invalid_choice", fields: {} });
    expect(start).not.toHaveBeenCalled();
  });

  test("C2417: a bad plan with no trades is invalid_choice, not no_trade", async () => {
    expect(await startTrial({ plan: "enterprise", trades: [], ...DETAILS })).toEqual({ status: "invalid_choice", fields: {} });
  });
});

describe("startTrial answers the starter's refusals", () => {
  test("C2418: not_configured is the not_configured outcome", async () => {
    start.mockResolvedValue({ ok: false, code: "not_configured" });
    expect(await startTrial({ plan: "team", trades: ["hvac"], ...DETAILS })).toEqual({ status: "not_configured" });
  });

  const URL_PATH = "pay_secret_42";
  type Case = { name: string; arrange: () => void };
  const FAILURES: Case[] = [
    { name: "the starter answers unavailable", arrange: () => start.mockResolvedValue({ ok: false, code: "unavailable" }) },
    { name: "the starter throws", arrange: () => start.mockRejectedValue(new Error(`boom for https://checkout.example.com/${URL_PATH}`)) },
    { name: "an http url", arrange: () => start.mockResolvedValue({ ok: true, url: `http://checkout.example.com/${URL_PATH}` }) },
    { name: "a javascript url", arrange: () => start.mockResolvedValue({ ok: true, url: `javascript:alert('${URL_PATH}')` }) },
    { name: "a protocol-relative url", arrange: () => start.mockResolvedValue({ ok: true, url: `//evil.example/${URL_PATH}` }) },
    { name: "an empty url", arrange: () => start.mockResolvedValue({ ok: true, url: "" }) },
    { name: "text that is not a url", arrange: () => start.mockResolvedValue({ ok: true, url: "not a url" }) },
  ];

  test.each(FAILURES)("C2419: $name is unavailable, logged once, with no selection or url in the log", async ({ arrange }) => {
    arrange();
    expect(await startTrial({ plan: "business", trades: ["electrical"], ...DETAILS })).toEqual({ status: "unavailable" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(errorSpy.mock.calls);
    for (const secret of ["business", "electrical", URL_PATH, "checkout.example.com", "evil.example"]) expect(logged).not.toContain(secret);
  });
});

describe("startTrial and the contact fields", () => {
  test("C2604: the starter gets the email trimmed and lowercased, the company and phone trimmed with inner whitespace collapsed", async () => {
    await startTrial({ plan: "team", trades: ["hvac"], seats: "7", email: "  Owner@Shop.CA ", company: "  A   B  Co ", phone: "  +1  604   555 0199 " });
    expect(start).toHaveBeenCalledWith({ plan: "team", trades: ["hvac"], seats: 7, email: "owner@shop.ca", company: "A B Co", phone: "+1 604 555 0199" });
  });

  test.each([
    { name: "email", input: { email: "nope" }, fields: { email: true } },
    { name: "company", input: { company: "  " }, fields: { company: true } },
    { name: "phone", input: { phone: "12" }, fields: { phone: true } },
    { name: "seats", input: { seats: "1" }, fields: { seats: true } },
    { name: "email and phone together", input: { email: "", phone: "abc" }, fields: { email: true, phone: true } },
  ])("C2605: an invalid $name never reaches the starter and names every failed field", async ({ input, fields }) => {
    const outcome = await startTrial({ plan: "starter", trades: ["hvac"], ...DETAILS, seats: "2", ...input });
    expect(outcome).toEqual({ status: "invalid_details", fields });
    expect(start).not.toHaveBeenCalled();
  });

  test("C2605: a missing trade and a bad email are reported together", async () => {
    expect(await startTrial({ plan: "team", trades: [], ...DETAILS, email: "x" })).toEqual({ status: "no_trade", fields: { email: true } });
    expect(start).not.toHaveBeenCalled();
  });

  test.each([
    { name: "the starter answers unavailable", arrange: () => start.mockResolvedValue({ ok: false, code: "unavailable" }) },
    { name: "the starter throws", arrange: () => start.mockRejectedValue(new Error("boom")) },
  ])("C2607: when $name the log carries no email, company or phone", async ({ arrange }) => {
    arrange();
    await startTrial({ plan: "team", trades: ["hvac"], seats: "6", email: "secret.owner@shop.ca", company: "Secret Plumbing Ltd", phone: "604-555-0188" });
    await startTrial({ plan: "team", trades: ["hvac"], seats: "6", email: "bad", company: "Secret Plumbing Ltd", phone: "604-555-0188" });
    const logged = JSON.stringify(errorSpy.mock.calls);
    for (const secret of ["secret.owner", "shop.ca", "Secret Plumbing", "604-555-0188"]) expect(logged).not.toContain(secret);
  });
});

describe("startTrial asks whether the email already belongs to an org (checkout-email-in-use)", () => {
  const inUse = vi.fn<WorkspaceEmailCheck["inUse"]>();
  const companyInUse = vi.fn<WorkspaceEmailCheck["companyInUse"]>().mockResolvedValue(false);
  const checked = makeStartTrial({ start }, { inUse, companyInUse });
  const SELECTION = { plan: "team", trades: ["hvac"], ...DETAILS };

  beforeEach(() => {
    inUse.mockResolvedValue(false);
    companyInUse.mockResolvedValue(false);
  });

  test("a company name that already has a workspace is company_in_use and the starter is never called", async () => {
    companyInUse.mockResolvedValue(true);
    expect(await checked(SELECTION)).toEqual({ status: "company_in_use" });
    expect(start).not.toHaveBeenCalled();
  });

  test("C4300: a taken email is email_in_use and the starter is never called", async () => {
    inUse.mockResolvedValue(true);
    expect(await checked(SELECTION)).toEqual({ status: "email_in_use" });
    expect(start).not.toHaveBeenCalled();
  });

  test("C4301: a free email reaches the starter once and returns its redirect, after one check", async () => {
    expect(await checked(SELECTION)).toEqual({ status: "redirect", url: URL_OK });
    expect(inUse).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("C4305: the check is asked about the lower-cased, trimmed email", async () => {
    await checked({ ...SELECTION, email: "  Owner@Shop.CA " });
    expect(inUse).toHaveBeenCalledWith("owner@shop.ca");
  });

  test.each([
    { name: "no_trade", input: { plan: "team", trades: [], ...DETAILS }, expected: { status: "no_trade", fields: {} } },
    { name: "invalid_choice", input: { plan: "enterprise", trades: ["hvac"], ...DETAILS }, expected: { status: "invalid_choice", fields: {} } },
    { name: "invalid_details", input: { plan: "team", trades: ["hvac"], ...DETAILS, email: "not-an-email" }, expected: { status: "invalid_details", fields: { email: true } } },
  ])("C4306: $name answers as before and the email check is never called", async ({ input, expected }) => {
    expect(await checked(input)).toEqual(expected);
    expect(inUse).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  test.each([
    { name: "an Error", thrown: new Error("owner@shop.ca is in row 42") },
    { name: "a non-error", thrown: "owner@shop.ca" },
  ])("C4307: $name from the check is unavailable, the starter is never called and the log holds no email", async ({ thrown }) => {
    inUse.mockRejectedValue(thrown);
    expect(await checked(SELECTION)).toEqual({ status: "unavailable" });
    expect(start).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toMatch(/owner@shop\.ca|row 42/);
  });
});
