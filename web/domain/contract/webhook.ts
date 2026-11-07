/** DocuSeal's `X-Docuseal-Signature`: `<unix seconds>.<64 lowercase hex>`. The database checks the HMAC itself (signature-webhook door 1). */
const SIGNATURE_HEADER = /^[0-9]{1,12}\.[0-9a-f]{64}$/;

export function isDocusealSignature(header: string | null): header is string {
  return header !== null && SIGNATURE_HEADER.test(header);
}

/** The two files DocuSeal produces when both parties have signed (door 2). */
export const SIGNED_DOCUMENT_KINDS = ["signed", "audit_log"] as const;

export type SignedDocumentKind = (typeof SIGNED_DOCUMENT_KINDS)[number];

/** The most one stored file may hold: the same bound as `contract_signed_documents.size_bytes` (door 2). */
export const SIGNED_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** The attachment name a download carries (door 6): `AG-1052-signed.pdf`, `AG-1052-audit-log.pdf`. */
export function signedDocumentFilename(agreementNumber: string, kind: SignedDocumentKind): string {
  return `${agreementNumber}-${kind === "signed" ? "signed" : "audit-log"}.pdf`;
}
