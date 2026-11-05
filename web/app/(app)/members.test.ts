import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, InvitationRow, MemberRole, MemberRow } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listMembers = vi.fn<() => Promise<MemberRow[]>>();
const listInvitations = vi.fn<() => Promise<InvitationRow[]>>();
const inviteMember = vi.fn();
const revokeInvitation = vi.fn();
const setMemberRole = vi.fn();
const removeMember = vi.fn();
const container = {
  currentMember,
  listMembers,
  listInvitations,
  inviteMember,
  revokeInvitation,
  setMemberRole,
  removeMember,
  clock: { now: () => new Date("2026-11-05T12:00:00Z") },
};

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound, usePathname: () => "/members" }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { MembersForRequest } = await import("./members/page");
const { inviteMemberAction, revokeInvitationAction, setMemberRoleAction, removeMemberAction } = await import("./members/actions");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u-1", email: "me@example.com", orgId: "org-1", orgName: "Northwind", role });
const MEMBERS: MemberRow[] = [
  { userId: "u-1", email: "me@example.com", role: "owner", joinedAt: new Date("2026-10-01T10:00:00Z") },
  { userId: "u-2", email: "other@example.com", role: "viewer", joinedAt: new Date("2026-10-02T10:00:00Z") },
];
const INVITATIONS: InvitationRow[] = [
  { id: "inv-1", email: "new@x.test", role: "estimator", invitedAt: new Date("2026-11-04T10:00:00Z"), expiresAt: new Date("2026-11-18T10:00:00Z") },
];

const render = async () => renderToStaticMarkup((await MembersForRequest()) as ReactElement);

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  listMembers.mockResolvedValue(MEMBERS);
  listInvitations.mockResolvedValue(INVITATIONS);
});

describe("GET /members", () => {
  test.each([
    ["signed out", { status: "signed_out" } as CurrentMember],
    ["no membership", { status: "no_membership", email: "x@example.com" } as CurrentMember],
  ])("C1505: %s is redirected to /login and nothing is read", async (_label, who) => {
    currentMember.mockResolvedValue(who);
    await expect(MembersForRequest()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(listMembers).not.toHaveBeenCalled();
    expect(listInvitations).not.toHaveBeenCalled();
  });

  test.each(["owner", "admin"] as const)("C1505: %s gets the roster and the invitations", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = await render();
    expect(listMembers).toHaveBeenCalledTimes(1);
    expect(listInvitations).toHaveBeenCalledTimes(1);
    expect(html).toContain("other@example.com");
    expect(html).toContain("new@x.test");
    expect(html).toContain("Invite someone");
  });

  test.each(["estimator", "viewer"] as const)("C1505: %s gets the roster and the invitations reader is never called", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = await render();
    expect(listMembers).toHaveBeenCalledTimes(1);
    expect(listInvitations).not.toHaveBeenCalled();
    expect(html).toContain("other@example.com");
    expect(html).not.toContain("new@x.test");
    expect(html).not.toContain("Invite someone");
  });

  test("C1505: the page never calls notFound, whoever asks", async () => {
    for (const role of ["owner", "admin", "estimator", "viewer"] as const) {
      currentMember.mockResolvedValue(member(role));
      await render();
    }
    expect(notFound).not.toHaveBeenCalled();
  });

  test("C1546: when the roster read rejects the page rejects and renders nothing", async () => {
    listMembers.mockRejectedValue(new Error("Supabase error XX000: boom"));
    await expect(MembersForRequest()).rejects.toThrow("XX000");
    listMembers.mockResolvedValue(MEMBERS);
    listInvitations.mockRejectedValue(new Error("Supabase error XX000: boom"));
    await expect(MembersForRequest()).rejects.toThrow("XX000");
  });
});

type Call = {
  name: string;
  action: (state: never, formData: FormData) => Promise<unknown>;
  port: ReturnType<typeof vi.fn>;
  fields: Record<string, string>;
  /** The arguments the port must get: ids and values, never an org. */
  args: unknown[];
  ok: unknown;
  success: unknown;
  refusals: string[];
};

