import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { EmailMessage } from "@/application/ports";
import { resendEmailSender } from "./index";

const fetchMock = vi.fn<typeof fetch>();
const sender = resendEmailSender({ apiKey: "re_test_key", from: "agreements@felipeviana.com" });

const message = (over: Partial<EmailMessage> = {}): EmailMessage => ({
  to: ["pat@customer.ca"],
  fromName: "Northwind Mechanical Ltd.",
  subject: "Signed contract",
  html: "<p>Hello</p>",
  text: "Hello",
  idempotencyKey: "w4:e:copy:customer",
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
const base64Of = (bytes: number) => Buffer.alloc(bytes, 1).toString("base64");

describe("the Resend adapter, attachments", () => {
  test("C1807: each attachment is posted as {filename, content} with the base64, and a message without attachments has no attachments key", async () => {
    await sender.send(
      message({
        attachments: [
          { filename: "AG-1052-signed.pdf", contentBase64: "JVBERi0=" },
          { filename: "AG-1052-audit-log.pdf", contentBase64: "JVBERi1=" },
        ],
      }),
    );
    expect(sentBody().attachments).toEqual([
      { filename: "AG-1052-signed.pdf", content: "JVBERi0=" },
      { filename: "AG-1052-audit-log.pdf", content: "JVBERi1=" },
    ]);

    fetchMock.mockClear();
    await sender.send(message());
    expect("attachments" in sentBody()).toBe(false);
    fetchMock.mockClear();
    await sender.send(message({ attachments: [] }));
    expect("attachments" in sentBody()).toBe(false);
  });

  test("C1808: an attachment of 10,485,761 bytes is rejected with no request; 10,485,760 is sent", async () => {
    expect(await sender.send(message({ attachments: [{ filename: "big.pdf", contentBase64: base64Of(10_485_761) }] }))).toEqual({ ok: false, code: "rejected" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await sender.send(message({ attachments: [{ filename: "edge.pdf", contentBase64: base64Of(10_485_760) }] }))).toEqual({ ok: true, providerMessageId: "re_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
