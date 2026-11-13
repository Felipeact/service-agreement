import { describe, expect, test } from "vitest";
import { updatedAgo } from "./relative-time";

const NOW = new Date("2026-11-12T18:00:00Z");
const daysBefore = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("updatedAgo", () => {
  test.each([
    [0, "Updated today"],
    [1, "Updated 1 day ago"],
    [6, "Updated 6 days ago"],
    [7, "Updated 1 week ago"],
    [14, "Updated 2 weeks ago"],
    [30, "Updated 1 month ago"],
    [200, "Updated 6 months ago"],
    [400, "Updated 1 year ago"],
  ])("C5342: %s days ago reads %s", (days, text) => {
    expect(updatedAgo(daysBefore(days), NOW)).toBe(text);
  });

  test("C5342: a time in the future reads today", () => {
    expect(updatedAgo(new Date("2026-11-13T00:00:00Z"), NOW)).toBe("Updated today");
  });
});
