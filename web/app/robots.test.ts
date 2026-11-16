import { afterEach, describe, expect, test, vi } from "vitest";
import robots, { DISALLOWED } from "./robots";
import sitemap from "./sitemap";

afterEach(() => vi.unstubAllEnvs());

const PUBLIC_PAGES = ["/", "/product", "/demo", "/trades", "/pricing", "/about", "/faq", "/contact", "/register", "/terms", "/privacy", "/security"];
const BLOCKED = ["/review/", "/sign/", "/api/", "/auth/", "/login", "/pipeline", "/agreements", "/contracts", "/customers", "/sites", "/assets", "/contacts", "/imports", "/members", "/reports", "/search", "/settings", "/templates", "/setup", "/billing"];

describe("robots.txt and sitemap.xml", () => {
  test("C7009: robots allows the site, disallows every secret address and app route (the full list), and names the sitemap", () => {
    vi.stubEnv("APP_BASE_URL", "https://agreements.example.com/");
    const out = robots();
    const rules = Array.isArray(out.rules) ? out.rules[0] : out.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(BLOCKED);
    expect(DISALLOWED).toEqual(BLOCKED);
    expect(out.sitemap).toBe("https://agreements.example.com/sitemap.xml");
  });

  test("C7009: the sitemap lists exactly the twelve public pages and none of the blocked paths", () => {
    vi.stubEnv("APP_BASE_URL", "https://agreements.example.com");
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(PUBLIC_PAGES.map((path) => `https://agreements.example.com${path === "/" ? "" : path}`));
    for (const url of urls) {
      expect(BLOCKED.some((blocked) => new URL(url).pathname.startsWith(blocked))).toBe(false);
    }
  });
});
