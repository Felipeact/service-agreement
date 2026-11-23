import { describe, expect, it } from "vitest";
import { isReadyToSend, isSectionDone, sendReadiness, type ReadinessInput } from "./readiness";

const ready: ReadinessInput = {
  equipment: [{ units: 7 }, { units: 40 }],
  uncovered: [],
  linePrices: [34_000, 369_000],
  termStart: "2027-01-01",
  company: { ready: true, name: "Blue Heron Mechanical" },
  hourlyRateCents: 13_500,
};

describe("sendReadiness", () => {
  it("is all done for a complete draft, in the order of the page", () => {
    const items = sendReadiness(ready);
    expect(items.map((item) => item.key)).toEqual(["equipment", "coverage", "prices", "term", "company"]);
    expect(isReadyToSend(items)).toBe(true);
    expect(items[0].detail).toBe("2 kinds, 47 units");
    expect(items[2].detail).toBe("Labour at $135 an hour");
  });

  it("opens the term without a start date, and only its section", () => {
    const items = sendReadiness({ ...ready, termStart: null });
    expect(isReadyToSend(items)).toBe(false);
    expect(items.filter((item) => !item.done).map((item) => item.key)).toEqual(["term"]);
    expect(isSectionDone(items, "term")).toBe(false);
    expect(isSectionDone(items, "lines")).toBe(true);
  });

  it("names uncovered types and counts $0 lines", () => {
    const items = sendReadiness({ ...ready, uncovered: [{ name: "Boiler" }], linePrices: [0, 5_000, 0] });
    expect(items[1]).toMatchObject({ done: false, detail: "Boiler not covered" });
    expect(items[2]).toMatchObject({ done: false, detail: "2 at $0" });
    expect(isSectionDone(items, "lines")).toBe(false);
  });

  it("is open with no lines or no equipment, and says what to do", () => {
    const items = sendReadiness({ ...ready, equipment: [], linePrices: [] });
    expect(items[0]).toMatchObject({ done: false, detail: "None yet. Add equipment or upload a list." });
    expect(items[1]).toMatchObject({ done: false, detail: "No service lines yet" });
    expect(items[2].done).toBe(false);
  });

  it("sends the company to Settings when it is not confirmed", () => {
    expect(sendReadiness({ ...ready, company: { ready: false, name: null } })[4]).toMatchObject({ done: false, detail: "Check them in Settings" });
  });
});
