import { NextResponse, type NextRequest } from "next/server";
import { clientAddress, createRateLimiter } from "@/infrastructure/rate-limit/limiter";
import { portalGate } from "@/infrastructure/supabase/portal-gate";
import { signingGate } from "@/infrastructure/supabase/signing-gate";
import { updateSession } from "@/infrastructure/supabase/session";

/** Secret-link pages: tokens cannot be guessed, but each call costs a database round trip. */
const tokenPages = createRateLimiter({ limit: 60, windowMs: 60_000 });
/** Sign-in, sign-up and the email confirmation link. */
const authPages = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** The public chat agent: each answer costs a model call, so a burst and a whole day are both capped per address. */
const siteAgentBurst = createRateLimiter({ limit: 10, windowMs: 60_000 });
const siteAgentDaily = createRateLimiter({ limit: 80, windowMs: 86_400_000 });

/** A 429 when this client has used up its allowance for the path, else null. A request with no client address is not limited. */
function tooManyRequests(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  const limiters = /^\/(review|sign)\//.test(path) ? [tokenPages] : /^\/(login|register|auth)(\/|$)/.test(path) ? [authPages] : path === "/api/site-agent" ? [siteAgentBurst, siteAgentDaily] : [];
  const address = clientAddress(request.headers);
  if (limiters.length === 0 || !address) return null;
  const decision = limiters.map((limiter) => limiter(address)).find((each) => !each.allowed) ?? { allowed: true as const };
  if (decision.allowed) return null;
  return new NextResponse("Too many requests. Try again shortly.", {
    status: 429,
    headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" },
  });
}

export async function proxy(request: NextRequest) {
  const refused = tooManyRequests(request);
  if (refused) return refused;
  return (await portalGate(request)) ?? (await signingGate(request)) ?? updateSession(request);
}

export const config = {
  // Everything except build assets and images, so a redirect never blocks CSS, JS or the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
