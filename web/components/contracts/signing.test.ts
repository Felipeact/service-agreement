import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ContractStatus, SignatureRequestStatus } from "@/domain/contract";
import { SendForSignaturePrompt, SigningArea, signingAreaKind, type SigningAreaProps } from "./signing-area";
import { SIGNING_MESSAGES, type SendSignatureState } from "./signing-state";

// The embedded form is DocuSeal's; here it is a marker that carries the props the component passes.
vi.mock("@docuseal/react", () => ({
  DocusealForm: (props: { src: string; onComplete?: () => void }) =>
    createElement("div", { "data-docuseal-form": props.src, "data-on-complete": String(typeof props.onComplete === "function") }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const CUSTOMER = { name: "Pat Lee", email: "pat@customer.ca" };
const LINK = "https://app.test/sign/abc";
const EMBED = "https://docuseal.com/s/contractor";

const area = (over: Partial<SigningAreaProps> = {}): SigningAreaProps => ({
  contractStatus: "pending_signature",
  request: null,
  role: "owner",
  customer: CUSTOMER,
  memberEmail: "dana@example.com",
  customerLinkUrl: null,
  contractorSrc: null,
  send: async () => ({ status: "sent" }),
  ...over,
});

const html = (over: Partial<SigningAreaProps> = {}) => renderToStaticMarkup(createElement(SigningArea, area(over)));
const request = (status: SignatureRequestStatus) => ({ requestId: "req-1", status });

const ROLES = ["owner", "admin", "estimator", "viewer"] as const;
const STATUSES: ContractStatus[] = ["pending_signature", "client_signed", "completed", "declined", "voided"];

describe("the Send for signature button", () => {
  test.each(ROLES.flatMap((role) => ([null, "failed", "voided"] as const).map((status) => [role, status] as const)))(
    "C1692: a %s sees the button on a pending contract whose request is %s only if they may sign for the company",
    (role, status) => {
      const markup = html({ role, request: status ? request(status) : null });
      expect(markup.includes("Send for signature")).toBe(role === "owner" || role === "admin");
    },
  );

  test.each(ROLES.flatMap((role) => (["creating", "open"] as const).map((status) => [role, status] as const)))(
    "C1692: a %s sees no button while the request is %s",
    (role, status) => {
      expect(html({ role, request: request(status) })).not.toContain("Send for signature");
    },
  );

  test.each(ROLES.flatMap((role) => STATUSES.filter((s) => s !== "pending_signature").map((status) => [role, status] as const)))(
    "C1692: a %s sees no button on a %s contract",
    (role, status) => {
      expect(html({ role, contractStatus: status })).not.toContain("Send for signature");
    },
  );
});

describe("the confirm step", () => {
  const prompt = (over: Partial<Parameters<typeof SendForSignaturePrompt>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(SendForSignaturePrompt, { customer: CUSTOMER, memberEmail: "dana@example.com", confirming: true, pending: false, state: { status: "idle" }, ...over }),
    );

  test("C1693: it names the customer signer and the member's email and asks for a required name of at most 120 characters", () => {
    const markup = prompt();
    expect(markup).toContain("Pat Lee · pat@customer.ca");
    expect(markup).toContain("dana@example.com");
    expect(markup).toContain("Your name");
    expect(markup).toMatch(/<input[^>]*name="name"/);
    expect(markup).toMatch(/<input[^>]*maxLength="120"/);
    expect(markup).toMatch(/<input[^>]*required=""/);
  });

  test("C1693: in its initial state the control renders a button and no input, and calls no action", () => {
    const send = vi.fn(async (): Promise<SendSignatureState> => ({ status: "sent" }));
    const markup = html({ send });
    expect(markup).toContain("Send for signature");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<form");
    expect(send).not.toHaveBeenCalled();
    expect(prompt({ confirming: false })).not.toContain("<input");
  });

  test("C1693: with no recorded signer the prompt says so and the submit button is disabled", () => {
    const markup = prompt({ customer: null });
    expect(markup).toContain("No signer recorded.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Send for signature/);
  });

  test.each([
    ["rejected", "DocuSeal rejected the document."],
    ["unavailable", "DocuSeal could not be reached. Try again."],
    ["not_configured", "E-signature is not set up for this workspace."],
  ] as const)("C1694: a %s refusal shows exactly %s", (status, message) => {
    const markup = prompt({ state: { status } });
    expect(markup).toContain(message);
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(SIGNING_MESSAGES[status]).toBe(message);
  });

  test("C1694: a failed request leaves Send for signature available again", () => {
    expect(html({ request: request("failed") })).toContain("Send for signature");
  });
});

describe("the open request", () => {
  test.each(["owner", "admin"] as const)("C1695: a %s sees the customer's link with a Copy button and no Send button", (role) => {
    const markup = html({ role, request: request("open"), customerLinkUrl: LINK });
    expect(markup).toContain(`value="${LINK}"`);
    expect(markup).toContain(">Copy<");
    expect(markup).not.toContain("Send for signature");
  });

  test.each(["estimator", "viewer"] as const)("C1695: a %s sees neither the link nor a button", (role) => {
    const markup = html({ role, request: request("open"), customerLinkUrl: LINK });
    expect(markup).not.toContain(LINK);
    expect(markup).not.toContain("Copy");
    expect(markup).not.toContain("Send for signature");
  });
});

describe("the countersignature", () => {
  test.each(["owner", "admin"] as const)("C1709: a %s gets the contractor's form with the unsealed address once the customer has signed", (role) => {
    const markup = html({ role, contractStatus: "client_signed", request: request("open"), contractorSrc: EMBED });
    expect(markup).toContain(`data-docuseal-form="${EMBED}"`);
    expect(markup).toContain('data-on-complete="true"');
  });

  test("C1710: a pending contract with an open request says it waits for the customer and shows no contractor form", () => {
    for (const role of ROLES) {
      const markup = html({ role, request: request("open"), contractorSrc: EMBED });
      expect(markup, role).toContain("Waiting for the customer to sign.");
      expect(markup, role).not.toContain("data-docuseal-form");
    }
  });

  test.each(["client_signed", "completed"] as const)("C1710: a %s contract with no request says none was recorded and shows no form", (contractStatus) => {
    const markup = html({ contractStatus, request: null, contractorSrc: EMBED });
    expect(markup).toContain("No signature request was recorded for this contract.");
    expect(markup).not.toContain("data-docuseal-form");
  });

  test.each(["estimator", "viewer"] as const)("C1710: an %s sees no form in any state", (role) => {
    for (const contractStatus of STATUSES) {
      for (const status of [null, "creating", "open", "failed", "voided"] as const) {
        const markup = html({ role, contractStatus, request: status ? request(status) : null, contractorSrc: EMBED });
        expect(markup, `${contractStatus}/${status}`).not.toContain("data-docuseal-form");
      }
    }
  });

  test("C1710: the section's kind is decided from the status, the request and the role alone", () => {
    expect(signingAreaKind({ contractStatus: "client_signed", request: request("open"), role: "owner" })).toBe("countersign");
    expect(signingAreaKind({ contractStatus: "client_signed", request: request("open"), role: "viewer" })).toBe("none");
    expect(signingAreaKind({ contractStatus: "declined", request: null, role: "owner" })).toBe("none");
  });
});
