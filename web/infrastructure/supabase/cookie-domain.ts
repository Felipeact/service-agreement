/**
 * Cookie options that put the Supabase sign-in cookie on a parent domain (`AUTH_COOKIE_DOMAIN`, for example `.servicepacts.com`), so
 * the app and the API & MCP portal (`api-portal/`) share one sign-in. Unset on localhost, where cookies already cross ports.
 */
export function authCookieOptions(): { cookieOptions?: { domain: string } } {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return domain ? { cookieOptions: { domain } } : {};
}
