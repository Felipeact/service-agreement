import type { NextRequest } from "next/server";
import { updateSession } from "@/infrastructure/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except build assets and images, so a redirect never blocks CSS, JS or the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
