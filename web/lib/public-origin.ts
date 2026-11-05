const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

/**
 * The origin the browser used to reach the app. Behind a proxy (Railway) the request URL carries the
 * container's own address (`localhost:8080`), so `APP_BASE_URL` wins, then the forwarded host and
 * protocol, and the request URL last (plain `next dev`).
 */
export function publicOrigin(requestUrl: URL, headers: Headers, configured?: string): string {
  const base = configured?.trim();
  if (base) return new URL(base).origin;

  const host = first(headers.get("x-forwarded-host"));
  if (!host) return requestUrl.origin;

  const protocol = first(headers.get("x-forwarded-proto")) ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${protocol}://${host}`;
}
