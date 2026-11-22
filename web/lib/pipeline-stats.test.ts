import { describe, expect, test } from "vitest";
import type { PipelineCard } from "@/application/ports";
import { FRESH_UNDER_DAYS, pipelineStats } from "./pipeline-stats";

const card = (patch: Partial<PipelineCard>): PipelineCard => ({
  id: "a",
  stage: "in_progress",
  status: "draft",
  site: "Harbour Tower",
  customer: "Harbour Strata",
  number: "AG-1",
  versionNo: 1,
  ageDays: 3,
  isRenewal: false,
  ...patch,
});

/** The 21st: a card closed within the last 20 days closed this month. */
const TODAY = "2027-11-21";

describe("pipelineStats", () => {
  test("pipeline value is the annual money of the open stages only, with the unpriced ones counted apart", () => {
    const stats = pipelineStats(
      [
        card({ id: "1", stage: "in_progress", annualCents: 100_00 }),
        card({ id: "2", stage: "sent", annualCents: 250_00 }),
        card({ id: "3", stage: "accepted" }),
        card({ id: "4", stage: "completed", annualCents: 900_00 }),
        card({ id: "5", stage: "refused", annualCents: 700_00 }),
      ],
      TODAY,
    );
    expect(stats.openCents).toBe(350_00);
    expect(stats.openCount).toBe(3);
    expect(stats.unpricedCount).toBe(1);
  });

  test("aging under 14 days counts open cards only, and the boundary day is not fresh", () => {
    const stats = pipelineStats(
      [card({ id: "1", ageDays: FRESH_UNDER_DAYS - 1 }), card({ id: "2", ageDays: FRESH_UNDER_DAYS }), card({ id: "3", stage: "completed", ageDays: 1 })],
      TODAY,
    );
    expect(stats.freshCount).toBe(1);
  });

  test("follow-ups are the cards that need the estimator", () => {
    expect(pipelineStats([card({ id: "1", attention: "Needs review" }), card({ id: "2" })], TODAY).followUpCount).toBe(1);
  });

  test("won this month: completed cards changed on or after the first, with their money", () => {
    const stats = pipelineStats(
      [
        card({ id: "1", stage: "completed", ageDays: 20, annualCents: 100_00 }),
        card({ id: "2", stage: "completed", ageDays: 0, annualCents: 50_00 }),
        card({ id: "3", stage: "completed", ageDays: 21, annualCents: 999_00 }),
      ],
      TODAY,
    );
    expect(stats.signedCount).toBe(2);
    expect(stats.signedCents).toBe(150_00);
  });

  test("win rate is signed over everything closed this month, refused and expired included; null when nothing closed", () => {
    const closed = [
      card({ id: "1", stage: "completed", ageDays: 2 }),
      card({ id: "2", stage: "completed", ageDays: 5 }),
      card({ id: "3", stage: "refused", ageDays: 6 }),
      card({ id: "4", stage: "refused", ageDays: 40 }),
    ];
    expect(pipelineStats(closed, TODAY).winRate).toBe(67);
    expect(pipelineStats([card({ id: "5" })], TODAY).winRate).toBeNull();
  });

  test("a business day that is not a date counts nothing as this month", () => {
    const stats = pipelineStats([card({ stage: "completed", ageDays: 0, annualCents: 100_00 })], "");
    expect(stats.signedCount).toBe(0);
    expect(stats.winRate).toBeNull();
  });

  test("in progress: how many, the average visits a year of the priced ones, and the distinct sites", () => {
    const stats = pipelineStats(
      [
        card({ id: "1", site: "A", annualCents: 1, visitsPerYear: 2 }),
        card({ id: "2", site: "A", annualCents: 1, visitsPerYear: 3 }),
        card({ id: "3", site: "B" }),
        card({ id: "4", stage: "sent", site: "C", annualCents: 1, visitsPerYear: 12 }),
      ],
      TODAY,
    );
    expect(stats.inProgress).toEqual({ count: 3, averageVisits: 2.5, siteCount: 2 });
    expect(pipelineStats([card({})], TODAY).inProgress.averageVisits).toBeNull();
  });

  test("an empty board is all zeros", () => {
    expect(pipelineStats([], TODAY)).toMatchObject({ openCents: 0, openCount: 0, signedCount: 0, winRate: null, inProgress: { count: 0, averageVisits: null, siteCount: 0 } });
  });
});
