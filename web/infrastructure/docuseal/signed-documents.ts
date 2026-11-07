import type { SignedDocuments } from "@/application/ports";
import { SIGNED_DOCUMENT_MAX_BYTES } from "@/domain/contract";

const TIMEOUT_MS = 30_000;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

type Options = {
  /** For tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

/** https, no credentials in the address, the default port, and a host that is `docuseal.com` or a subdomain of it (door 5). */
function allowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname;
  const onDocuSeal = host === "docuseal.com" || host.endsWith(".docuseal.com");
  return url.protocol === "https:" && !url.username && !url.password && url.port === "" && onDocuSeal ? url : null;
}

/** The body as bytes, or `null` once it passes the cap (read as it streams, so a huge answer is never held). */
async function readCapped(response: Response): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > SIGNED_DOCUMENT_MAX_BYTES) return null;
  if (!response.body) {
    const all = new Uint8Array(await response.arrayBuffer());
    return all.length > SIGNED_DOCUMENT_MAX_BYTES ? null : all;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > SIGNED_DOCUMENT_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

/**
 * Downloads the signed contract and its audit log from DocuSeal's file host with `fetch` (signature-webhook door 5). The
 * addresses come from a signed delivery and are still checked: no other host, no credentials sent, no redirect followed.
 * What it logs names the host and the status, never the path (which holds a signed id) or a byte of the file.
 */
export function docusealSignedDocuments(options: Options = {}): SignedDocuments {
  const send = options.fetch ?? fetch;

  return {
    async fetch(documents) {
      const urls = documents.map((document) => allowedUrl(document.url));
      if (urls.some((url) => url === null)) {
        console.error("A signed document address is outside docuseal.com; nothing was fetched");
        return { ok: false, code: "rejected" };
      }

      const files: { kind: (typeof documents)[number]["kind"]; bytes: Uint8Array }[] = [];
      for (const [index, document] of documents.entries()) {
        const url = urls[index] as URL;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const response = await send(url.href, { method: "GET", redirect: "manual", cache: "no-store", signal: controller.signal });
          if (!response.ok) {
            console.error(`DocuSeal file host ${url.hostname} answered ${response.status}`);
            return { ok: false, code: "unavailable" };
          }
          const bytes = await readCapped(response);
          if (!bytes) {
            console.error(`DocuSeal file from ${url.hostname} is over ${SIGNED_DOCUMENT_MAX_BYTES} bytes`);
            return { ok: false, code: "unavailable" };
          }
          if (!PDF_MAGIC.every((byte, at) => bytes[at] === byte)) {
            console.error(`DocuSeal file from ${url.hostname} is not a PDF`);
            return { ok: false, code: "unavailable" };
          }
          files.push({ kind: document.kind, bytes });
        } catch (cause) {
          console.error(`DocuSeal file request to ${url.hostname} failed: ${cause instanceof Error ? cause.name : "error"}`);
          return { ok: false, code: "unavailable" };
        } finally {
          clearTimeout(timer);
        }
      }
      return { ok: true, files };
    },
  };
}
