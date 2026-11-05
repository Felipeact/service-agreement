import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PortalDecider, PortalReader, PortalView, PortalViewRecorder } from "@/application/ports";
import { makeDecidePortal, makeRecordPortalView } from "@/application/use-cases";
import { portalView, TOKEN, testTokens } from "@/application/portal-view.testing";

const decide = vi.fn<PortalDecider["decide"]>();
const view = vi.fn<PortalReader["view"]>();
const record = vi.fn<PortalViewRecorder["record"]>();
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({
  getContainer: async () => ({
    decidePortal: makeDecidePortal({ view }, { decide }, testTokens),
    recordPortalView: makeRecordPortalView({ record }, testTokens),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const { decideAction, recordViewAction } = await import("./actions");

const HASH = testTokens.hash(TOKEN);
const decided = (status: "accepted" | "refused" | "changes_requested"): PortalView =>
  portalView({ agreement: { number: "AG-1052", status }, decision: { status, decidedAt: new Date("2026-10-22T17:00:00Z"), reason: null } });

beforeEach(() => {
  vi.clearAllMocks();
  decide.mockResolvedValue({ ok: true });
  view.mockResolvedValue(portalView());
  record.mockResolvedValue();
});

describe("decideAction", () => {
  test("C919: accept answers ok, sends the hash and the accepted event, and refreshes the page", async () => {
    expect(await decideAction(TOKEN, "accept", "")).toEqual({ status: "ok" });
    expect(decide).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledWith(HASH, { type: "agreement.accepted", entityType: "agreement", from: "sent", to: "accepted", data: {} });
    expect(revalidatePath).toHaveBeenCalledWith(`/review/${TOKEN}`);
  });

  test("C919: the token itself never reaches the database", async () => {
    await decideAction(TOKEN, "accept", "");
    expect(JSON.stringify(decide.mock.calls)).not.toContain(TOKEN);
  });

  test.each([
    ["refuse", "refused", "agreement.refused"],
    ["request_changes", "changes_requested", "agreement.changes_requested"],
  ] as const)("C920: %s sends the trimmed reason and the %s event", async (decision, to, type) => {
    expect(await decideAction(TOKEN, decision, "  Too dear  ")).toEqual({ status: "ok" });
    expect(decide).toHaveBeenCalledWith(HASH, { type, entityType: "agreement", from: "sent", to, data: { reason: "Too dear" } });
  });

  test.each(["refuse", "request_changes"])("C921: %s with an empty, blank or whitespace-only reason is refused before any call", async (decision) => {
    for (const reason of ["", "   ", "\t\n "]) {
      expect(await decideAction(TOKEN, decision, reason)).toEqual({ status: "reason_required" });
    }
    expect(decide).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test.each(["refuse", "request_changes"])("C922: %s takes 2000 characters and refuses 2001, before any call", async (decision) => {
    expect(await decideAction(TOKEN, decision, "x".repeat(2000))).toEqual({ status: "ok" });
    expect(decide).toHaveBeenCalledTimes(1);
    decide.mockClear();
    expect(await decideAction(TOKEN, decision, "x".repeat(2001))).toEqual({ status: "reason_too_long" });
    expect(await decideAction(TOKEN, decision, `  ${"x".repeat(2000)}  `)).toEqual({ status: "ok" });
    expect(decide).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["the version is no longer current", portalView({ link: { versionNo: 1, current: false, revoked: false, revokedAt: null, firstViewedAt: null } }), "superseded"],
    ["the agreement was withdrawn", portalView({ agreement: { number: "AG-1052", status: "withdrawn" } }), "withdrawn"],
    ["the agreement was already accepted", decided("accepted"), "decided"],
    ["the link was revoked", portalView({ link: { versionNo: 1, current: true, revoked: true, revokedAt: new Date(), firstViewedAt: null } }), "replaced"],
  ] as const)("C923: when %s the answer is not_open with the state the link is in", async (_cause, now, state) => {
    decide.mockResolvedValue({ ok: false, code: "not_open" });
    view.mockResolvedValue(now);
    expect(await decideAction(TOKEN, "refuse", "Too dear")).toEqual({ status: "not_open", state });
    expect(revalidatePath).toHaveBeenCalledWith(`/review/${TOKEN}`);
  });

  test("C923: a link nobody has is not_open and unknown", async () => {
    decide.mockResolvedValue({ ok: false, code: "not_open" });
    view.mockResolvedValue(null);
    expect(await decideAction(TOKEN, "accept", "")).toEqual({ status: "not_open", state: "unknown" });
  });

  test("C923: a malformed token is not_open and unknown, with no call", async () => {
    expect(await decideAction("short", "accept", "")).toEqual({ status: "not_open", state: "unknown" });
    expect(decide).not.toHaveBeenCalled();
    expect(view).not.toHaveBeenCalled();
  });

  test.each([
    ["accept", "accepted"],
    ["refuse", "refused"],
    ["request_changes", "changes_requested"],
  ] as const)("C924: the second %s of the same decision answers ok, not an error", async (decision, status) => {
    expect(await decideAction(TOKEN, decision, "Too dear")).toEqual({ status: "ok" });
    decide.mockResolvedValue({ ok: false, code: "not_open" });
    view.mockResolvedValue(decided(status));
    expect(await decideAction(TOKEN, decision, "Too dear")).toEqual({ status: "ok" });
  });

  test("C924: a different decision after one was made is not_open and decided", async () => {
    decide.mockResolvedValue({ ok: false, code: "not_open" });
    view.mockResolvedValue(decided("accepted"));
    expect(await decideAction(TOKEN, "refuse", "Too dear")).toEqual({ status: "not_open", state: "decided" });
  });

  test("C919: an unexpected failure is unavailable and logs the cause without the token", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    decide.mockRejectedValue(new Error("Supabase error XX000: boom"));
    expect(await decideAction(TOKEN, "accept", "")).toEqual({ status: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0])).toContain("XX000");
    expect(String(error.mock.calls[0])).not.toContain(TOKEN);
    error.mockRestore();
  });

  test("C919: a decision that is none of the three is refused without a call", async () => {
    expect(await decideAction(TOKEN, "withdraw", "")).toEqual({ status: "unavailable" });
    expect(decide).not.toHaveBeenCalled();
  });
});

describe("recordViewAction", () => {
  test("C929: it records the view of the hash of the token and answers ok", async () => {
    expect(await recordViewAction(TOKEN)).toEqual({ status: "ok" });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(HASH);
  });

  test("C929: a token that cannot be a link records nothing", async () => {
    expect(await recordViewAction("short")).toEqual({ status: "ok" });
    expect(record).not.toHaveBeenCalled();
  });

  test("C929: a failure is unavailable and is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    record.mockRejectedValue(new Error("Supabase error XX000: boom"));
    expect(await recordViewAction(TOKEN)).toEqual({ status: "unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
