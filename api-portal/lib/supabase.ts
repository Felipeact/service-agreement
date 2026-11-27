import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { authCookieDomain, required } from "./env";

/**
 * A Supabase client on the visitor's own session cookie (the same cookie the Service Pacts app sets), so everything it reads is
 * decided by row-level security exactly as in the app. There is no service-role key in the portal. Request time only.
 */
export async function createSupabase(): Promise<SupabaseClient> {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  await connection();
  const cookieStore = await cookies();
  const domain = authCookieDomain();
  return createServerClient(url, key, {
    ...(domain && { cookieOptions: { domain } }),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies; the proxy refreshes the session.
        }
      },
    },
  });
}
