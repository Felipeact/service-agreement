import { describe, expect, it } from "vitest";
import { activeTab, doorLabel, summariseActivity, toolLabel, type ActivityRow } from "./developer";

const NOW = Date.UTC(2026, 10, 27, 12, 0, 0);
const row = (hoursAgo: number, over: Partial<ActivityRow> = {}): ActivityRow => ({ at: { getTime: () => NOW - hoursAgo * 3600_000 } as Date, tool: "who_am_i", door: "api", ok: true, userId: "u1", ...over });

describe("portal tabs", () => {
  it("picks the tab by the longest matching address", () => {
    expect(activeTab("/")).toBe("/");
    expect(activeTab("/reference")).toBe("/reference");
    expect(activeTab("/logs/")).toBe("/logs");
    expect(activeTab("/logs?door=api")).toBe("/logs");
    expect(activeTab("/elsewhere")).toBe("/");
  });
});

describe("activity summary", () => {
  it("counts calls, failures, doors and the last day", () => {
    const summary = summariseActivity([row(1), row(5, { door: "mcp", ok: false }), row(30, { door: "mcp" })], NOW);
    expect(summary).toMatchObject({ total: 3, failed: 1, byDoor: { api: 1, mcp: 2 }, last24Hours: 2 });
    expect(summary.lastCallAt).not.toBeNull();
  });
  it("handles no activity", () => {
    expect(summariseActivity([], NOW)).toEqual({ total: 0, failed: 0, byDoor: { api: 0, mcp: 0 }, last24Hours: 0, lastCallAt: null });
  });
  it("labels doors and tools", () => {
    expect(doorLabel("mcp")).toBe("MCP");
    expect(toolLabel("search_customers")).toBe("Search customers");
  });
});
