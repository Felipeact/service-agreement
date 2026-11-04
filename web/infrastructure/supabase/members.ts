import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  ChangeMemberResult,
  InvitationAcceptor,
  InvitationLinkSender,
  InviteResult,
  MemberAdmin,
  MemberFailure,
  MemberRole,
  MemberRoster,
  RevokeResult,
} from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The most rows one read returns (members-page Assumptions); the functions cap at the same number. */
const ROW_CAP = 500;

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** What the member functions raise on purpose (door 4); anything else is logged and read as `unavailable`. */
function failure(error: Pick<PostgrestError, "code" | "message" | "hint">): MemberFailure {
  const hint = error.hint ?? "";
  if (error.code === "23505" && hint === "already_member") return "already_member";
  if (error.code === "23514" && hint === "invalid_email") return "invalid";
  if (error.code === "55000" && (hint === "owner_only" || hint === "last_owner" || hint === "self")) return hint;
  if (error.code === "42501") return "forbidden";
  if (error.code === "P0002") return "not_found";
  console.error(`A membership change failed: ${error.code} ${error.message}`);
  return "unavailable";
}

/** The refusals a given operation can meet; any other is a bug or an outage, so it reads as `unavailable`. */
function only<T extends MemberFailure>(code: MemberFailure, allowed: readonly T[]): T | "unavailable" {
  return (allowed as readonly MemberFailure[]).includes(code) ? (code as T) : "unavailable";
}

export function supabaseMemberRoster(client: Client): MemberRoster {
  return {
    async members() {
      const { data, error } = await client.rpc("list_members").limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map((row) => ({ userId: row.user_id, email: row.email, role: row.role as MemberRole, joinedAt: new Date(row.joined_at) }));
    },

    async invitations() {
      const { data, error } = await client.rpc("list_invitations").limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as MemberRole,
        invitedAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      }));
    },
  };
}

export function supabaseMemberAdmin(client: Client): MemberAdmin {
  return {
    async invite(email, role): Promise<InviteResult> {
      const { data, error } = await client.rpc("create_invitation", { p_email: email, p_role: role });
      if (error) return { ok: false, code: only(failure(error), ["invalid", "already_member", "owner_only", "forbidden"] as const) };
      return { ok: true, id: data };
    },

    async revoke(invitationId): Promise<RevokeResult> {
      const { error } = await client.rpc("revoke_invitation", { p_invitation_id: invitationId });
      if (error) return { ok: false, code: only(failure(error), ["not_found", "forbidden"] as const) };
      return { ok: true };
    },

    async setRole(userId, role): Promise<ChangeMemberResult> {
      const { error } = await client.rpc("set_member_role", { p_user_id: userId, p_role: role });
      if (error) return { ok: false, code: only(failure(error), ["owner_only", "last_owner", "self", "not_found", "forbidden"] as const) };
      return { ok: true };
    },

    async remove(userId): Promise<ChangeMemberResult> {
      const { error } = await client.rpc("remove_member", { p_user_id: userId });
      if (error) return { ok: false, code: only(failure(error), ["owner_only", "last_owner", "self", "not_found", "forbidden"] as const) };
      return { ok: true };
    },
  };
}

/** Give it a client with no session: it only asks Supabase Auth for an email (members-page Flow hop 4). */
export function supabaseInvitationLinkSender(client: Client): InvitationLinkSender {
  return {
    async send(email) {
      try {
        const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (!error) return { ok: true };
        if (error.status === 429) return { ok: false, code: "rate_limited" };
        console.error(`Invitation link failed: ${error.code ?? error.status} ${error.message}`);
      } catch (cause) {
        console.error(`Invitation link failed: ${describeCause(cause)}`);
      }
      return { ok: false, code: "unavailable" };
    },
  };
}

export function supabaseInvitationAcceptor(client: Client): InvitationAcceptor {
  return {
    async acceptInvitations() {
      try {
        const { data, error } = await client.rpc("accept_invitations");
        if (!error) return data;
        console.error(`Accepting invitations failed: ${error.code} ${error.message}`);
      } catch (cause) {
        console.error(`Accepting invitations failed: ${describeCause(cause)}`);
      }
      return 0;
    },
  };
}
