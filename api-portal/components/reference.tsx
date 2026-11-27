import { planDisplayName } from "@/domain/billing/plan-limits";
import { accessOf } from "@/domain/billing/plan-access";
import { SwaggerReference } from "./swagger-reference";

/** The API reference page: a short how-to above the Swagger UI built from the server's OpenAPI document. */
export function ReferenceView({ spec, plan }: { spec: Record<string, unknown>; plan: string }) {
  const access = accessOf(plan);
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-[14px] text-ink-nav">{`Your ${planDisplayName(plan)} plan allows ${access.api === "write" ? "reads and writes" : "reads"} at ${access.callsPerMinute} calls a minute. Every call acts as the member whose token you send.`}</p>
      <ol className="grid gap-3 text-[13px] text-ink-nav md:grid-cols-3">
        <li className="rounded-card border border-hairline bg-surface p-4">
          <strong className="block text-ink">1. Get a token</strong>
          Sign in through the OAuth 2.1 server named in <code className="font-mono">/.well-known/oauth-protected-resource/api/v1</code>. The token is yours: keep it out of shared tools.
        </li>
        <li className="rounded-card border border-hairline bg-surface p-4">
          <strong className="block text-ink">2. Authorize</strong>
          Press <em>Authorize</em> below and paste the token. Then use <em>Try it out</em> on any call.
        </li>
        <li className="rounded-card border border-hairline bg-surface p-4">
          <strong className="block text-ink">3. Stay in scope</strong>
          You only see your own company&apos;s records. A call that names an org, user or role is refused.
        </li>
      </ol>
      <SwaggerReference spec={spec} />
    </div>
  );
}
