import Link from "next/link";
import { accessOf, type AccessLevel } from "@/domain/billing/plan-access";
import { planDisplayName } from "@/domain/billing/plan-limits";
import { API_BASE_PATH } from "@/domain/public-api";
import type { ActivitySummary } from "@/lib/developer";
import { CopyField } from "@/components/copy-field";

const LEVEL: Record<AccessLevel, string> = { none: "Not included", read: "Read only", write: "Read and create drafts" };
const when = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" });

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card border border-hairline bg-surface p-5 shadow-lift">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[14px]">
      <dt className="text-ink-nav">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

/** The API and MCP overview: what the plan includes, the two addresses to copy, and the last 30 days at a glance. */
export function Overview({ plan, origin, activity }: { plan: string; origin: string; activity: ActivitySummary | null }) {
  const access = accessOf(plan);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Your plan">
          <dl className="flex flex-col gap-2">
            <Row label="Plan" value={planDisplayName(plan)} />
            <Row label="API" value={LEVEL[access.api]} />
            <Row label="AI connection (MCP)" value={LEVEL[access.mcp]} />
            <Row label="Calls a minute" value={access.callsPerMinute} />
          </dl>
          <p className="text-[13px] text-ink-nav">Draft writes need the Business plan. Every call acts as the member who signed in, so it sees only what that member sees.</p>
        </Card>
        <Card title="Last 30 days">
          {activity === null ? (
            <p role="status" className="text-[14px] text-ink-2">
              The activity could not be read right now. Try again in a moment.
            </p>
          ) : (
            <dl className="flex flex-col gap-2">
              <Row label="Calls" value={activity.total} />
              <Row label="API / MCP" value={`${activity.byDoor.api} / ${activity.byDoor.mcp}`} />
              <Row label="Refused or failed" value={activity.failed} />
              <Row label="Last 24 hours" value={activity.last24Hours} />
              <Row label="Last call" value={activity.lastCallAt ? when.format(activity.lastCallAt) : "None yet"} />
            </dl>
          )}
          <Link href="/logs" className="inline-flex min-h-11 items-center text-[14px] font-semibold text-action hover:underline">
            Open the activity log
          </Link>
        </Card>
        <Card title="Where to start">
          <ul className="flex flex-col gap-1 text-[14px]">
            <li>
              <Link href="/reference" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline">
                Browse and try the API
              </Link>
            </li>
            <li>
              <Link href="/mcp" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline">
                Connect Claude or another AI client
              </Link>
            </li>
            <li>
              <Link href="/logs" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline">
                See who called what, and when
              </Link>
            </li>
          </ul>
        </Card>
      </div>
      <Card title="Addresses">
        <div className="grid gap-4 lg:grid-cols-2">
          <CopyField label="REST API base address" value={`${origin}${API_BASE_PATH}`} />
          <CopyField label="MCP server address" value={`${origin}/api/mcp`} />
        </div>
      </Card>
    </div>
  );
}
