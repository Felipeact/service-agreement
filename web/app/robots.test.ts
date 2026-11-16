import { afterEach, describe, expect, test, vi } from "vitest";
import { SITEMAP_PATHS } from "@/components/site/content";
import robots, { DISALLOWED } from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt and sitemap.xml", () => {
  test("C7009: robots allows the site, disallows the secret addresses and the app, and names the sitemap", () => {
    vi.stubEnv("APP_BASE_URL", "https://agreements.example.com/");
    const out = robots();
    const rules = Array.isArray(out.rules) ? out.rules[0] : out.rules;
    expect(rules.allow).toBe("/");
    for (const path of ["/review/", "/sign/", "/api/", "/pipeline", "/agreements", "/settings"]) expect(rules.disallow).toContain(path);
    expect(out.sitemap).toBe("https://agreements.example.com/sitemap.xml");
  });

  test("C7009: the sitemap lists every public page and no page of the app or a secret address", () => {
    vi.stubEnv("APP_BASE_URL", "https://agreements.example.com");
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toHaveLength(SITEMAP_PATHS.length);
    expect(urls).toContain("https://agreements.example.com");
    for (const path of ["/pricing", "/terms", "/privacy", "/security", "/register"]) expect(urls).toContain(`https://agreements.example.com${path}`);
    for (const url of urls) {
      expect(DISALLOWED.some((blocked) => new URL(url).pathname.startsWith(blocked))).toBe(false);
    }
  });
});
