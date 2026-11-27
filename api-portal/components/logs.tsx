import Link from "next/link";
import { doorLabel, toolLabel, type ActivitySummary } from "@/lib/developer";
import type { LogFilter, LogLine } from "@/lib/logs";

const when = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Vancouver" });

const FILTERS: { label: string; href: string; matches: (filter: LogFilter) => boolean }[] = [
  { label: "All calls", href: "/logs", matches: (filter) => !filter.door && !filter.failedOnly },
  { label: "API", href: "/logs?door=api", matches: (filter) => filter.door === "api" && !filter.failedOnly },
  { label: "MCP", href: "/logs?door=mcp", matches: (filter) => filter.door === "mcp" && !filter.failedOnly },
  { label: "Refused or failed", href: "/logs?result=failed", matches: (filter) => filter.failedOnly },
];

/** The company's API and MCP calls, newest first: when, the call, the door, the member and the outcome. Never what was asked or answered. */
export function LogsView({ filter, lines, summary }: { filter: LogFilter; lines: LogLine[] | null; summary: ActivitySummary | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav aria-label="Filter the log" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => {
            const isActive = item.matches(filter);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "true" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium whitespace-nowrap ${isActive ? "border-action bg-action-tint text-action-press" : "border-hairline bg-surface text-ink-nav hover:bg-board"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {summary && (
          <p className="text-[13px] text-ink-nav">
            Last 30 days: {summary.total} {summary.total === 1 ? "call" : "calls"}, {summary.failed} refused or failed.
          </p>
        )}
      </div>

      {lines === null ? (
        <p role="status" className="rounded-card border border-hairline bg-surface p-5 text-[14px] text-ink-2">
          The activity could not be read right now. Try again in a moment.
        </p>
      ) : lines.length === 0 ? (
        <div className="rounded-card border border-hairline bg-surface p-8 text-center">
          <h2 className="text-[16px] font-semibold text-ink">{filter.door || filter.failedOnly ? "No calls match" : "No calls yet"}</h2>
          <p className="mx-auto mt-1 max-w-[46ch] text-[14px] text-ink-nav">
            {filter.door || filter.failedOnly ? "Try another filter." : "Calls made through the API or an AI client appear here, with the member who made them."}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {lines.map((line, index) => (
              <li key={`${line.at.getTime()}-${index}`} className="flex flex-col gap-1 rounded-card border border-hairline bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{toolLabel(line.tool)}</span>
                  <Outcome ok={line.ok} />
                </div>
                <p className="text-[13px] text-ink-nav">
                  {doorLabel(line.door)} · {line.who}
                </p>
                <p className="text-[12px] text-ink-2">{when.format(line.at)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-hidden rounded-card border border-hairline bg-surface md:block">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">API and MCP calls in the last 30 days, newest first</caption>
              <thead className="border-b border-hairline bg-board text-[12px] tracking-wide text-ink-nav uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">When</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Call</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Door</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {lines.map((line, index) => (
                  <tr key={`${line.at.getTime()}-${index}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-2">{when.format(line.at)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{toolLabel(line.tool)}</td>
                    <td className="px-4 py-3 text-ink-2">{doorLabel(line.door)}</td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-ink-2">{line.who}</td>
                    <td className="px-4 py-3">
                      <Outcome ok={line.ok} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-ink-2">Showing up to 100 of the latest calls. Only the call, the door, the member, the time and the result are kept; never what was asked or answered.</p>
        </>
      )}
    </div>
  );
}

function Outcome({ ok }: { ok: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${ok ? "bg-action-tint text-action-press" : "bg-danger-tint text-danger"}`}>{ok ? "Worked" : "Refused or failed"}</span>;
}
