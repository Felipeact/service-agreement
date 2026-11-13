import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberWorkspaceReader, WorkspaceStatusReader } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

function failed(name: string, code: string): Error {
  // The code only: a database message can quote the session id.
  return new Error(`${name} failed: ${code}`);
}

/** The anonymous read by Checkout session id (workspace-pending-state door 2); the client is `anon`, cookie-less. */
export function supabaseWorkspaceStatus(client: Client): WorkspaceStatusReader {
  return {
    async forSession(sessionId) {
      const { data, error } = await client.rpc("checkout_workspace_status", { p_session_id: sessionId });
      if (error) throw failed("checkout_workspace_status", error.code);
      if (data === "pending" || data === "ready" || data === "refused") return data;
      throw new Error("checkout_workspace_status answered a value it should not");
    },
  };
}

/** The signed-in read by the caller's own email (door 3); the client carries the member's session. */
export function supabaseMemberWorkspace(client: Client): MemberWorkspaceReader {
  return {
    async mine() {
      const { data, error } = await client.rpc("my_workspace_state");
      if (error) throw failed("my_workspace_state", error.code);
      if (data === "none" || data === "pending" || data === "refused") return data;
      throw new Error("my_workspace_state answered a value it should not");
    },
  };
}
