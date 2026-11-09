import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeEvents } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/**
 * The database verifies Stripe's signature itself; this client is `anon` with the publishable key, never a service-role key
 * (billing-checkout door 3, AD-068). Three codes are values; anything else is thrown for the caller to log by name only.
 */
export function supabaseStripeEvents(client: Client): StripeEvents {
  return {
    async receive({ body, signature }) {
      const { data, error } = await client.rpc("stripe_receive_event", { p_body: body, p_signature: signature });
      if (error) {
        if (error.code === "42501") return { ok: false, code: "unauthorized" };
        if (error.code === "22023") return { ok: false, code: "malformed" };
        if (error.code === "55000") return { ok: false, code: "unconfigured" };
        // The code only: a database message can quote a piece of the delivery.
        throw new Error(`stripe_receive_event failed: ${error.code}`);
      }
      const outcome = (data as { outcome?: unknown } | null)?.outcome;
      return { ok: true, outcome: typeof outcome === "string" ? outcome : "" };
    },
  };
}
