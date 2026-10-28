/** A link's token as it appears in the address: 32 random bytes as 43 base64url characters (customer-portal door 1). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isPortalToken(value: string): boolean {
  return TOKEN.test(value);
}

/** The address a customer opens: `<base>/review/<token>`, whatever trailing slashes the base carries. */
export function portalLinkUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/review/${token}`;
}
