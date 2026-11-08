import { describe, expect, test, vi } from "vitest";
import { itemWordsReader } from "./item-words";

describe("the item words an org's screens read", () => {
  test("C2009: the stored words come back in all four forms for that org, and a missing row gives the default", async () => {
    const get = vi.fn(async (orgId: string) => (orgId === "org-1" ? { itemSingular: "station", itemPlural: "stations" } : null));
    const read = itemWordsReader(get);
    expect(await read("org-1")).toEqual({ singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" });
    expect(get).toHaveBeenCalledWith("org-1");
    expect(await read("org-2")).toEqual({ singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" });
  });
});
