import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PortalTokens } from "@/application/ports";

const sha256Hex = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** 32 random bytes as 43 base64url characters, and the lowercase hex SHA-256 the database stores (customer-portal door 1). */
export const portalTokens: Pick<PortalTokens, "create" | "hash"> = {
  create() {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: sha256Hex(token) };
  },
  hash: sha256Hex,
};

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEALED = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)$/;

function linkKey(keyBase64: string | undefined): Buffer {
  const key = keyBase64 ? Buffer.from(keyBase64, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("PORTAL_LINK_KEY must be 32 bytes, base64");
  return key;
}

/**
 * The portal tokens plus sealing with `PORTAL_LINK_KEY` (outbox-dispatch door 5): AES-256-GCM, a random 12-byte IV,
 * the 16-byte tag appended to the ciphertext, as `v1.<iv>.<ciphertext+tag>` in base64url. Without a valid key,
 * `seal` and `unseal` throw; `create` and `hash` still work.
 */
export function makePortalTokens(keyBase64: string | undefined): PortalTokens {
  return {
    ...portalTokens,
    seal(token) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", linkKey(keyBase64), iv);
      const sealed = Buffer.concat([cipher.update(token, "utf8"), cipher.final(), cipher.getAuthTag()]);
      return `${VERSION}.${iv.toString("base64url")}.${sealed.toString("base64url")}`;
    },
    unseal(sealed) {
      const parts = SEALED.exec(sealed);
      if (!parts) throw new Error("not a sealed token");
      const iv = Buffer.from(parts[1], "base64url");
      const body = Buffer.from(parts[2], "base64url");
      if (body.length <= TAG_BYTES) throw new Error("not a sealed token");
      const decipher = createDecipheriv("aes-256-gcm", linkKey(keyBase64), iv);
      decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
      return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString("utf8");
    },
  };
}
