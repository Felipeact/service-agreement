import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const signOut = vi.fn(async () => {});
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

const pipelineBoard = vi.fn(async () => [] as unknown[]);
const getItemWords = vi.fn(async () => ({ singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" }));
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, signOut, pipelineBoard, getItemWords, clock: { now: () => new Date("2027-12-01T17:00:00Z") } }) }));
vi.mock("next/navigation", () => ({ redirect, usePathname: () => "/pipeline" }));

const { MemberGate } = await import("./member-gate");
const { signOutAction } = await import("./actions");

async function renderLayout() {
  const element = await MemberGate({ children: createElement("p", null, "page body") });
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

beforeEach(() => {
  vi.clearAllMocks();
  getItemWords.mockResolvedValue({ singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" });
});

describe("(app) layout", () => {
  test("C16: a signed-out request is sent to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });

    await expect(renderLayout()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  test("C18: a member sees their company and email in the shell", async () => {
    currentMember.mockResolvedValue({
      status: "member",
      userId: "u1",
      email: "owner@example.com",
      orgId: "o1",
      orgName: "Kettle Ridge Mechanical Ltd.",
      role: "owner",
    });
    const html = await renderLayout();

    expect(html).toContain("Kettle Ridge Mechanical Ltd.");
    expect(html).toContain("owner@example.com");
    expect(html).toContain("page body");
  });

  const owner: CurrentMember = { status: "member", userId: "u1", email: "owner@example.com", orgId: "o1", orgName: "Kettle Ridge Mechanical Ltd.", role: "owner" };

  test("the top bar names today and the bell links to the follow-ups with their count", async () => {
    currentMember.mockResolvedValue(owner);
    pipelineBoard.mockResolvedValue([
      { stage: "sent", ageDays: 12 }, // sat past the Sent limit
      { stage: "in_progress", ageDays: 1, attention: "Changes requested" },
      { stage: "sent", ageDays: 1 }, // fresh
      { stage: "completed", ageDays: 90 }, // closed, never due
    ]);
    const html = await renderLayout();
    expect(html).toContain("Wednesday, December 1");
    expect(html).toMatch(/<a(?=[^>]*href="\/pipeline\?followups=1")(?=[^>]*aria-label="2 agreements need follow-up")[^>]*>/);
  });

  test("a board that cannot be read leaves the shell up with no count", async () => {
    currentMember.mockResolvedValue(owner);
    pipelineBoard.mockRejectedValue(new Error("down"));
    const html = await renderLayout();
    expect(html).toContain("page body");
    expect(html).toContain("Follow-ups: none due");
  });

  test("C19: a user with no membership sees No workspace yet, a Sign out button and no navigation", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "owner@example.com" });
    const html = await renderLayout();

    expect(html).toContain("No workspace yet");
    expect(html).toContain("Your account isn't part of a company workspace. Ask your company's owner to invite you.");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    expect(html).not.toContain('href="/pipeline"');
    expect(html).not.toContain("page body");
  });
});

describe("sign out", () => {
  test("C21: signs out, then redirects to /login", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(redirect.mock.invocationCallOrder[0]);
  });
});

describe("(app) layout, item words", () => {
  test("C2011: the shell gets the member's org words from the container: the Sites link and a client screen under it say them", async () => {
    const { itemWords } = await import("@/domain/org-settings");
    getItemWords.mockResolvedValue(itemWords("station", "stations"));
    currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "owner@example.com", orgId: "org-9", orgName: "Kettle", role: "owner" });
    const out = await renderLayout();
    expect(out).toContain("Sites &amp; stations");
    expect(getItemWords).toHaveBeenCalledWith("org-9");
  });
});
