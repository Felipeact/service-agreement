import Link from "next/link";
import { AI_TOOLS } from "@/domain/ai-tools";
import { accessOf } from "@/domain/billing/plan-access";
import { planDisplayName } from "@/domain/billing/plan-limits";
import { CopyField } from "@/components/copy-field";

const PROMPTS = ["Which of our agreements end in the next 60 days?", "Show me everything about Northside School: sites, contacts and agreements.", "What is our recurring revenue this year, and who are the top five customers?"];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 gap-4">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action-tint text-[14px] font-semibold text-action-press">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** How to connect an AI client to the MCP endpoint: the address, a path for Claude and for Claude Code, a generic setup, what to try, and what to do when it fails. */
export function McpGuide({ plan, origin }: { plan: string; origin: string }) {
  const url = `${origin}/api/mcp`;
  const canWrite = accessOf(plan).mcp === "write";
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-5 rounded-card border border-hairline bg-surface p-5 shadow-lift">
        <div className="flex flex-col gap-1">
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">Connect an AI client in four steps</h2>
          <p className="max-w-[70ch] text-[14px] text-ink-nav">
            MCP (Model Context Protocol) lets an AI client such as Claude read your customers, sites, agreements and reports, and ask questions in plain words. It signs in as you, so it sees only what you see. Your {planDisplayName(plan)} plan{" "}
            {canWrite ? "also lets it add customers, sites and equipment and start a draft agreement" : "lets it read; adding records and drafts is on the Business plan"}.
          </p>
        </div>
        <ol className="flex flex-col gap-6">
          <Step n={1} title="Copy the server address">
            <CopyField label="MCP server address" value={url} />
          </Step>
          <Step n={2} title="Add it to your AI client">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2 rounded-card border border-hairline p-4">
                <h4 className="text-[14px] font-semibold text-ink">Claude (app or claude.ai)</h4>
                <p className="text-[13px] text-ink-nav">Open Settings, then Connectors, choose Add custom connector, name it Service Pacts and paste the address. Menu names can differ between versions.</p>
              </div>
              <div className="flex min-w-0 flex-col gap-2 rounded-card border border-hairline p-4">
                <h4 className="text-[14px] font-semibold text-ink">Claude Code</h4>
                <CopyField label="Claude Code command" value={`claude mcp add --transport http service-pacts ${url}`} />
                <p className="text-[13px] text-ink-nav">Then run /mcp inside Claude Code and choose Authenticate.</p>
              </div>
            </div>
            <CopyField
              label="Other clients: configuration"
              multiline
              value={`{\n  "mcpServers": {\n    "service-pacts": {\n      "type": "http",\n      "url": "${url}"\n    }\n  }\n}`}
            />
            <p className="max-w-[70ch] text-[13px] text-ink-nav">Any client that supports remote MCP servers over HTTP with OAuth sign-in will work.</p>
          </Step>
          <Step n={3} title="Sign in and allow">
            <p className="max-w-[70ch] text-[14px] text-ink-2">
              The client opens a Service Pacts page. Sign in with your email link if asked, check the name of the client, and press <strong>Allow</strong>. You must be signed in to Service Pacts in that browser first.
            </p>
          </Step>
          <Step n={4} title="Try it">
            <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
              {PROMPTS.map((prompt) => (
                <li key={prompt} className="rounded-control bg-board px-3 py-2">
                  “{prompt}”
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-ink-nav">Every call you make this way is recorded.</p>
            <Link href="/logs" className="inline-flex min-h-11 w-fit items-center text-[14px] font-semibold text-action hover:underline">
              Open the activity log
            </Link>
          </Step>
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">What it can do</h2>
          <ul className="flex flex-col gap-2">
            {AI_TOOLS.map((tool) => (
              <li key={tool.name} className="flex min-w-0 flex-col gap-0.5 text-[14px]">
                <span className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-[13px] font-semibold text-ink">{tool.name}</code>
                  <span className="rounded-full bg-board px-2 py-0.5 text-[11px] font-medium text-ink-2">{tool.access === "write" ? "Business plan, owners, admins, estimators" : "Read"}</span>
                </span>
                <span className="text-ink-nav">{tool.title}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-ink-nav">It never sends, signs, cancels or reprices an agreement, and never sees another company&apos;s data.</p>
        </section>
        <section className="flex min-w-0 flex-col gap-3 rounded-card border border-hairline bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-ink">If something goes wrong</h2>
          <dl className="flex flex-col gap-3 text-[14px]">
            <div>
              <dt className="font-semibold text-ink">The client says it is unauthorized</dt>
              <dd className="text-ink-nav">Your sign-in expired. Disconnect and connect again, signing in to Service Pacts first.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">It says a plan is required</dt>
              <dd className="text-ink-nav">The connection is on the Team plan and above, and adding records and drafts on Business. An owner can change the plan in Settings, Billing.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">It says too many requests</dt>
              <dd className="text-ink-nav">Each plan has a limit of calls a minute. Wait a moment and ask again.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">It cannot create a draft</dt>
              <dd className="text-ink-nav">Only owners, admins and estimators can, on the Business plan, and a site that already has a live agreement is refused.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">To stop a connection</dt>
              <dd className="text-ink-nav">Remove the connector in your AI client. Its sign-in then expires on its own; the activity log shows when it last called.</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
