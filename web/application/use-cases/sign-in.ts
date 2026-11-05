import type { AuthGateway } from "@/application/ports";

export type SignInLinkResult =
  | { ok: true; email: string }
  | { ok: false; code: "invalid_email" | "rate_limited" | "unavailable" };

/** The longest address SMTP delivers (RFC 5321 path limit). */
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeRequestSignInLink(auth: AuthGateway) {
  return async function requestSignInLink(input: string): Promise<SignInLinkResult> {
    const email = input.trim().toLowerCase();
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) return { ok: false, code: "invalid_email" };

    const result = await auth.requestMagicLink(email);
    return result.ok ? { ok: true, email } : result;
  };
}
