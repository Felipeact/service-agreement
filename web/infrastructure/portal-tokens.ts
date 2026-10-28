import { createHash, randomBytes } from "node:crypto";
import type { PortalTokens } from "@/application/ports";

const sha256Hex = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** 32 random bytes as 43 base64url characters, and the lowercase hex SHA-256 the database stores (customer-portal door 1). */
export const portalTokens: PortalTokens = {
  create() {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: sha256Hex(token) };
  },
  hash: sha256Hex,
};
