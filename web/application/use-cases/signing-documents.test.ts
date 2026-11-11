import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ContractDocument } from "@/domain/contract";
import type { AgreementDetail, ContractDetail, PortalTokens, SignatureProvider, SignatureStore, ContractRenderer, ContractDocuments } from "@/application/ports";
import { makeContractDocuments, makeSendForSignature } from "./signing";

// The layout of the document is the domain's own business and is proven there; here only what the use cases hand to it.
const built = { number: "AG-1052", signer: { name: "Pat Lee", email: "pat@example.com" } } as unknown as ContractDocument;
const buildContractDocument = vi.fn<(...args: unknown[]) => ContractDocument>(() => built);
vi.mock("@/domain/contract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/contract")>()),
  buildContractDocument: (...args: unknown[]) => buildContractDocument(...args),
}));

const PARTIES = {
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null },
  customer: { name: "Fernwood Dental" },
  site: { name: "Main", address: null },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};
const contract = { id: "c1", status: "pending_signature", agreementId: "agr-1", versionNo: 2, number: "AG-1052", createdAt: new Date(), parties: PARTIES } as ContractDetail;
const agreement = { id: "agr-1" } as AgreementDetail;

const get = vi.fn<(id: string) => Promise<ContractDetail | null>>();
const agreementGet = vi.fn<(id: string, versionNo?: number) => Promise<AgreementDetail | null>>();
const settings = vi.fn<(orgId: string) => Promise<{ accentColor: string | null } | null>>();

beforeEach(() => {
  buildContractDocument.mockClear();
  get.mockReset().mockResolvedValue(contract);
  agreementGet.mockReset().mockResolvedValue(agreement);
  settings.mockReset().mockResolvedValue({ accentColor: "#1f6f8b" });
});

describe("the document the contract is sent as", () => {
  const load = () => makeContractDocuments({ get }, { get: agreementGet } as never, settings).load("c1", "org-1");

  test("C1725: it reads the contract, then the agreement at the contract's own version, then the org's settings, and builds the document from them", async () => {
    expect(await load()).toEqual({ number: "AG-1052", document: built });
    expect(get).toHaveBeenCalledWith("c1");
    expect(agreementGet).toHaveBeenCalledWith("agr-1", 2);
    expect(settings).toHaveBeenCalledWith("org-1");
    expect(buildContractDocument).toHaveBeenCalledWith(agreement, PARTIES, "#1f6f8b");
  });

  test("C1725: a missing contract is null and nothing else is read", async () => {
    get.mockResolvedValue(null);
    expect(await load()).toBeNull();
    expect(agreementGet).not.toHaveBeenCalled();
    expect(settings).not.toHaveBeenCalled();
  });

  test("C1725: a contract that recorded no parties is null and the agreement is not read", async () => {
    get.mockResolvedValue({ ...contract, parties: null });
    expect(await load()).toBeNull();
    expect(agreementGet).not.toHaveBeenCalled();
  });

  test("C1725: an agreement that cannot be read is null", async () => {
    agreementGet.mockResolvedValue(null);
    expect(await load()).toBeNull();
    expect(settings).not.toHaveBeenCalled();
  });

  test("C1725: an org with no settings row is thrown, as the PDF route answers 503, never drawn without a tenant", async () => {
    settings.mockResolvedValue(null);
    await expect(load()).rejects.toThrow("org org-1 has no settings row");
    expect(buildContractDocument).not.toHaveBeenCalled();
  });

  test("C1725: a tenant with no accent passes null on, and the domain picks the neutral colour", async () => {
    settings.mockResolvedValue({ accentColor: null });
    await load();
    expect(buildContractDocument).toHaveBeenCalledWith(agreement, PARTIES, null);
  });
});

describe("what sending does before it begins", () => {
  const tokens: PortalTokens = { create: () => ({ token: "t", hash: "h" }), hash: (v) => v, seal: (v) => v, unseal: (v) => v };
  const begin = vi.fn();
  const store = { begin, complete: vi.fn(), fail: vi.fn() } as unknown as SignatureStore;
  const renderer = { renderContract: vi.fn() } as unknown as ContractRenderer;
  const provider = { createRequest: vi.fn(), void: vi.fn() } as unknown as SignatureProvider;
  const input = { contractId: "c1", orgId: "org-1", contractorName: "Dana", contractorEmail: "dana@example.com", baseUrl: "https://app.test" };
  const send = (documents: ContractDocuments) => makeSendForSignature({ documents, store, renderer, provider, tokens })(input);

  beforeEach(() => {
    begin.mockReset();
    vi.mocked(renderer.renderContract).mockReset();
    vi.mocked(provider.createRequest).mockReset();
  });

  test("C1725: a contract with no document is not_found and nothing is begun, rendered or sent", async () => {
    expect(await send({ load: async () => null })).toEqual({ ok: false, code: "not_found" });
    expect(begin).not.toHaveBeenCalled();
    expect(renderer.renderContract).not.toHaveBeenCalled();
    expect(provider.createRequest).not.toHaveBeenCalled();
  });

  test("C1725: a document with no customer signer is parties_missing and nothing is begun, rendered or sent", async () => {
    const result = await send({ load: async () => ({ number: "AG-1052", document: { ...built, signer: null } }) });
    expect(result).toEqual({ ok: false, code: "parties_missing" });
    expect(begin).not.toHaveBeenCalled();
    expect(renderer.renderContract).not.toHaveBeenCalled();
    expect(provider.createRequest).not.toHaveBeenCalled();
  });
});

describe("the document the contract is sent as, item words", () => {
  test("C2023: the org's stored words reach the document that goes to the signature provider", async () => {
    settings.mockResolvedValue({ accentColor: null, itemSingular: "station", itemPlural: "stations" } as never);
    await makeContractDocuments({ get }, { get: agreementGet } as never, settings).load("c1", "org-1");
    expect(buildContractDocument).toHaveBeenCalledWith(agreement, PARTIES, null, { singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" });
  });
});

describe("the document the contract is sent as, logo", () => {
  const logo = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]), format: "png" as const };

  test("C3333: the org's current logo is loaded for the member's org and put on the contractor's letterhead", async () => {
    const loadLogo = vi.fn(async () => logo);
    const loaded = await makeContractDocuments({ get }, { get: agreementGet } as never, settings, loadLogo).load("c1", "org-1");
    expect(loadLogo).toHaveBeenCalledWith("org-1");
    expect((loaded?.document as unknown as { contractor: { logo: unknown } }).contractor.logo).toEqual(logo);
  });

  test("C3333: when the loader has no logo the document is the one built, untouched, and loads as before", async () => {
    const loaded = await makeContractDocuments({ get }, { get: agreementGet } as never, settings, async () => null).load("c1", "org-1");
    expect(loaded).toEqual({ number: "AG-1052", document: built });
    expect(loaded?.document).toBe(built);
  });
});

