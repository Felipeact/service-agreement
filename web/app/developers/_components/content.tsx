import Link from "next/link";
import { PLANS, formatPlanPrice } from "@/domain/billing";
import { PLAN_ACCESS, type AccessLevel } from "@/domain/billing/plan-access";
import { AI_TOOLS } from "@/domain/ai-tools";
import { API_BASE_PATH, API_ROUTES } from "@/domain/public-api";
import { Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { SITE } from "@/components/site/content";

const ORIGIN = "https://servicepacts.com";

const LEVEL_TEXT: Record<AccessLevel, string> = { none: "Not included", read: "Read", write: "Read and create drafts" };

const CURL = `curl ${ORIGIN}${API_BASE_PATH}/agreements/expiring?within_days=30 \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`;

const ANSWER = `{
  "data": {
    "withinDays": 30,
    "count": 1,
    "agreements": [{ "number": "AG-1001", "customer": "Northside School", "daysLeft": 21, "yearlyValueCad": 8450 }]
  }
}`;

/** A block of code or output: scrolls inside itself, so a narrow screen never scrolls sideways. */
function Code({ children, label }: { children: string; label: string }) {
  return (
    <pre tabIndex={0} aria-label={label} className="max-w-full overflow-x-auto rounded-card border border-hairline bg-board p-4 font-mono text-[13px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children, tone = "surface" }: { id: string; title: string; children: React.ReactNode; tone?: "surface" | "ground" }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-20 ${tone === "ground" ? "bg-ground" : "bg-surface"}`}>
      <Wrap className="flex flex-col gap-5 py-10 lg:py-14">
        <h2 id={`${id}-title`} className="font-display text-[26px] leading-tight font-semibold tracking-tight lg:text-[32px]">
          {title}
        </h2>
        {children}
      </Wrap>
    </section>
  );
}

/** The API and AI connection page (API door 2). */
export function Content() {
  return (
    <SiteShell>
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-4 pt-10 pb-8 lg:pt-16 lg:pb-10">
          <p className="text-[13px] font-semibold tracking-wide text-action uppercase">API and AI</p>
          <h1 className="font-display text-[34px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-[48px]">Use your agreements data from your own tools</h1>
          <p className="max-w-[62ch] text-[16px] leading-relaxed text-pretty text-ink-2">
            Read your customers, sites, agreements and reports from a script or a spreadsheet, or let an AI client such as Claude work with them. Both act as you: your company and role come from your sign-in, so you only ever see
            what you already see in the app.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-control bg-action px-5 text-[15px] font-semibold text-white hover:bg-action-hover">
              Sign in to open the API reference
            </Link>
          </div>
        </Wrap>
      </section>

      <Section id="plans" title="Which plan includes what">
        <ul className="grid gap-3 md:grid-cols-3">
          {PLANS.map((plan) => (
            <li key={plan.key} className="flex flex-col gap-3 rounded-card border border-hairline bg-ground p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-[20px] font-semibold">{plan.name}</h3>
                <span className="text-[13px] text-ink-nav">{formatPlanPrice(plan.monthlyCents)} a month</span>
              </div>
              <dl className="flex flex-col gap-2 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-nav">API</dt>
                  <dd className="text-right font-medium text-ink">{LEVEL_TEXT[PLAN_ACCESS[plan.key].api]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-nav">AI connection (MCP)</dt>
                  <dd className="text-right font-medium text-ink">{LEVEL_TEXT[PLAN_ACCESS[plan.key].mcp]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-nav">Calls a minute</dt>
                  <dd className="text-right font-medium text-ink">{PLAN_ACCESS[plan.key].callsPerMinute === 0 ? "None" : PLAN_ACCESS[plan.key].callsPerMinute}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="max-w-[70ch] text-[14px] text-ink-2">Every plan keeps the in-app Ask AI assistant. Prices are in Canadian dollars. A company on a plan without access gets a clear refusal that names the plan to choose.</p>
      </Section>

      <Section id="api" title="The REST API" tone="ground">
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          Base address <code className="rounded bg-board px-1.5 py-0.5 font-mono text-[13px]">{`${ORIGIN}${API_BASE_PATH}`}</code>. Send a member&apos;s access token as <code className="rounded bg-board px-1.5 py-0.5 font-mono text-[13px]">Authorization: Bearer</code>. Tokens come from the sign-in
          (OAuth 2.1) of the authorization server named at <code className="rounded bg-board px-1.5 py-0.5 font-mono text-[13px]">/.well-known/oauth-protected-resource{API_BASE_PATH}</code>; the member signs in with their email link, exactly as in the app.
          The interactive reference (Swagger, with Try it out), the connection guide and an activity log of every call are on the API &amp; MCP portal, a separate site that opens from <strong className="text-ink">API &amp; MCP</strong> in the app&apos;s sidebar for owners and admins on a plan that includes the API. Answers are JSON, money is in dollars, and a failed call is <code className="rounded bg-board px-1.5 py-0.5 font-mono text-[13px]">{`{ "error": { "message": "…" } }`}</code>.
        </p>
        <ul className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-surface">
          {API_ROUTES.map((route) => (
            <li key={`${route.method} ${route.path}`} className="flex flex-col gap-1 p-4 md:flex-row md:items-center md:gap-4">
              <div className="flex min-w-0 items-center gap-3 md:w-[26rem]">
                <span className={`inline-flex min-w-14 justify-center rounded-control px-2 py-0.5 font-mono text-[12px] font-semibold ${route.method === "GET" ? "bg-action-tint text-action" : "bg-attention-bg text-attention-fg"}`}>{route.method}</span>
                <code className="min-w-0 font-mono text-[13px] break-words text-ink">{route.path}</code>
              </div>
              <p className="text-[14px] text-ink-2">{route.summary}</p>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-[14px] font-semibold text-ink">Request</h3>
            <Code label="Example request">{CURL}</Code>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="text-[14px] font-semibold text-ink">Answer</h3>
            <Code label="Example answer">{ANSWER}</Code>
          </div>
        </div>
        <ul className="grid gap-2 text-[14px] text-ink-2 md:grid-cols-2">
          <li>
            <strong className="text-ink">400</strong> an argument is wrong or one the call does not take. An <code className="font-mono text-[13px]">org_id</code>, <code className="font-mono text-[13px]">user_id</code> or role is always refused.
          </li>
          <li>
            <strong className="text-ink">401</strong> no token, or one that has expired.
          </li>
          <li>
            <strong className="text-ink">403</strong> your plan or role does not allow it.
          </li>
          <li>
            <strong className="text-ink">404 / 409</strong> not found, or it conflicts (the site already has a live agreement, the plan limit).
          </li>
          <li>
            <strong className="text-ink">429</strong> over the plan&apos;s calls a minute; wait for <code className="font-mono text-[13px]">Retry-After</code> seconds.
          </li>
        </ul>
        <p className="max-w-[70ch] text-[14px] text-ink-2">The two write calls only start a draft and fill its service lines. Nothing is sent to a customer, signed, cancelled or repriced through the API.</p>
      </Section>

      <Section id="ai" title="Connect an AI client (MCP)">
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          Add <code className="rounded bg-board px-1.5 py-0.5 font-mono text-[13px]">{ORIGIN}/api/mcp</code> as a remote MCP server in a client such as Claude. The client sends you to a Service Pacts page to sign in and allow it; every call is logged by tool name
          (never the arguments or the answer). It offers the same operations as the API:
        </p>
        <ul className="grid gap-3 md:grid-cols-2">
          {AI_TOOLS.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-1 rounded-card border border-hairline bg-ground p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-[13px] font-semibold text-ink">{tool.name}</code>
                <span className="text-[12px] text-ink-nav">{tool.access === "write" ? "Business plan" : "Team plan"}</span>
              </div>
              <p className="text-[14px] text-ink-2">{tool.title}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="help" title="Questions" tone="ground">
        <p className="max-w-[70ch] text-[15px] text-ink-2">
          Need access on your plan, or a call the API does not have yet? Write to{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2">
            {SITE.supportEmail}
          </a>
          .
        </p>
      </Section>
    </SiteShell>
  );
}
