import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";
import { DEFAULT_ITEM_WORDS, itemWords, type ItemWords } from "@/domain/org-settings";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
let words: ItemWords = DEFAULT_ITEM_WORDS;
const getItemWords = vi.fn(async () => words);

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, getItemWords }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const sites = await import("./sites/page");
const importPage = await import("./sites/[siteId]/import/page");

beforeEach(() => {
  words = DEFAULT_ITEM_WORDS;
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.com", orgId: "org-1", orgName: "Org", role: "viewer" });
});

describe("page titles, item words", () => {
  test("C2020: the tab titles of Sites and the import page name the item, and read today's for the default words", async () => {
    words = itemWords("station", "stations");
    expect((await sites.generateMetadata()).title).toBe("Sites & stations");
    expect((await importPage.generateMetadata()).title).toBe("Import station list");
    words = DEFAULT_ITEM_WORDS;
    expect((await sites.generateMetadata()).title).toBe("Sites & equipment");
    expect((await importPage.generateMetadata()).title).toBe("Import equipment list");
  });

  test("C2020: a signed-out visitor gets today's titles without the words being read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    getItemWords.mockClear();
    expect((await sites.generateMetadata()).title).toBe("Sites & equipment");
    expect(getItemWords).not.toHaveBeenCalled();
  });
});