const CALLS: Call[] = [
  {
    name: "inviteMember",
    action: inviteMemberAction as never,
    port: inviteMember,
    fields: { email: "pat@example.com", role: "estimator", orgId: "org-evil" },
    args: [{ email: "pat@example.com", role: "estimator" }],
    ok: { status: "sent", email: "pat@example.com" },
    success: { status: "sent", email: "pat@example.com" },
    refusals: ["invalid", "already_member", "owner_only", "rate_limited", "saved_not_sent", "forbidden", "unavailable"],
  },
  {
    name: "revokeInvitation",
    action: revokeInvitationAction as never,
    port: revokeInvitation,
    fields: { invitationId: "inv-1", orgId: "org-evil" },
    args: ["inv-1"],
    ok: { ok: true },
    success: { status: "revoked" },
    refusals: ["not_found", "forbidden", "unavailable"],
  },
  {
    name: "setMemberRole",
    action: setMemberRoleAction as never,
    port: setMemberRole,
    fields: { userId: "u-2", role: "admin", orgId: "org-evil" },
    args: ["u-2", "admin"],
    ok: { ok: true },
    success: { status: "saved" },
    refusals: ["owner_only", "last_owner", "self", "not_found", "forbidden", "unavailable"],
  },
  {
    name: "removeMember",
    action: removeMemberAction as never,
    port: removeMember,
    fields: { userId: "u-2", orgId: "org-evil" },
    args: ["u-2"],
    ok: { ok: true },
    success: { status: "removed" },
    refusals: ["owner_only", "last_owner", "self", "not_found", "forbidden", "unavailable"],
  },
];

describe("server actions", () => {
  test.each(CALLS)("C1518: $name redirects a signed-out caller to /login without calling the port", async ({ action, port, fields }) => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(action({} as never, form(fields))).rejects.toThrow("NEXT_REDIRECT /login");
    expect(port).not.toHaveBeenCalled();
  });

  test.each(CALLS.flatMap((call) => (["estimator", "viewer"] as const).map((role) => ({ ...call, role }))))(
    "C1518: $name is forbidden for a $role and never reaches the port",
    async ({ action, port, fields, role, name }) => {
      currentMember.mockResolvedValue(member(role));
      const result = (await action({} as never, form(fields))) as { status: string };
      expect(result.status).toBe("forbidden");
      if (name === "inviteMember") expect(result).toEqual({ status: "forbidden", email: "pat@example.com" });
      expect(port).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  test.each(CALLS)("C1518: $name passes the port only what the form names about the target, never an org, and returns the success state", async ({ action, port, fields, args, ok, success }) => {
    port.mockResolvedValue(ok);
    expect(await action({} as never, form(fields))).toEqual(success);
    expect(port).toHaveBeenCalledTimes(1);
    expect(port).toHaveBeenCalledWith(...args);
    expect(JSON.stringify(port.mock.calls)).not.toContain("org-evil");
    expect(JSON.stringify(port.mock.calls)).not.toContain("org-1");
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });

  test.each(CALLS.flatMap((call) => call.refusals.map((refusal) => ({ ...call, refusal }))))("C1518: $name returns $refusal as the body of the action", async ({ action, port, fields, refusal, name }) => {
    port.mockResolvedValue(name === "inviteMember" ? { status: refusal, email: "pat@example.com" } : { ok: false, code: refusal });
    const result = await action({} as never, form(fields));
    expect(result).toEqual(name === "inviteMember" ? { status: refusal, email: "pat@example.com" } : { status: refusal });
  });

  test("C1518: an owner and an admin both reach the port", async () => {
    for (const role of ["owner", "admin"] as const) {
      currentMember.mockResolvedValue(member(role));
      removeMember.mockResolvedValue({ ok: true });
      await removeMemberAction({ status: "idle" }, form({ userId: "u-2" }));
    }
    expect(removeMember).toHaveBeenCalledTimes(2);
  });

  test("C1518: a role outside the four never reaches setMemberRole", async () => {
    expect(await setMemberRoleAction({ status: "idle" }, form({ userId: "u-2", role: "root" }))).toEqual({ status: "unavailable" });
    expect(setMemberRole).not.toHaveBeenCalled();
  });
});
