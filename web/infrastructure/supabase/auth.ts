import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway, MemberDirectory, MemberRole } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** What Supabase answers when `shouldCreateUser: false` meets an unknown email (422). */
const UNKNOWN_EMAIL = "otp_disabled";

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function supabaseAuthGateway(client: Client): AuthGateway {
  return {
    async requestMagicLink(email) {
      try {
        const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (!error || error.code === UNKNOWN_EMAIL) return { ok: true };
        if (error.status === 429) return { ok: false, code: "rate_limited" };
        console.error(`Sign-in link failed: ${error.code ?? error.status} ${error.message}`);
      } catch (cause) {
        console.error(`Sign-in link failed: ${describeCause(cause)}`);
      }
      return { ok: false, code: "unavailable" };
    },

    async verifyEmailLink(tokenHash) {
      try {
        const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        return error ? { ok: false, code: "invalid_link" } : { ok: true };
      } catch (cause) {
        console.error(`Sign-in link verification failed: ${describeCause(cause)}`);
        return { ok: false, code: "invalid_link" };
      }
    },

    async signOut() {
      await client.auth.signOut({ scope: "local" });
    },
  };
}

export function supabaseMemberDirectory(client: Client): MemberDirectory {
  return {
    async currentMember() {
      // getClaims verifies the token; getSession would trust the cookie as sent (door 5).
      const { data } = await client.auth.getClaims();
      const claims = data?.claims;
      if (!claims) return { status: "signed_out" };

      const email = claims.email ?? "";
      const { data: rows, error } = await client
        .from("memberships")
        .select("org_id, role, orgs(name)")
        .eq("user_id", claims.sub)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);

      const row = rows[0];
      if (!row) return { status: "no_membership", email };
      return {
        status: "member",
        userId: claims.sub,
        email,
        orgId: row.org_id,
        orgName: row.orgs.name,
        role: row.role as MemberRole,
      };
    },
  };
}
