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

  test("C938: no other path gets these headers", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((entry) => entry.source)).toEqual(["/review/:path*"]);
  });
});
