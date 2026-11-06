import { describe, expect, test } from "vitest";
import { canSignContracts, isLiveRequest, signingLinkUrl, signingState, type SigningState } from "./index";
import type { ContractStatus } from "./index";
import type { SignatureRequestStatus } from "./signing";

describe("signingState", () => {
  const rows: [SignatureRequestStatus, ContractStatus, SigningState][] = [
    ["open", "pending_signature", "open"],
    ["open", "client_signed", "signed"],
    ["open", "completed", "signed"],
    ["open", "declined", "closed"],
    ["open", "voided", "closed"],
    ["failed", "pending_signature", "closed"],
    ["failed", "client_signed", "closed"],
    ["voided", "pending_signature", "closed"],
    ["voided", "completed", "closed"],
  ];

  test.each(rows)("C1697: a %s request on a %s contract is %s", (requestStatus, contractStatus, expected) => {
    expect(signingState({ requestStatus, contractStatus })).toBe(expected);
  });

  test("C1697: the table holds every combination the page can reach: nine, and all three states", () => {
    // `(creating, *)` never reaches the page: signature_view answers null for a request still being made.
    expect(rows).toHaveLength(9);
    expect(new Set(rows.map(([, , state]) => state))).toEqual(new Set(["open", "signed", "closed"]));
  });

  test("C1697: a request that is still being made is closed, whatever the contract says", () => {
    expect(signingState({ requestStatus: "creating", contractStatus: "pending_signature" })).toBe("closed");
  });
});

describe("the signing helpers", () => {
  test("C1697: only a request being made or waiting for signatures is live", () => {
    expect(isLiveRequest("creating")).toBe(true);
    expect(isLiveRequest("open")).toBe(true);
    expect(isLiveRequest("failed")).toBe(false);
    expect(isLiveRequest("voided")).toBe(false);
  });

  test("C1697: the signing address is <base>/sign/<token>, whatever trailing slashes the base carries", () => {
    expect(signingLinkUrl("https://app.test", "tok")).toBe("https://app.test/sign/tok");
    expect(signingLinkUrl("https://app.test///", "tok")).toBe("https://app.test/sign/tok");
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
    ["viewer", false],
    ["", false],
  ])("C1697: %j may sign for the company: %s", (role, expected) => {
    expect(canSignContracts(role)).toBe(expected);
  });
});
