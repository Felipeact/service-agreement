import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ContractDetail, CurrentMember, MemberRole, SignedCopy } from "@/application/ports";

const CON = "66666666-6666-4666-8666-666666666666";
const ORG = "22222222-2222-4222-8222-222222222222";

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Kettle Ridge", role });
const contract = (): ContractDetail => ({
  id: CON,
  status: "completed",
  agreementId: "11111111-1111-4111-8111-111111111111",
  versionNo: 1,
  number: "AG-1052",
  createdAt: new Date("2026-11-05T18:00:00Z"),
  parties: null,
});

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const contractGet = vi.fn<(id: string) => Promise<ContractDetail | null>>();
const copyGet = vi.fn<(id: string, kind: string) => Promise<SignedCopy | null>>();
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, contractReader: { get: contractGet }, signedCopyReader: { get: copyGet } }) }));

const { GET } = await import("./route");

const call = (id = CON) => GET(new NextRequest(`http://localhost:3000/contracts/${id}/audit-log-pdf`), { params: Promise.resolve({ contractId: id }) });
const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x01, 0xfe, 9]);

beforeEach(() => {
  currentMember.mockReset().mockResolvedValue(member("viewer"));
  contractGet.mockReset().mockResolvedValue(contract());
  copyGet.mockReset().mockResolvedValue({ bytes, sha256: "b".repeat(64) });
});

describe("GET /contracts/[contractId]/audit-log-pdf", () => {
  test.each<MemberRole>(["owner", "admin", "estimator", "viewer"])("C1763: a %s gets 200 with the PDF headers and the stored audit log untouched", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-audit-log.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
    expect(copyGet).toHaveBeenCalledWith(CON, "audit_log");
  });

  test("C1764: a malformed id is an empty 404 with no read", async () => {
    const response = await call("not-a-uuid");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(contractGet).not.toHaveBeenCalled();
  });

  test("C1764: a contract the reader does not return is an empty 404", async () => {
    contractGet.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(copyGet).not.toHaveBeenCalled();
  });

  test("C1764: a contract with no stored document is an empty 404", async () => {
    copyGet.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  test("C1764: a signed-out request is redirected to /login and reads nothing", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" } as CurrentMember);
    const response = await call();
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
    expect(contractGet).not.toHaveBeenCalled();
  });
});
