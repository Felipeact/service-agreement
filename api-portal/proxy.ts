import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { appUrl, authCookieDomain, required } from "@/lib/env";

/** Refreshes the Supabase session cookie on every request, so Server Components (which cannot write cookies) read a valid token, and sends a signed-out visitor to the app's sign-in. The pages decide who else may stay. */
export async function proxy(request: NextRequest) {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const domain = authCookieDomain();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    ...(domain && { cookieOptions: { domain } }),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });
  // Nothing between createServerClient and getClaims: getClaims is what refreshes the token.
  const { data } = await supabase.auth.getClaims();
  // Signed out: the app's sign-in page (the session cookie is shared, so signing in there is signing in here too).
  if (!data?.claims) return NextResponse.redirect(`${appUrl()}/login`);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
