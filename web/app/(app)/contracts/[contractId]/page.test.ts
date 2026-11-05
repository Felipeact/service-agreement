import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail, CurrentMember } from "@/application/ports";

const CON = "66666666-6666-4666-8666-666666666666";
const AGR = "11111111-1111-4111-8111-111111111111";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const contractGet = vi.fn<(id: string) => Promise<ContractDetail | null>>();
const agreementGet = vi.fn<(id: string, versionNo?: number) => Promise<AgreementDetail | null>>();
const container = { currentMember, contractReader: { get: contractGet }, agreementReader: { get: agreementGet } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));
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
