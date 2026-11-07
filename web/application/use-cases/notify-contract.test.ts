import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AutomationCallbacks, ClaimResult, EmailSender, NotificationMessage } from "@/application/ports";
import { makeNotify } from "./notify";

const BASE = "https://agreements.northwind.ca";
const EVENT = "22222222-2222-4222-8222-222222222222";
const tenant = { legalName: "Northwind Mechanical Ltd.", phone: "604-555-0100", accent: null };
const agreement = { id: "a1", number: "AG-1052" };
const site = { name: "Harbourview Towers" };
const callback = (kind: string, key: string) => ({
  body: JSON.stringify({ idempotencyKey: key, kind, eventId: EVENT, contractId: "con-1" }),
  timestamp: "1",
  signature: "sha256=x",
});

const claim = vi.fn<AutomationCallbacks["claim"]>();
const complete = vi.fn<AutomationCallbacks["complete"]>();
const send = vi.fn<EmailSender["send"]>();
const portal = { unseal: (sealed: string) => sealed.replace(/^portal:/, "") };
const signing = { unseal: (sealed: string) => (sealed.startsWith("signing:") ? sealed.slice("signing:".length) : (() => { throw new Error("cannot open"); })()) };
const notify = makeNotify({ claim, complete }, { send }, portal, BASE, signing);

const claimed = (result: ClaimResult) => claim.mockResolvedValue(result);
const PDF_SIGNED = Buffer.from("%PDF-1.7 signed bytes").toString("base64");
const PDF_AUDIT = Buffer.from("%PDF-1.7 audit bytes").toString("base64");

const linkMessage = (over: Partial<Extract<NotificationMessage, { kind: "customer_signing_link" }>> = {}): NotificationMessage => ({
  notificationId: "n1",
  kind: "customer_signing_link",
  to: ["pat@customer.ca"],
  tenant,
  agreement,
  site,
  signerName: "Pat Lee",
  linkSealed: "signing:tok-abc",
  ...over,
});

const copyMessage = (id: string, role: string, to: string): NotificationMessage => ({
  notificationId: id,
  kind: "contract_signed_copy",
  idempotencyKey: `w4:${EVENT}:copy:${role}`,
  to: [to],
  tenant,
  agreement,
  site,
  signerName: role,
  documents: [
    { kind: "audit_log", contentBase64: PDF_AUDIT },
    { kind: "signed", contentBase64: PDF_SIGNED },
  ],
});

const staffMessage = (): NotificationMessage => ({
  notificationId: "n3",
  kind: "staff_contract_signed",
  idempotencyKey: `w4:${EVENT}:staff`,
  to: ["owner@northwind.ca"],
  tenant,
  agreement,
  contract: { id: "con-1" },
  site,
  customer: { name: "Fernwood Dental" },
});

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ ok: true, providerMessageId: "re_1" });
  complete.mockResolvedValue();
});

describe("notify, contract kinds", () => {
  test("C1793: the link is opened with the signing tokens, the button is <base>/sign/<token>, the email is in the contractor's name and the answer is sent", async () => {
    const cb = callback("customer_signing_link", `w2:${EVENT}:link`);
    claimed({ ok: true, decision: "send", messages: [linkMessage()] });
    expect(await notify(cb)).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    const email = send.mock.calls[0][0];
    expect(email.fromName).toBe("Northwind Mechanical Ltd.");
    expect(email.to).toEqual(["pat@customer.ca"]);
    expect(email.idempotencyKey).toBe(`w2:${EVENT}:link`);
    expect(email.html).toContain(`href="${BASE}/sign/tok-abc"`);
    expect(email.attachments).toBeUndefined();
    expect(complete).toHaveBeenCalledWith(cb, [{ id: "n1", outcome: "sent", providerMessageId: "re_1" }]);
  });

  test("C1795: a link the signing key cannot open completes failed with 'could not build the email', answers unavailable, sends nothing and logs no sealed value", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    claimed({ ok: true, decision: "send", messages: [linkMessage({ linkSealed: "portal:sealed-secret-value" })] });
    expect(await notify(callback("customer_signing_link", `w2:${EVENT}:link`))).toEqual({ ok: false, code: "unavailable" });
    expect(send).not.toHaveBeenCalled();
    expect(complete.mock.calls[0][1]).toEqual([{ id: "n1", outcome: "failed", error: "could not build the email" }]);
    expect(JSON.stringify(log.mock.calls.map((args) => args.map(String)))).not.toContain("sealed-secret-value");
    log.mockRestore();
  });

  test("C1802: each party message carries both files named by the agreement number with the claim's bytes; the staff message carries none", async () => {
    claimed({ ok: true, decision: "send", messages: [copyMessage("n2", "customer", "pat@customer.ca"), copyMessage("n2", "contractor", "dana@northwind.ca"), staffMessage()] });
    expect(await notify(callback("contract_signed_copy", `w4:${EVENT}:copy`))).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(3);
    const [customer, contractor, staff] = send.mock.calls.map(([email]) => email);
    for (const email of [customer, contractor]) {
      expect(email.attachments).toEqual([
        { filename: "AG-1052-audit-log.pdf", contentBase64: PDF_AUDIT },
        { filename: "AG-1052-signed.pdf", contentBase64: PDF_SIGNED },
      ]);
    }
    expect([customer.idempotencyKey, contractor.idempotencyKey, staff.idempotencyKey]).toEqual([
      `w4:${EVENT}:copy:customer`,
      `w4:${EVENT}:copy:contractor`,
      `w4:${EVENT}:staff`,
    ]);
    expect(staff.attachments).toBeUndefined();
    expect(staff.html).toContain(`href="${BASE}/contracts/con-1"`);
  });

  test("C1805: one recipient on a reserved domain is skipped as reserved_domain, the other still goes out, and the answer is sent", async () => {
    claimed({ ok: true, decision: "send", messages: [copyMessage("n2", "customer", "pat@example.com"), copyMessage("n4", "contractor", "dana@northwind.ca")] });
    expect(await notify(callback("contract_signed_copy", `w4:${EVENT}:copy`))).toEqual({ ok: true, outcome: "sent" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toEqual(["dana@northwind.ca"]);
    expect(complete.mock.calls[0][1]).toEqual([
      { id: "n2", outcome: "skipped", reason: "reserved_domain" },
      { id: "n4", outcome: "sent", providerMessageId: "re_1" },
    ]);
  });

  test("C1816: in_flight answers in_flight, a duplicate answers duplicate, a provider outage answers unavailable, for the new kinds as for the old", async () => {
    const cb = callback("customer_signing_link", `w2:${EVENT}:link`);
    claimed({ ok: true, decision: "in_flight" });
    expect(await notify(cb)).toEqual({ ok: false, code: "in_flight" });
    claimed({ ok: true, decision: "duplicate" });
    expect(await notify(cb)).toEqual({ ok: true, outcome: "duplicate" });
    claimed({ ok: true, decision: "send", messages: [linkMessage()] });
    send.mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await notify(cb)).toEqual({ ok: false, code: "unavailable" });
    claimed({ ok: false, code: "unauthorized" });
    expect(await notify(cb)).toEqual({ ok: false, code: "unauthorized" });
    claimed({ ok: false, code: "not_found" });
    expect(await notify(cb)).toEqual({ ok: false, code: "not_found" });
    claimed({ ok: false, code: "malformed" });
    expect(await notify(cb)).toEqual({ ok: false, code: "malformed" });
  });
});
