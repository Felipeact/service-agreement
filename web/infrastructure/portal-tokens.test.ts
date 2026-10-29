import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { isPortalToken } from "@/domain/portal";
import { makePortalTokens, portalTokens } from "./portal-tokens";

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

describe("sealed portal tokens (outbox-dispatch door 5)", () => {
  const KEY = randomBytes(32).toString("base64");
  const OTHER = randomBytes(32).toString("base64");
  const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";
  const tokens = makePortalTokens(KEY);
  /** Replaces one base64url character of `value` at `index` with a different one. */
  const flip = (value: string, index: number) => value.slice(0, index) + (value[index] === "A" ? "B" : "A") + value.slice(index + 1);

  test("C1026: unseal(seal(t)) gives back a 43-character token", () => {
    expect(TOKEN).toHaveLength(43);
    expect(tokens.unseal(tokens.seal(TOKEN))).toBe(TOKEN);
  });

  test("C1026: two seals of one token differ, because of a random IV", () => {
    expect(tokens.seal(TOKEN)).not.toBe(tokens.seal(TOKEN));
  });

  test("C1026: the sealed value has the stored format", () => {
    expect(tokens.seal(TOKEN)).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
  });

  test("C1026: another 32-byte key, a changed ciphertext character and a changed tag character each throw", () => {
    const sealed = tokens.seal(TOKEN);
    const [version, iv, body] = sealed.split(".");
    expect(() => makePortalTokens(OTHER).unseal(sealed)).toThrow();
    expect(() => tokens.unseal(`${version}.${iv}.${flip(body, 0)}`)).toThrow();
    // The tag is the last 16 bytes, the last 21 or 22 characters; position -10 lies inside it.
    expect(() => tokens.unseal(`${version}.${iv}.${flip(body, body.length - 10)}`)).toThrow();
  });

  test("C1026: without a key, sealing throws while create and hash still work", () => {
    const keyless = makePortalTokens(undefined);
    expect(() => keyless.seal(TOKEN)).toThrow("PORTAL_LINK_KEY");
    expect(keyless.create().token).toHaveLength(43);
  });
});
