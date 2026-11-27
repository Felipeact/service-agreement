/** The Service Pacts app: where sign-in, the API and the MCP endpoint live. No trailing slash. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

export function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** The parent domain both apps put their sign-in cookie on in production (for example `.servicepacts.com`); unset on localhost, where cookies already cross ports. */
export function authCookieDomain(): string | undefined {
  return process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
}
