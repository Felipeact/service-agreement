/**
 * The portal's own pure logic: its tabs, and how the activity log is summarised. Pure: the caller passes the time as a number, so
 * nothing here reads a clock, the database or the network.
 */

export type PortalTab = { href: string; label: string };

export const PORTAL_TABS: readonly PortalTab[] = [
  { href: "/", label: "Overview" },
  { href: "/reference", label: "API reference" },
  { href: "/mcp", label: "Connect AI (MCP)" },
  { href: "/logs", label: "Activity log" },
];

/** The tab whose address is the longest prefix of the path, so `/logs` is Logs and `/` is only Overview. */
export function activeTab(pathname: string): string {
  const path = pathname.split("?")[0].replace(/(.)\/$/, "$1");
  return [...PORTAL_TABS].sort((a, b) => b.href.length - a.href.length).find((tab) => path === tab.href || (tab.href !== "/" && path.startsWith(`${tab.href}/`)))?.href ?? PORTAL_TABS[0].href;
}

export type ActivityDoor = "mcp" | "api" | "app";

/** One audited tool call: when, which tool, through which door, whether it worked, and the member. Never arguments or answers. */
export type ActivityRow = { at: Date; tool: string; door: ActivityDoor; ok: boolean; userId: string };

export type ActivitySummary = {
  total: number;
  failed: number;
  byDoor: { api: number; mcp: number };
  last24Hours: number;
  lastCallAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Counts over the rows given (newest first, as the log reads them). `nowMs` is the current time in milliseconds. */
export function summariseActivity(rows: readonly ActivityRow[], nowMs: number): ActivitySummary {
  return {
    total: rows.length,
    failed: rows.filter((row) => !row.ok).length,
    byDoor: { api: rows.filter((row) => row.door === "api").length, mcp: rows.filter((row) => row.door === "mcp").length },
    last24Hours: rows.filter((row) => nowMs - row.at.getTime() < DAY_MS).length,
    lastCallAt: rows.length > 0 ? rows[0].at : null,
  };
}

const DOOR_LABEL: Record<ActivityDoor, string> = { api: "API", mcp: "MCP", app: "In app" };
export const doorLabel = (door: ActivityDoor): string => DOOR_LABEL[door];

/** `search_customers` as "Search customers". */
export const toolLabel = (tool: string): string => {
  const words = tool.replace(/_/g, " ").trim();
  return words === "" ? tool : words.charAt(0).toUpperCase() + words.slice(1);
};
