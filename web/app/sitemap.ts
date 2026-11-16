import type { MetadataRoute } from "next";
import { SITEMAP_PATHS } from "@/components/site/content";

/** The public origin: `APP_BASE_URL` when set (production), else the local dev address. */
const origin = () => (process.env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

export const sitemapUrl = () => `${origin()}/sitemap.xml`;

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path) => ({ url: `${origin()}${path === "/" ? "" : path}`, changeFrequency: "monthly" as const }));
}
