import type { AuthGateway } from "@/application/ports";
import { isEmailAddress } from "@/domain/email";

export type SignInLinkResult =
  | { ok: true; email: string }
  | { ok: false; code: "invalid_email" | "rate_limited" | "unavailable" };

export function makeRequestSignInLink(auth: AuthGateway) {
  return async function requestSignInLink(input: string): Promise<SignInLinkResult> {
    const email = input.trim().toLowerCase();
    if (!isEmailAddress(email)) return { ok: false, code: "invalid_email" };

    const result = await auth.requestMagicLink(email);
    return result.ok ? { ok: true, email } : result;
  };
}
