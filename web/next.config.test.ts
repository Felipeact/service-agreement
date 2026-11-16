import { describe, expect, test } from "vitest";
import nextConfig from "./next.config";

describe("next.config headers", () => {
  test("C938: /review/:path* sets Cache-Control, Referrer-Policy and X-Robots-Tag", async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.find((entry) => entry.source === "/review/:path*");
    const headers = Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
    expect(headers).toEqual({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    });
  });

  test("C938: no other path gets these headers (the first rule is the site-wide security set, C7011)", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    // `/sign/:path*` joined with signature-provider (C1701); nothing else is added.
    expect(rules.map((entry) => entry.source)).toEqual(["/:path*", "/review/:path*", "/sign/:path*"]);
  });
});

describe("next.config headers for the signing address", () => {
  test("C1701: /sign/:path* sets Cache-Control, Referrer-Policy and X-Robots-Tag", async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.find((entry) => entry.source === "/sign/:path*");
    const headers = Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
    expect(headers).toEqual({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    });
  });
});

describe("next.config site-wide security headers", () => {
  test("C7011: every path gets nosniff, DENY framing, a strict-origin referrer and HSTS, listed before the secret-address rules so those keep no-referrer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules[0].source).toBe("/:path*");
    expect(Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    });
    for (const secret of ["/review/:path*", "/sign/:path*"]) {
      const rule = rules.find((entry) => entry.source === secret);
      expect(rule?.headers.find((header) => header.key === "Referrer-Policy")?.value).toBe("no-referrer");
      expect(rules.indexOf(rule!)).toBeGreaterThan(0);
    }
  });
});
