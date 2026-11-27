import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuthConsent, OAuthConsentRequest } from "@/application/ports";
import type { Database } from "./database.types";

/** What Supabase Auth's OAuth 2.1 server says about a pending sign-in request, and the member's decision, as the signed-in member. */
export function supabaseOAuthConsent(client: SupabaseClient<Database>): OAuthConsent {
  return {
    async details(authorizationId): Promise<OAuthConsentRequest | null> {
      const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) return null;
      // Already approved before: Supabase hands back where to go next.
      if ("redirect_url" in data) return { kind: "redirect", url: data.redirect_url };
      return { kind: "consent", clientName: data.client.name, scopes: data.scope.split(" ").filter(Boolean), email: data.user.email };
    },
    async decide(authorizationId, approve): Promise<string | null> {
      const { data, error } = approve ? await client.auth.oauth.approveAuthorization(authorizationId) : await client.auth.oauth.denyAuthorization(authorizationId);
      return error || !data ? null : data.redirect_url;
    },
  };
}
