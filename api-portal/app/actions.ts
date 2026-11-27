"use server";

import { redirect } from "next/navigation";
import { appUrl } from "@/lib/env";
import { createSupabase } from "@/lib/supabase";

/** Signs the visitor out of this browser (the session cookie is shared with the app, so the app signs out too) and returns to the app's sign-in. */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`${appUrl()}/login`);
}
