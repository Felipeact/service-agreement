import { describe, expect, test } from "vitest";
import { FOLLOW_UP_AFTER_DAYS, followUpLabel, isClosedStage, needsFollowUp, sortForColumn } from "./index";

describe("follow-up: how long a deal may sit before the estimator chases it", () => {
  test.each([
    ["in_progress", 13, null],
    ["in_progress", 14, "Idle for 14 days"],
    ["sent", 6, null],
    ["sent", 7, "No reply in 7 days"],
    ["sent", 31, "No reply in 31 days"],
    ["accepted", 6, null],
    ["accepted", 12, "Unsigned for 12 days"],
  ] as const)("%s at %i days reads %j", (stage, ageDays, label) => {
    expect(followUpLabel({ stage, ageDays })).toBe(label);
  });

  test("closed stages never ask for a follow-up, however old", () => {
    for (const stage of ["completed", "refused"] as const) {
      expect(followUpLabel({ stage, ageDays: 400 })).toBeNull();
      expect(needsFollowUp({ stage, ageDays: 400, attention: "Changes requested" })).toBe(false);
      expect(isClosedStage(stage)).toBe(true);
    }
    for (const stage of ["in_progress", "sent", "accepted"] as const) expect(isClosedStage(stage)).toBe(false);
  });

  test("an accepted deal that already says it awaits countersignature is not also called unsigned", () => {
    expect(followUpLabel({ stage: "accepted", ageDays: 20, attention: "Awaiting countersignature" })).toBeNull();
    expect(needsFollowUp({ stage: "accepted", ageDays: 1, attention: "Awaiting countersignature" })).toBe(true);
  });

  test("a changes-requested draft needs follow-up at once and also reads idle once it is old", () => {
    expect(needsFollowUp({ stage: "in_progress", ageDays: 1, attention: "Changes requested" })).toBe(true);
    expect(followUpLabel({ stage: "in_progress", ageDays: 20, attention: "Changes requested" })).toBe("Idle for 20 days");
  });

  test("a fresh deal with nothing to say does not need follow-up", () => {
    expect(needsFollowUp({ stage: "sent", ageDays: 2 })).toBe(false);
  });

  test("the thresholds are one table the board, filter and counts all read", () => {
    expect(FOLLOW_UP_AFTER_DAYS).toEqual({ in_progress: 14, sent: 7, accepted: 7 });
  });
});

describe("sortForColumn", () => {
  const cards = [
    { id: "a", stage: "sent", ageDays: 2 },
    { id: "b", stage: "sent", ageDays: 30 },
    { id: "c", stage: "sent", ageDays: 9 },
  ] as const;

  test("an open column lists the longest-waiting deal first", () => {
    expect(sortForColumn("sent", cards).map((card) => card.id)).toEqual(["b", "c", "a"]);
  });

  test("a closed column keeps the order it was given", () => {
    expect(sortForColumn("completed", cards).map((card) => card.id)).toEqual(["a", "b", "c"]);
  });

  test("it never mutates its input", () => {
    const before = cards.map((card) => card.id);
    sortForColumn("sent", cards);
    expect(cards.map((card) => card.id)).toEqual(before);
  });
});
