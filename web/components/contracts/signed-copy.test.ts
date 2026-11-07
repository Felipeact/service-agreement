import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { SignedCopyView } from "@/application/ports";
import type { ContractStatus, SignatureRequestStatus } from "@/domain/contract";
import { SigningArea, signingAreaKind, type SigningAreaProps } from "./signing-area";
import { formatSignedAt } from "./signing-state";

vi.mock("@/components/signing/signing-form", () => ({
  SigningForm: (props: { src: string }) => createElement("div", { "data-docuseal-form": props.src }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const CON = "66666666-6666-4666-8666-666666666666";
const ROLES = ["owner", "admin", "estimator", "viewer"] as const;

const SIGNED: SignedCopyView = {
  documents: [
    { kind: "signed", sizeBytes: 15, sha256: "a".repeat(64) },
    { kind: "audit_log", sizeBytes: 14, sha256: "b".repeat(64) },
  ],
  signers: [
    { role: "customer", name: "Pat Lee", signedAt: new Date("2026-01-15T22:14:00Z"), ip: "203.0.113.9" },
    { role: "contractor", name: "Dana Admin", signedAt: new Date("2026-01-15T22:30:00Z"), ip: "198.51.100.7" },
  ],
};

const area = (over: Partial<SigningAreaProps> = {}): SigningAreaProps => ({
  contractStatus: "completed",
  request: { requestId: "req-1", status: "completed" },
  role: "owner",
  customer: { name: "Pat Lee", email: "pat@customer.ca" },
  memberEmail: "dana@example.com",
  customerLinkUrl: null,
  contractorSrc: "https://docuseal.com/s/contractor",
  send: async () => ({ status: "sent" }),
  contractId: CON,
  signed: SIGNED,
  ...over,
});

const html = (over: Partial<SigningAreaProps> = {}) => renderToStaticMarkup(createElement(SigningArea, area(over)));

describe("the signed copy on the contract page", () => {
  test.each(ROLES)("C1760: a %s sees both downloads and each signer's name, time in America/Vancouver and address", (role) => {
    const markup = html({ role });
    expect(markup).toContain(`<a href="/contracts/${CON}/signed-pdf"`);
    expect(markup).toContain(">Signed contract</a>");
    expect(markup).toContain(`<a href="/contracts/${CON}/audit-log-pdf"`);
    expect(markup).toContain(">Audit log</a>");
    expect(markup).toContain("Pat Lee · Jan 15, 2026, 2:14 PM · 203.0.113.9");
    expect(markup).toContain("Dana Admin · Jan 15, 2026, 2:30 PM · 198.51.100.7");
    expect(markup).not.toContain("data-docuseal-form");
  });

  test("C1760: the customer's line comes before the contractor's, and a signer with nothing recorded shows only the name", () => {
    const markup = html();
    expect(markup.indexOf("Pat Lee ·")).toBeLessThan(markup.indexOf("Dana Admin ·"));
    const bare = html({ signed: { ...SIGNED, signers: [{ role: "customer", name: "Pat Lee", signedAt: null, ip: null }] } });
    expect(bare).toContain("<li>Pat Lee</li>");
  });

  test("C1760: the time is shown in the house time zone whatever the server's", () => {
    expect(formatSignedAt(new Date("2026-01-15T22:14:00Z"))).toBe("Jan 15, 2026, 2:14 PM");
    expect(formatSignedAt(new Date("2026-07-07T22:14:00Z"))).toBe("Jul 7, 2026, 3:14 PM");
  });

  test("C1760: a completed contract whose request is not completed shows no signed section", () => {
    expect(html({ request: { requestId: "req-1", status: "open" }, signed: null })).toBe("");
  });
});

describe("a declined contract", () => {
  test.each(ROLES)("C1761: a %s sees that it was declined, and no form and no Send button", (role) => {
    const markup = html({ role, contractStatus: "declined", request: { requestId: "req-1", status: "declined" }, signed: null });
    expect(markup).toContain("This contract was declined.");
    expect(markup).not.toContain("data-docuseal-form");
    expect(markup).not.toContain("Send for signature");
  });

  test.each<[string, SigningAreaProps["request"]]>([
    ["no request", null],
    ["a failed request", { requestId: "r", status: "failed" }],
    ["a voided request", { requestId: "r", status: "voided" }],
    ["a declined request", { requestId: "r", status: "declined" }],
  ])("C1761: signingAreaKind is declined with %s", (_label, request) => {
    for (const role of ROLES) {
      expect(signingAreaKind({ contractStatus: "declined", request, role })).toBe("declined");
    }
  });

  test("C1761: a completed contract with a completed request is signed, whatever the other statuses give", () => {
    const statuses: [ContractStatus, SignatureRequestStatus | null, string][] = [
      ["completed", "completed", "signed"],
      ["completed", null, "no_request"],
      ["completed", "open", "none"],
      ["voided", "voided", "none"],
    ];
    for (const [contractStatus, status, kind] of statuses) {
      expect(signingAreaKind({ contractStatus, request: status ? { requestId: "r", status } : null, role: "owner" }), `${contractStatus}/${status}`).toBe(kind);
    }
  });
});
