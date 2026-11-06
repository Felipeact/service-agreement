import { headers } from "next/headers";

/** `APP_BASE_URL` when set, otherwise the origin the request came in on (customer-portal assumption "Link address origin"). */
export async function linkBase(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${protocol}://${host}`;
}
