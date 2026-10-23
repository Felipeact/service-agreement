import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const signOut = vi.fn(async () => {});
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, signOut }) }));
vi.mock("next/navigation", () => ({ redirect, usePathname: () => "/pipeline" }));

const { MemberGate } = await import("./member-gate");
const { signOutAction } = await import("./actions");

async function renderLayout() {
  const element = await MemberGate({ children: createElement("p", null, "page body") });
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

beforeEach(() => {
  vi.clearAllMocks();
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
