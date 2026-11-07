import type { SignatureFailure, SignatureProvider, SignerRole } from "@/application/ports";

const TIMEOUT_MS = 30_000;

/** DocuSeal names a signer by role; the app says `customer` and `contractor`. */
const ROLE_NAME: Record<SignerRole, string> = { customer: "Customer", contractor: "Contractor" };

type Options = {
  apiKey: string | undefined;
  apiUrl: string | undefined;
  /** For tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

type Submitter = { id?: unknown; role?: unknown; embed_src?: unknown };

/** A DocuSeal id is a number; the app keeps it as text so a provider can change its id type. */
function idText(value: unknown): string | null {
  return typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : null;
}

/** 4xx other than 429 will not change on a retry; 429, 5xx, a network error and a timeout will. */
function failureOf(status: number): SignatureFailure {
  return status === 429 || status >= 500 ? "unavailable" : "rejected";
}

/**
 * Sends a contract to DocuSeal with `fetch`, no SDK (signature-provider door 1): `POST /submissions/pdf` with the
 * customer first and the contractor second, `send_email: false` because the app hands out the links, and `remove_tags`
 * so the field tags in the PDF do not show. Nothing it logs holds the key, the PDF or the provider's answer body.
 */
export function docusealSignatureProvider(options: Options): SignatureProvider {
  const send = options.fetch ?? fetch;

  async function call(path: string, init: RequestInit): Promise<{ ok: true; response: Response } | { ok: false; code: SignatureFailure }> {
    if (!options.apiKey || !options.apiUrl) return { ok: false, code: "not_configured" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await send(`${options.apiUrl.replace(/\/+$/, "")}${path}`, {
        ...init,
        headers: { "X-Auth-Token": options.apiKey, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.ok) return { ok: true, response };
      console.error(`DocuSeal answered ${response.status} for ${init.method} ${path.replace(/\d+$/, ":id")}`);
      return { ok: false, code: failureOf(response.status) };
    } catch (cause) {
      console.error(`DocuSeal request failed for ${init.method} ${path.replace(/\d+$/, ":id")}: ${cause instanceof Error ? cause.name : "error"}`);
      return { ok: false, code: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async createRequest(input) {
      const result = await call("/submissions/pdf", {
        method: "POST",
        body: JSON.stringify({
          order: "preserved",
          send_email: false,
          remove_tags: true,
          documents: [{ name: `${input.number}-contract.pdf`, file: Buffer.from(input.pdf).toString("base64") }],
          submitters: input.signers.map((signer) => ({
            role: ROLE_NAME[signer.role],
            name: signer.name,
            email: signer.email,
            external_id: `${input.contractId}:${signer.role}`,
          })),
        }),
      });
      if (!result.ok) return result;

      const body = (await result.response.json().catch(() => null)) as { id?: unknown; submitters?: Submitter[] } | null;
      const submissionId = idText(body?.id);
      const signers: { role: SignerRole; submitterId: string; embedSrc: string }[] = [];
      for (const role of ["customer", "contractor"] as const) {
        const submitter = body?.submitters?.find((candidate) => candidate.role === ROLE_NAME[role]);
        const submitterId = idText(submitter?.id);
        const embedSrc = typeof submitter?.embed_src === "string" ? submitter.embed_src : "";
        if (!submitterId || !embedSrc) {
          console.error("DocuSeal answered without the submission or a signer's link");
          return { ok: false, code: "unavailable" };
        }
        signers.push({ role, submitterId, embedSrc });
      }
      if (!submissionId) {
        console.error("DocuSeal answered without the submission or a signer's link");
        return { ok: false, code: "unavailable" };
      }
      return { ok: true, submissionId, signers };
    },

    async void(submissionId) {
      const result = await call(`/submissions/${encodeURIComponent(submissionId)}`, { method: "DELETE" });
      return result.ok ? { ok: true } : result;
    },
  };
}
