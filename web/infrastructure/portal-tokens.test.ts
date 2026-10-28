import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { isPortalToken } from "@/domain/portal";
import { portalTokens } from "./portal-tokens";

describe("portal tokens", () => {
  test("C907: a token is 43 base64url characters and its hash is the lowercase hex SHA-256 of it", () => {
    const { token, hash } = portalTokens.create();
    expect(isPortalToken(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(portalTokens.hash(token)).toBe(hash);
  });

  test("C907: two tokens differ", () => {
    expect(portalTokens.create().token).not.toBe(portalTokens.create().token);
  });
});
