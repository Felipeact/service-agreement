import { describe, expect, test, vi } from "vitest";
import type { ImportReview, ImportRowView } from "@/application/ports";
import { makeFixImportRows } from "./fix-import-rows";

const row = (position: number, over: Partial<ImportRowView> = {}): ImportRowView => ({
  id: `r${position}`,
  position,
  assetTypeRaw: "Rooftop unit",
  assetTypeId: null,
  unitNo: null,
  typeModel: null,
  location: null,
  confidence: "high",
  sourceRef: null,
  skipped: false,
  assetId: null,
  ...over,
});

const key = (raw: string | null) => (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function setup(initial: ImportRowView[], status: ImportReview["job"]["status"] = "extracted") {
  let current = initial.map((entry) => ({ ...entry }));
  const forJob = vi.fn(async (): Promise<ImportReview | null> => ({ job: { id: "j1", siteId: "s1", siteName: "Pender", originalName: "x.csv", status, committed: null }, rows: current.map((entry) => ({ ...entry })) }));
  const mapType = vi.fn(async (_job: string, wording: string, typeId: string) => {
    let count = 0;
    current = current.map((entry) => {
      if (entry.assetTypeId === null && key(entry.assetTypeRaw) === wording) {
        count += 1;
        return { ...entry, assetTypeId: typeId };
      }
      return entry;
    });
    return { ok: true as const, rows: count };
  });
  const update = vi.fn(async (id: string, value: { assetTypeId: string; unitNo: string | null; typeModel: string | null; location: string | null }) => {
    current = current.map((entry) => (entry.id === id ? { ...entry, ...value } : entry));
    return { ok: true as const };
  });
  const setSkipped = vi.fn(async (id: string, skipped: boolean) => {
    current = current.map((entry) => (entry.id === id ? { ...entry, skipped } : entry));
    return { ok: true as const };
  });
  const resolveTypes = vi.fn(async (_org: string, spellings: (string | null)[]) => ({
    byKey: new Map(spellings.map((raw) => [key(raw), { typeId: raw ? "t-new" : "t-other", code: "X", name: raw ? "Rooftop unit" : "Other equipment", created: !raw }])),
    failed: [] as string[],
  }));
  const fix = makeFixImportRows({ review: { forJob }, rows: { update, setSkipped, mapType }, resolveTypes, siteAssets: async () => [] });
  return { fix, mapType, update, setSkipped, resolveTypes, rows: () => current };
}

describe("fixImportRows", () => {
  test("types every untyped row once per wording, with no screen in between", async () => {
    const { fix, mapType, rows } = setup([row(1), row(2), row(3, { assetTypeRaw: "Walk-in cooler" })]);
    const result = await fix("org", "j1");
    expect(result).toMatchObject({ ok: true, typed: 3, unresolved: 0 });
    expect(mapType).toHaveBeenCalledTimes(2);
    expect(rows().every((entry) => entry.assetTypeId !== null)).toBe(true);
  });

  test("a row with no wording gets the fallback type one by one, and its new type is reported", async () => {
    const { fix, update, rows } = setup([row(1, { assetTypeRaw: null, unitNo: "7" })]);
    const result = await fix("org", "j1");
    expect(update).toHaveBeenCalledWith("r1", { assetTypeId: "t-other", unitNo: "7", typeModel: null, location: null });
    expect(result).toMatchObject({ ok: true, newTypes: ["Other equipment"], unresolved: 0 });
    expect(rows()[0].assetTypeId).toBe("t-other");
  });

  test("a field over the form's limit is cut, not left to block the commit", async () => {
    const { fix, rows } = setup([row(1, { assetTypeId: "t1", typeModel: "m".repeat(130), unitNo: "u".repeat(50) })]);
    const result = await fix("org", "j1");
    expect(result).toMatchObject({ ok: true, shortened: 1 });
    expect(rows()[0].typeModel?.length).toBe(120);
    expect(rows()[0].unitNo?.length).toBe(40);
  });

  test("a repeat of an earlier row of the same file is skipped; the first stays", async () => {
    const { fix, rows } = setup([row(1, { assetTypeId: "t1", unitNo: "A-1" }), row(2, { assetTypeId: "t1", unitNo: "a 1" }), row(3, { assetTypeId: "t1", unitNo: "B-2" })]);
    expect(await fix("org", "j1")).toMatchObject({ ok: true, skippedRepeats: 1 });
    expect(rows().map((entry) => entry.skipped)).toEqual([false, true, false]);
  });

  test("a type that could not be made leaves the row unresolved and says how many", async () => {
    const { fix, resolveTypes } = setup([row(1)]);
    resolveTypes.mockResolvedValue({ byKey: new Map(), failed: ["Rooftop unit"] });
    expect(await fix("org", "j1")).toMatchObject({ ok: true, unresolved: 1 });
  });

  test("a job not extracted is refused", async () => {
    const { fix } = setup([row(1)], "committed");
    expect(await fix("org", "j1")).toEqual({ ok: false, code: "not_ready" });
  });
});
