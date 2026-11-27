import { describe, expect, it } from "vitest";
import { accessOf, cheapestPlanFor, planAccessMessage, planAllows } from "./plan-access";

describe("plan access", () => {
  it("gives Starter neither door", () => {
    expect(planAllows("starter", "mcp", "read")).toBe(false);
    expect(planAllows("starter", "api", "read")).toBe(false);
  });
  it("gives Team reads on both doors and no writes", () => {
    expect(planAllows("team", "mcp", "read")).toBe(true);
    expect(planAllows("team", "api", "read")).toBe(true);
    expect(planAllows("team", "mcp", "write")).toBe(false);
    expect(planAllows("team", "api", "write")).toBe(false);
  });
  it("gives Business reads and writes", () => {
    expect(planAllows("business", "mcp", "write")).toBe(true);
    expect(planAllows("business", "api", "write")).toBe(true);
  });
  it("gives an unknown or missing plan nothing", () => {
    expect(planAllows(null, "api", "read")).toBe(false);
    expect(planAllows("gold", "mcp", "read")).toBe(false);
    expect(accessOf(undefined).callsPerMinute).toBe(0);
  });
  it("names the cheapest plan that reaches a level", () => {
    expect(cheapestPlanFor("api", "read")).toBe("Team");
    expect(cheapestPlanFor("mcp", "write")).toBe("Business");
  });
  it("tells a refused caller what to do", () => {
    expect(planAccessMessage("api", "read", "starter")).toContain("Team plan and above");
    expect(planAccessMessage("mcp", "write", "team")).toContain("Business");
  });
});
