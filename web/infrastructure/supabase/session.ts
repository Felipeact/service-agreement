import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

/** Reachable without a session, exactly (door 1). */
const PUBLIC_PATHS = ["/login", "/auth/confirm"];
/** Whole subtrees reachable without a session: the customer's address is `/review/<token>` and `/review/<token>/pdf`. */
const PUBLIC_PREFIXES = ["/review/"];
const SIGN_IN_PATH = "/login";
const HOME_PATH = "/pipeline";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function redirectTarget(pathname: string, signedIn: boolean): string | null {
  if (signedIn) return pathname === SIGN_IN_PATH ? HOME_PATH : null;
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ? null : SIGN_IN_PATH;
}

/**
 * Refreshes the Supabase session on every proxied request, so Server Components (which cannot write
 * cookies) always read a valid token, then sends signed-out visitors to /login.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Literal process.env reads, so Next inlines the NEXT_PUBLIC_ values.
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        cacheHeaders = headers;
        Object.entries(headers).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  // Nothing between createServerClient and getClaims: getClaims is what refreshes the token (door 5).
  const { data } = await supabase.auth.getClaims();

  const target = redirectTarget(request.nextUrl.pathname, Boolean(data?.claims));
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(cacheHeaders).forEach(([header, value]) => redirect.headers.set(header, value));
  return redirect;
}
