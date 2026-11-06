import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ContractDocument } from "@/domain/contract";
import type {
  BeginSignatureFailure,
  ContractDocuments,
  PortalTokens,
  SignatureFailure,
  SignatureProvider,
  SignatureStore,
  ContractRenderer,
} from "@/application/ports";
import { makeSendForSignature } from "./signing";

const CONTRACT = "c0ffee00-0000-4000-8000-000000000001";
const ORG = "0r600000-0000-4000-8000-000000000001";

const document = {
  number: "AG-1052",
  signer: { name: "Pat Lee", email: "pat@example.com" },
} as unknown as ContractDocument;

const calls: string[] = [];
const seal = (value: string) => `sealed(${value})`;

const tokens: PortalTokens = {
  create: () => {
    calls.push("tokens.create");
    return { token: "tok-123", hash: "hash-123" };
  },
  hash: (value) => `hash(${value})`,
  seal: (value) => seal(value),
  unseal: (value) => value.replace(/^sealed\(|\)$/g, ""),
};

let documents: ContractDocuments;
let store: SignatureStore;
let renderer: ContractRenderer;
let provider: SignatureProvider;
let pdf: Uint8Array;

const GOOD_ANSWER = {
  ok: true as const,
  submissionId: "13226499",
  signers: [
    { role: "customer" as const, submitterId: "17214316", embedSrc: "https://docuseal.com/s/a" },
    { role: "contractor" as const, submitterId: "17214317", embedSrc: "https://docuseal.com/s/b" },
  ],
};

const input = { contractId: CONTRACT, orgId: ORG, contractorName: "Dana Admin", contractorEmail: "dana@example.com", baseUrl: "https://app.test/" };

beforeEach(() => {
  calls.length = 0;
  pdf = new Uint8Array([1, 2, 3]);
  documents = {
    load: vi.fn(async () => {
      calls.push("documents.load");
      return { number: "AG-1052", document };
    }),
  };
  store = {
    begin: vi.fn(async () => {
      calls.push("store.begin");
      return { ok: true as const, requestId: "req-1" };
    }),
    complete: vi.fn(async () => {
      calls.push("store.complete");
      return { ok: true as const };
    }),
    fail: vi.fn(async () => {
      calls.push("store.fail");
    }),
  };
  renderer = {
    renderContract: vi.fn(async () => {
      calls.push("renderer.renderContract");
      return pdf;
    }),
  };
  provider = {
    createRequest: vi.fn(async () => {
      calls.push("provider.createRequest");
      return GOOD_ANSWER;
    }),
    void: vi.fn(async () => {
      calls.push("provider.void");
      return { ok: true as const };
    }),
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const send = () => makeSendForSignature({ documents, store, renderer, provider, tokens })(input);

describe("sending a contract for signature", () => {
  test("C1682: reads, makes the token, begins, renders, asks the provider, completes, and answers the customer's address", async () => {
    const result = await send();

    expect(calls).toEqual(["documents.load", "tokens.create", "store.begin", "renderer.renderContract", "provider.createRequest", "store.complete"]);
    expect(result).toEqual({ ok: true, link: "https://app.test/sign/tok-123" });
    expect(store.begin).toHaveBeenCalledWith(CONTRACT, "Dana Admin", "hash-123");
    expect(renderer.renderContract).toHaveBeenCalledWith(document);
    expect(provider.createRequest).toHaveBeenCalledWith({
      contractId: CONTRACT,
      number: "AG-1052",
      pdf,
      signers: [
        { role: "customer", name: "Pat Lee", email: "pat@example.com" },
        { role: "contractor", name: "Dana Admin", email: "dana@example.com" },
      ],
    });
    const [requestId, submissionId, signers, linkSealed] = (store.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(requestId).toBe("req-1");
    expect(submissionId).toBe("13226499");
    // Each stored value opens back to what the provider and the app made.
    expect(signers.map((s: { role: string; submitterId: string; embedSealed: string }) => [s.role, s.submitterId, tokens.unseal(s.embedSealed)])).toEqual([
      ["customer", "17214316", "https://docuseal.com/s/a"],
      ["contractor", "17214317", "https://docuseal.com/s/b"],
    ]);
    expect(tokens.unseal(linkSealed)).toBe("tok-123");
  });

  test("C1683: the hash passed on is the SHA-256 of the exact bytes the renderer returned", async () => {
    await send();
    const sha = (store.complete as ReturnType<typeof vi.fn>).mock.calls[0][4];
    expect(sha).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");
    expect(sha).toBe(createHash("sha256").update(pdf).digest("hex"));
  });

  test.each<SignatureFailure>(["rejected", "unavailable", "not_configured"])(
    "C1684: a provider answer of %s fails the request, completes nothing and voids nothing",
    async (code) => {
      (provider.createRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code });
      const result = await send();
      expect(result).toEqual({ ok: false, code });
      expect(store.fail).toHaveBeenCalledWith("req-1");
      expect(store.complete).not.toHaveBeenCalled();
      expect(provider.void).not.toHaveBeenCalled();
    },
  );

  test("C1685: when completing fails after the provider accepted, the submission is voided once and the request failed once", async () => {
    (store.complete as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await send()).toEqual({ ok: false, code: "unavailable" });
    expect(provider.void).toHaveBeenCalledTimes(1);
    expect(provider.void).toHaveBeenCalledWith("13226499");
    expect(store.fail).toHaveBeenCalledTimes(1);
    expect(store.fail).toHaveBeenCalledWith("req-1");
  });

  test("C1685: when that void also fails it still answers unavailable and logs the submission id", async () => {
    (store.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));
    (provider.void as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code: "unavailable" });
    expect(await send()).toEqual({ ok: false, code: "unavailable" });
    expect(store.fail).toHaveBeenCalledWith("req-1");
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("13226499");
  });

  test.each<BeginSignatureFailure>(["forbidden", "not_found", "not_pending", "parties_missing", "invalid_name", "already_open", "unavailable"])(
    "C1686: a begin answer of %s is returned and nothing is rendered or sent",
    async (code) => {
      (store.begin as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, code });
      expect(await send()).toEqual({ ok: false, code });
      expect(renderer.renderContract).not.toHaveBeenCalled();
      expect(provider.createRequest).not.toHaveBeenCalled();
    },
  );

  test("C1687: when the renderer rejects, the request is failed, the provider is not asked and the answer is unavailable", async () => {
    (renderer.renderContract as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("layout"));
    expect(await send()).toEqual({ ok: false, code: "unavailable" });
    expect(store.fail).toHaveBeenCalledWith("req-1");
    expect(provider.createRequest).not.toHaveBeenCalled();
  });

  test("C1688: when sealing throws, the answer is unavailable before anything is begun", async () => {
    const noKey: PortalTokens = {
      ...tokens,
      seal: () => {
        throw new Error("SIGNING_LINK_KEY must be 32 bytes, base64");
      },
    };
    const result = await makeSendForSignature({ documents, store, renderer, provider, tokens: noKey })(input);
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(store.begin).not.toHaveBeenCalled();
    expect(renderer.renderContract).not.toHaveBeenCalled();
  });
});
