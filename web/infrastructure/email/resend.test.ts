import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { EmailMessage } from "@/application/ports";
import { resendEmailSender } from "./index";

const fetchMock = vi.fn<typeof fetch>();
const sender = resendEmailSender({ apiKey: "re_test_key", from: "agreements@felipeviana.com" });

const message = (over: Partial<EmailMessage> = {}): EmailMessage => ({
  to: ["pat@customer.ca"],
  fromName: "Northwind Mechanical Ltd.",
  subject: "Service agreement AG-1052 from Northwind Mechanical Ltd.",
  html: "<p>Hello</p>",
  text: "Hello",
  idempotencyKey: "w1:11111111-1111-4111-8111-111111111111:link",
  ...over,
});

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ id: "re_1" }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
const sentHeaders = () => new Headers(fetchMock.mock.calls[0][1]?.headers);

describe("the Resend adapter", () => {
  test("C1039: POST https://api.resend.com/emails with the bearer key, the idempotency key and the JSON body", async () => {
    expect(await sender.send(message({ replyTo: "estimator@northwind.ca" }))).toEqual({ ok: true, providerMessageId: "re_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(sentHeaders().get("Authorization")).toBe("Bearer re_test_key");
    expect(sentHeaders().get("Idempotency-Key")).toBe("w1:11111111-1111-4111-8111-111111111111:link");
    expect(sentHeaders().get("Content-Type")).toBe("application/json");
    expect(sentBody()).toEqual({
      from: '"Northwind Mechanical Ltd." <agreements@felipeviana.com>',
      to: ["pat@customer.ca"],
      reply_to: "estimator@northwind.ca",
      subject: "Service agreement AG-1052 from Northwind Mechanical Ltd.",
      html: "<p>Hello</p>",
      text: "Hello",
    });
  });

  test("C1039: reply_to is sent only when given", async () => {
    await sender.send(message());
    expect(sentBody()).not.toHaveProperty("reply_to");
  });

  test("C1039: a 200 with an id maps to ok with the provider id", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "re_1" }, { status: 200 }));
    expect(await sender.send(message())).toEqual({ ok: true, providerMessageId: "re_1" });
  });

  test("C1039: a 422 maps to rejected", async () => {
    fetchMock.mockResolvedValue(Response.json({ name: "validation_error" }, { status: 422 }));
    expect(await sender.send(message())).toEqual({ ok: false, code: "rejected" });
  });

  test.each([
    ["a 500", () => fetchMock.mockResolvedValue(new Response("down", { status: 500 }))],
    ["a 429", () => fetchMock.mockResolvedValue(Response.json({ name: "rate_limit_exceeded" }, { status: 429 }))],
    ["a thrown network error", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
  ])("C1039: %s maps to unavailable", async (_label, arrange) => {
    arrange();
    expect(await sender.send(message())).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1039 (extra): a 409, a concurrent request with the same idempotency key, maps to unavailable", async () => {
    fetchMock.mockResolvedValue(Response.json({ name: "concurrent_idempotent_requests" }, { status: 409 }));
    expect(await sender.send(message())).toEqual({ ok: false, code: "unavailable" });
  });

  test("C1039: a legal name containing a double quote is escaped in from", async () => {
    await sender.send(message({ fromName: 'The "Best" Heating' }));
    expect(sentBody().from).toBe('"The \\"Best\\" Heating" <agreements@felipeviana.com>');
  });

  test.each(["a@example.com", "a@example.org", "a@example.net", "a@shop.test", "a@x.invalid"])(
    "C1024: %s is refused as reserved_domain with no request",
    async (address) => {
      expect(await sender.send(message({ to: [address] }))).toEqual({ ok: false, code: "reserved_domain" });
      expect(fetchMock).toHaveBeenCalledTimes(0);
    },
  );

  test.each(["a@felipeviana.com", "a@notexample.com", "a@example.community"])("C1024: %s is sent", async (address) => {
    expect(await sender.send(message({ to: [address] }))).toEqual({ ok: true, providerMessageId: "re_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
