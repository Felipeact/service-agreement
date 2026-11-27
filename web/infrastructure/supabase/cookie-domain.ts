/**
 * Cookie options that put the Supabase sign-in cookie on a parent domain (`AUTH_COOKIE_DOMAIN`, for example `.servicepacts.com`), so
 * the app and the API & MCP portal (`api-portal/`) share one sign-in. Unset on localhost, where cookies already cross ports.
 */
export function authCookieOptions(): { cookieOptions?: { domain: string } } {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return domain ? { cookieOptions: { domain } } : {};
}

const MARKER = "sp-sso";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The shape of a request and a response this needs; `NextRequest` and `NextResponse` fit. */
type Req = { cookies: { getAll(): { name: string; value: string }[]; has(name: string): boolean }; nextUrl: { protocol: string } };
type Res = { cookies: { has(name: string): boolean; set(name: string, value: string, options?: Record<string, unknown>): unknown }; headers: { append(name: string, value: string): void } };

/**
 * One-time move of an existing sign-in from a host-only cookie to the shared parent domain. Before `AUTH_COOKIE_DOMAIN` was set the
 * session cookie belonged to the app's own host, so the portal on another subdomain could not see it and sent a signed-in person
 * back to the app. This re-issues each `sb-` cookie on the parent domain once (a marker cookie records it) and expires the old
 * host-only copy, so no one has to sign in again and no stale duplicate is left to win. A cookie the session refresh already set in this
 * response is left alone. Returns the lines that expire the old copies (empty when nothing moved or no parent domain is configured).
 */
export function migrateSessionCookies(request: Req, response: Res): string[] {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!domain || request.cookies.has(MARKER)) return [];
  const session = request.cookies.getAll().filter((cookie) => cookie.name.startsWith("sb-"));
  if (session.length === 0) return [];
  const secure = request.nextUrl.protocol === "https:";
  const options = { domain, path: "/", sameSite: "lax", maxAge: 400 * 24 * 60 * 60, secure };
  const stale: string[] = [];
  for (const { name, value } of session) {
    if (response.cookies.has(name)) continue;
    response.cookies.set(name, value, options);
    stale.push(name);
  }
  response.cookies.set(MARKER, "1", { ...options, maxAge: YEAR_SECONDS });
  // Raw lines, added last: setting a cookie by name above would otherwise replace them. The old copy has no Domain attribute.
  const expiries = stale.map((name) => `${name}=; Max-Age=0; Path=/${secure ? "; Secure" : ""}`);
  for (const line of expiries) response.headers.append("set-cookie", line);
  // The caller adds them again to a redirect it builds from the cookies, which carries only the new ones.
  return expiries;
}
