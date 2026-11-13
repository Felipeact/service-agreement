import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceEmailCheck } from "@/application/ports";
import type { Database } from "./database.types";

/** The anonymous read by email (checkout-email-in-use door 1); the client is `anon`, cookie-less. Errors carry the code only: a database message can quote the email. */
export function supabaseWorkspaceEmailCheck(client: SupabaseClient<Database>): WorkspaceEmailCheck {
  return {
    async inUse(email) {
      const { data, error } = await client.rpc("email_has_workspace", { p_email: email });
      if (error) throw new Error(`email_has_workspace failed: ${error.code}`);
      if (typeof data === "boolean") return data;
      throw new Error("email_has_workspace answered a value it should not");
    },
    async companyInUse(name) {
      const { data, error } = await client.rpc("company_has_workspace", { p_name: name });
      if (error) throw new Error(`company_has_workspace failed: ${error.code}`);
      if (typeof data === "boolean") return data;
      throw new Error("company_has_workspace answered a value it should not");
    },
  };
}
