import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const draftCatalog = vi.fn();
const acceptCatalogDraft = vi.fn();
const redirect = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, draftCatalog, acceptCatalogDraft }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
// Next's redirect() throws to stop the action; the double does the same.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { draftCatalogAction, acceptDraftAction } = await import("./draft-actions");

const idle = { status: "idle" } as const;
const types = [{ name: "Termite inspection", months: [3, 9], tasks: ["Check bait stations"] }];

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "owner@example.com", orgId: "org-1", orgName: "Org", role: "owner" });
  draftCatalog.mockResolvedValue({ ok: true, trade: "pest control", types });
  acceptCatalogDraft.mockResolvedValue({ ok: true, added: 1 });
});

describe("draftCatalogAction", () => {
  test("C4120: a full draft run returns the draft and makes no write", async () => {
    const result = await draftCatalogAction(idle, form({ trade: "pest control", notes: "Commercial kitchens" }));
    expect(result).toEqual({ status: "drafted", trade: "pest control", types });
    expect(draftCatalog).toHaveBeenCalledWith({ role: "owner", trade: "pest control", notes: "Commercial kitchens", file: undefined });
    expect(acceptCatalogDraft).not.toHaveBeenCalled();
  });

  test("C4110: an attached file goes to the use case as its name and bytes; an empty file input is no file", async () => {
    await draftCatalogAction(idle, form({ trade: "pest control", notes: "", file: new File([new Uint8Array([1, 2, 3])], "proposal.pdf") }));
    expect(draftCatalog.mock.calls[0][0].file).toEqual({ name: "proposal.pdf", bytes: new Uint8Array([1, 2, 3]) });
    draftCatalog.mockClear();
    await draftCatalogAction(idle, form({ trade: "pest control", notes: "", file: new File([], "") }));
    expect(draftCatalog.mock.calls[0][0].file).toBeUndefined();
  });

  test("C4111: a file over 4,194,304 bytes is too_large before anything is read or sent", async () => {
    const big = new File([new Uint8Array(4_194_305)], "big.pdf");
    const result = await draftCatalogAction(idle, form({ trade: "pest control", notes: "x", file: big }));
    expect(result).toEqual({ status: "failed", code: "too_large", trade: "pest control", notes: "x" });
    expect(draftCatalog).not.toHaveBeenCalled();
  });

  test("C4106: a user with no membership reaches the use case without a role, and a signed-out visitor goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", userId: "u2", email: "x@example.com" });
    draftCatalog.mockResolvedValue({ ok: false, code: "forbidden" });
    expect(await draftCatalogAction(idle, form({ trade: "pest control", notes: "" }))).toEqual({ status: "failed", code: "forbidden", trade: "pest control", notes: "" });
    expect(draftCatalog.mock.calls[0][0].role).toBeNull();
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(draftCatalogAction(idle, form({ trade: "pest control", notes: "" }))).rejects.toThrow("NEXT_REDIRECT /login");
  });

  test("C4103: every refusal comes back as failed state that keeps the trade and notes", async () => {
    for (const code of ["invalid", "not_empty", "unreadable", "too_large", "unavailable"] as const) {
      draftCatalog.mockResolvedValue({ ok: false, code });
      expect(await draftCatalogAction(idle, form({ trade: "a;b", notes: "n" }))).toEqual({ status: "failed", code, trade: "a;b", notes: "n" });
    }
  });
});

describe("acceptDraftAction", () => {
  test("C4115: the reviewed draft goes to the use case once with the role, org and trade, and /setup is refreshed", async () => {
    const result = await acceptDraftAction(idle, form({ trade: "pest control", types: JSON.stringify(types) }));
    expect(result).toEqual({ status: "accepted", added: 1 });
    expect(acceptCatalogDraft).toHaveBeenCalledTimes(1);
    expect(acceptCatalogDraft).toHaveBeenCalledWith({ role: "owner", orgId: "org-1", trade: "pest control", types });
    expect(revalidatePath).toHaveBeenCalledWith("/setup");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C4117: a body that is not JSON is invalid and nothing is called", async () => {
    expect(await acceptDraftAction(idle, form({ trade: "pest control", types: "{nope" }))).toEqual({ status: "failed", code: "invalid" });
    expect(acceptCatalogDraft).not.toHaveBeenCalled();
  });

  test("C4118: a refusal from the use case comes back as state and refreshes nothing", async () => {
    for (const code of ["forbidden", "not_empty", "invalid", "unavailable"] as const) {
      acceptCatalogDraft.mockResolvedValue({ ok: false, code });
      expect(await acceptDraftAction(idle, form({ trade: "pest control", types: JSON.stringify(types) }))).toEqual({ status: "failed", code });
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("C4119: a signed-out visitor goes to /login and a user with no membership reaches the use case without a role", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(acceptDraftAction(idle, form({ trade: "pest control", types: "[]" }))).rejects.toThrow("NEXT_REDIRECT /login");
    currentMember.mockResolvedValue({ status: "no_membership", userId: "u2", email: "x@example.com" });
    acceptCatalogDraft.mockResolvedValue({ ok: false, code: "forbidden" });
    await acceptDraftAction(idle, form({ trade: "pest control", types: "[]" }));
    expect(acceptCatalogDraft.mock.calls[0][0].role).toBeNull();
  });
});
