import { describe, expect, test } from "vitest";
import { fixedClock, systemClock } from "./index";

describe("clock", () => {
  test("C20: systemClock.now() is within 1000 ms of the real time", () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(now.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  test("C21: fixedClock(d).now() returns d on every call", () => {
    const clock = fixedClock(new Date("2026-10-23T12:00:00Z"));
    for (let i = 0; i < 3; i++) {
      expect(clock.now().toISOString()).toBe("2026-10-23T12:00:00.000Z");
    }
  });
});
