import type { MetadataRoute } from "next";
import { sitemapUrl } from "./sitemap";

/** The signed-in app, the secret customer addresses and the machine endpoints stay out of search results (qa-p1-p2 C7009). */
export const DISALLOWED = ["/review/", "/sign/", "/api/", "/auth/", "/login", "/pipeline", "/agreements", "/contracts", "/customers", "/sites", "/assets", "/contacts", "/imports", "/members", "/reports", "/search", "/settings", "/templates", "/setup", "/billing"];

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: DISALLOWED }, sitemap: sitemapUrl() };
}
