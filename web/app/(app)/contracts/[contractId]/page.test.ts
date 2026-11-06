import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail, CurrentMember } from "@/application/ports";

const CON = "66666666-6666-4666-8666-666666666666";
const AGR = "11111111-1111-4111-8111-111111111111";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const contractGet = vi.fn<(id: string) => Promise<ContractDetail | null>>();
const agreementGet = vi.fn<(id: string, versionNo?: number) => Promise<AgreementDetail | null>>();
const customerLink = vi.fn<(id: string) => Promise<{ ok: true; sealed: string } | { ok: false; code: string }>>();
const contractorSource = vi.fn<(id: string) => Promise<{ ok: true; sealed: string } | { ok: false; code: string }>>();
// A stand-in for the sealing: the value is "sealed(<x>)" and opens back to <x>.
const signingTokens = { unseal: (sealed: string) => sealed.replace(/^sealed\(|\)$/g, "") };
const container = {
  currentMember,
  contractReader: { get: contractGet },
  agreementReader: { get: agreementGet },
  signingSecrets: { customerLink, contractorSource },
  signingTokens,
};

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("../../link-base", () => ({ linkBase: async () => "https://app.test" }));
vi.mock("../../signing-actions", () => ({ sendForSignatureAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { ContractForRequest } = await import("./page");

const member: CurrentMember = { status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role: "viewer" };
const contract = { id: CON, status: "pending_signature", agreementId: AGR, versionNo: 2, number: "AG-1052", createdAt: new Date(), parties: null } as ContractDetail;
const agreement = { id: AGR } as AgreementDetail;

beforeEach(() => {
  currentMember.mockReset().mockResolvedValue(member);
  contractGet.mockReset().mockResolvedValue(contract);
  agreementGet.mockReset().mockResolvedValue(agreement);
  customerLink.mockReset().mockResolvedValue({ ok: true, sealed: "sealed(tok-abc)" });
  contractorSource.mockReset().mockResolvedValue({ ok: true, sealed: "sealed(https://docuseal.com/s/contractor)" });
});

describe("the contract page", () => {
  test("C1635: a malformed id is a 404 and reads nothing", async () => {
    await expect(ContractForRequest({ contractId: "not-a-uuid" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(contractGet).not.toHaveBeenCalled();
    expect(agreementGet).not.toHaveBeenCalled();
  });

  test("C1635: a contract the reader does not return is a 404 and the agreement is not read", async () => {
    contractGet.mockResolvedValue(null);
    await expect(ContractForRequest({ contractId: CON })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(agreementGet).not.toHaveBeenCalled();
  });

  test("C1635: signed out goes to /login before anything is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(ContractForRequest({ contractId: CON })).rejects.toThrow("NEXT_REDIRECT /login");
    expect(contractGet).not.toHaveBeenCalled();
  });

  test("C1635: the agreement is read at the contract's own version", async () => {
    const element = (await ContractForRequest({ contractId: CON })) as ReactElement<{ contract: ContractDetail; agreement: AgreementDetail }>;
    expect(agreementGet).toHaveBeenCalledWith(AGR, 2);
    expect(element.props.contract).toBe(contract);
    expect(element.props.agreement).toBe(agreement);
  });

  test("C1635: an agreement that cannot be read is a 404 too", async () => {
    agreementGet.mockResolvedValue(null);
    await expect(ContractForRequest({ contractId: CON })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

type SigningProps = { signing: { customerLinkUrl: string | null; contractorSrc: string | null; role: string; request: unknown } };
const render = async (over: Partial<ContractDetail>, role: CurrentMember extends infer M ? (M extends { role: infer R } ? R : never) : never) => {
  currentMember.mockResolvedValue({ ...member, role } as CurrentMember);
  contractGet.mockResolvedValue({ ...contract, ...over } as ContractDetail);
  return ((await ContractForRequest({ contractId: CON })) as ReactElement<SigningProps>).props.signing;
};

describe("the signing secrets on the contract page", () => {
  test("C1696: an owner or admin with an open request gets the customer's link, unsealed and built on the link base", async () => {
    for (const role of ["owner", "admin"] as const) {
      const signing = await render({ signing: { requestId: "r1", status: "open" } }, role);
      expect(signing.customerLinkUrl, role).toBe("https://app.test/sign/tok-abc");
    }
  });

  test("C1696: every other role and request state reads no link", async () => {
    for (const role of ["estimator", "viewer"] as const) {
      await render({ signing: { requestId: "r1", status: "open" } }, role);
    }
    for (const status of ["creating", "failed", "voided"] as const) {
      await render({ signing: { requestId: "r1", status } }, "owner");
    }
    await render({ signing: null }, "owner");
    expect(customerLink).not.toHaveBeenCalled();
  });

  test("C1696: a sealed value that cannot be opened is shown as missing, not as a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    customerLink.mockResolvedValue({ ok: true, sealed: "not-ours" });
    signingTokens.unseal = () => {
      throw new Error("bad key");
    };
    const signing = await render({ signing: { requestId: "r1", status: "open" } }, "owner");
    expect(signing.customerLinkUrl).toBeNull();
    signingTokens.unseal = (sealed: string) => sealed.replace(/^sealed\(|\)$/g, "");
  });

  test("C1711: the contractor's source is read only for an owner or admin on a client_signed contract with an open request, in no other of the 20 role and status pairs", async () => {
    const roles = ["owner", "admin", "estimator", "viewer"] as const;
    const statuses = ["pending_signature", "client_signed", "completed", "declined", "voided"] as const;
    let pairs = 0;
    for (const role of roles) {
      for (const status of statuses) {
        contractorSource.mockClear();
        const signing = await render({ status, signing: { requestId: "r1", status: "open" } }, role);
        pairs++;
        const expected = (role === "owner" || role === "admin") && status === "client_signed";
        expect(contractorSource.mock.calls.length, `${role}/${status}`).toBe(expected ? 1 : 0);
        expect(signing.contractorSrc, `${role}/${status}`).toBe(expected ? "https://docuseal.com/s/contractor" : null);
      }
    }
    expect(pairs).toBe(20);
  });

  test("C1711: a client_signed contract with no open request reads no contractor source", async () => {
    for (const request of [null, { requestId: "r1", status: "failed" }, { requestId: "r1", status: "creating" }]) {
      contractorSource.mockClear();
      await render({ status: "client_signed", signing: request as ContractDetail["signing"] }, "owner");
      expect(contractorSource).not.toHaveBeenCalled();
    }
  });
});
