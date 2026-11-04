import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { InvitationRow, MemberRole, MemberRow } from "@/application/ports";

// The stateful remove control is called as a function in C1544, so its two hooks are replaced there; everywhere else
// they call through to React.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn(actual.useState), useActionState: vi.fn(actual.useActionState) };
});

const react = await import("react");
const { MembersView } = await import("./members-view");
const { InviteFields } = await import("./invite-form");
const { RemoveControl, RemovePrompt, RoleFields } = await import("./member-controls");

const NOW = new Date("2026-11-05T12:00:00Z");
const vancouver = (date: Date) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" }).format(date);

const member = (userId: string, email: string, role: MemberRole, joinedAt: string): MemberRow => ({ userId, email, role, joinedAt: new Date(joinedAt) });
// u-1 joined at 03:00 UTC on Nov 5, which is still Nov 4 in Vancouver.
const MEMBERS: MemberRow[] = [
  member("u-1", "owner@example.com", "owner", "2026-11-05T03:00:00Z"),
  member("u-2", "admin@example.com", "admin", "2026-10-02T17:00:00Z"),
  member("u-3", "est@example.com", "estimator", "2026-10-03T17:00:00Z"),
  member("u-4", "bee@example.com", "viewer", "2026-10-04T17:00:00Z"),
  member("u-5", "zed@example.com", "viewer", "2026-10-05T17:00:00Z"),
];
const invitation = (id: string, email: string, role: MemberRole, invitedAt: string, expiresAt: string): InvitationRow => ({
  id,
  email,
  role,
  invitedAt: new Date(invitedAt),
  expiresAt: new Date(expiresAt),
});
const INVITATIONS: InvitationRow[] = [
  invitation("inv-new", "new@x.test", "estimator", "2026-11-04T10:00:00Z", "2026-11-18T10:00:00Z"),
  invitation("inv-old", "old@x.test", "viewer", "2026-10-01T10:00:00Z", "2026-10-15T10:00:00Z"),
];

const actions = { invite: vi.fn(), revoke: vi.fn(), setRole: vi.fn(), remove: vi.fn() };

function page(role: MemberRole, patch: Partial<Parameters<typeof MembersView>[0]> = {}) {
  const manage = role === "owner" || role === "admin";
  return renderToStaticMarkup(
    createElement(MembersView, {
      members: MEMBERS,
      invitations: manage ? INVITATIONS : null,
      currentUserId: "u-1",
      role,
      orgName: "Northwind",
      now: NOW,
      actions,
      ...patch,
    }),
  );
}

/** The markup of the `<li data-member="id">` rows, by id. */
function rows(html: string, attribute: "data-member" | "data-invitation"): Record<string, string> {
  const found: Record<string, string> = {};
  for (const match of html.matchAll(new RegExp(`<li ${attribute}="([^"]+)"[\\s\\S]*?</li>`, "g"))) found[match[1]] = match[0];
  return found;
}

beforeEach(() => vi.clearAllMocks());

describe("roster", () => {
  test("C1500: one row per member with email, role label and joined date, in the order given", () => {
    const html = page("owner");
    const byId = rows(html, "data-member");
    expect(Object.keys(byId)).toEqual(["u-1", "u-2", "u-3", "u-4", "u-5"]);
    expect([...html.matchAll(/data-member="(u-\d)"/g)].map((m) => m[1])).toEqual(["u-1", "u-2", "u-3", "u-4", "u-5"]);

    const labels = { "u-1": "Owner", "u-2": "Admin", "u-3": "Estimator", "u-4": "Viewer", "u-5": "Viewer" };
    for (const one of MEMBERS) {
      expect(byId[one.userId], one.email).toContain(one.email);
      expect(byId[one.userId], one.email).toContain(`>${labels[one.userId as keyof typeof labels]}<`);
      expect(byId[one.userId], one.email).toContain(`Joined ${vancouver(one.joinedAt)}`);
    }
    expect(vancouver(MEMBERS[0].joinedAt)).not.toBe(vancouver(new Date("2026-11-05T12:00:00Z")));
  });

  test("C1500: \"You\" marks the signed-in member's row and no other", () => {
    for (const currentUserId of ["u-1", "u-4"]) {
      const byId = rows(page("owner", { currentUserId }), "data-member");
      for (const [id, markup] of Object.entries(byId)) expect(markup.includes(">You<"), `${currentUserId} on ${id}`).toBe(id === currentUserId);
    }
  });
});

describe("pending invitations", () => {
  test("C1501: each shows email, role, invited date and Expires <date> or Expired, in the order given", () => {
    const html = page("owner");
    const byId = rows(html, "data-invitation");
    expect([...html.matchAll(/data-invitation="([^"]+)"/g)].map((m) => m[1])).toEqual(["inv-new", "inv-old"]);

    expect(byId["inv-new"]).toContain("new@x.test");
    expect(byId["inv-new"]).toContain(">Estimator<");
    expect(byId["inv-new"]).toContain(`Invited ${vancouver(INVITATIONS[0].invitedAt)}`);
    expect(byId["inv-new"]).toContain(`Expires ${vancouver(INVITATIONS[0].expiresAt)}`);
    expect(byId["inv-new"]).not.toContain("Expired");

    expect(byId["inv-old"]).toContain("old@x.test");
    expect(byId["inv-old"]).toContain(">Viewer<");
    expect(byId["inv-old"]).toContain(`Invited ${vancouver(INVITATIONS[1].invitedAt)}`);
    expect(byId["inv-old"]).toContain(">Expired<");
    expect(byId["inv-old"]).not.toContain("Expires ");
  });

  test("C1502: with no invitation the list is replaced by No pending invitations.", () => {
    for (const role of ["owner", "admin"] as const) {
      const html = page(role, { invitations: [] });
      expect(html).toContain("No pending invitations.");
      expect(html).not.toContain("data-invitation=");
    }
  });
});

describe("read-only roster", () => {
  test.each(["estimator", "viewer"] as const)("C1503: %s sees the roster and none of the invitation list, the invite form or a row control", (role) => {
    const html = page(role, { currentUserId: "u-3" });
    for (const one of MEMBERS) expect(html).toContain(one.email);
    for (const absent of ["Pending invitations", "No pending invitations", "Invite someone", "Send invitation", 'name="email"', "Save role", ">Remove<", "Resend", "Revoke"]) {
      expect(html, absent).not.toContain(absent);
    }
  });
});

describe("invitation controls", () => {
  test("C1515: every pending row, an expired one too, has Resend with its own email and role, and Revoke with its id", () => {
    const byId = rows(page("owner"), "data-invitation");
    for (const [id, email, role] of [
      ["inv-new", "new@x.test", "estimator"],
      ["inv-old", "old@x.test", "viewer"],
    ] as const) {
      const markup = byId[id];
      expect(markup, id).toMatch(new RegExp(`<input type="hidden" name="email" value="${email}"`));
      expect(markup, id).toMatch(new RegExp(`<input type="hidden" name="role" value="${role}"`));
      expect(markup, id).toMatch(new RegExp(`<input type="hidden" name="invitationId" value="${id}"`));
      expect(markup, id).toMatch(/<button[^>]*>Resend<\/button>/);
      expect(markup, id).toMatch(/<button[^>]*>Revoke<\/button>/);
      for (const label of ["Resend", "Revoke"]) {
        const button = new RegExp(`<button[^>]*>${label}</button>`).exec(markup)?.[0] ?? "";
        expect(button, `${id} ${label}`).toMatch(/class="[^"]*\bh-11\b/);
      }
    }
  });
});

describe("invite form", () => {
  test("C1519: the four roles are offered and Viewer is the one selected", () => {
    const html = renderToStaticMarkup(createElement(InviteFields, { state: { status: "idle" } }));
    expect([...html.matchAll(/<option value="(\w+)"/g)].map((m) => m[1])).toEqual(["owner", "admin", "estimator", "viewer"]);
    expect(html).toMatch(/<option value="viewer"[^>]*selected/);
    for (const other of ["owner", "admin", "estimator"]) expect(html).not.toMatch(new RegExp(`<option value="${other}"[^>]*selected`));
  });

  const MESSAGES = [
    ["sent", "Invitation sent to pat@example.com", "status"],
    ["invalid", "Enter a valid email address.", "alert"],
    ["already_member", "pat@example.com is already a member.", "alert"],
    ["owner_only", "Only an owner can invite an owner.", "alert"],
    ["rate_limited", "Too many emails were sent. Try again in a minute.", "alert"],
    ["saved_not_sent", "The invitation was saved, but the email could not be sent. Use Resend.", "alert"],
    ["forbidden", null, "alert"],
    ["unavailable", "Could not save. Try again.", "alert"],
  ] as const;

  test.each(MESSAGES)("C1519: %s renders its message", (status, message, role) => {
    const html = renderToStaticMarkup(createElement(InviteFields, { state: { status, email: "pat@example.com" } }));
    const alert = new RegExp(`<p role="${role}"[^>]*>([^<]*)</p>`).exec(html)?.[1] ?? "";
    expect(alert.length).toBeGreaterThan(0);
    if (message) expect(alert).toBe(message);
  });

  test("C1519: the eight messages are distinct", () => {
    const texts = MESSAGES.map(([status]) => {
      const html = renderToStaticMarkup(createElement(InviteFields, { state: { status, email: "pat@example.com" } }));
      return /<p role="(?:alert|status)"[^>]*>([^<]*)<\/p>/.exec(html)?.[1];
    });
    expect(new Set(texts).size).toBe(8);
  });

  test("C1519: a fresh form shows no message", () => {
    const html = renderToStaticMarkup(createElement(InviteFields, { state: { status: "idle" } }));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });
});

describe("row controls", () => {
  test("C1543: the signed-in member's row has no role control and no Remove; other rows have both", () => {
    const byId = rows(page("admin", { currentUserId: "u-2" }), "data-member");
    expect(byId["u-2"]).not.toContain("Save role");
    expect(byId["u-2"]).not.toContain(">Remove<");
    for (const id of ["u-1", "u-3", "u-4", "u-5"]) {
      expect(byId[id], id).toContain("Save role");
      expect(byId[id], id).toContain(">Remove<");
    }
  });

  test("C1543: a role control offers the four roles with the member's own selected", () => {
    const byId = rows(page("owner"), "data-member");
    for (const one of MEMBERS.slice(1)) {
      const markup = byId[one.userId];
      expect([...markup.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]), one.email).toEqual(["owner", "admin", "estimator", "viewer"]);
      expect(markup, one.email).toMatch(new RegExp(`<option value="${one.role}"[^>]*selected`));
      expect(markup, one.email).toMatch(new RegExp(`<input type="hidden" name="userId" value="${one.userId}"`));
    }
  });

  const SET_ROLE = ["saved", "owner_only", "last_owner", "self", "not_found", "forbidden", "unavailable"] as const;
  const REMOVE = ["removed", "owner_only", "last_owner", "self", "not_found", "forbidden", "unavailable"] as const;
  const target = MEMBERS[3];

  const setRoleMessage = (status: (typeof SET_ROLE)[number]) =>
    /<p role="(?:alert|status)"[^>]*>([^<]*)<\/p>/.exec(renderToStaticMarkup(createElement(RoleFields, { member: target, state: { status } })))?.[1];
  const removeMessage = (status: (typeof REMOVE)[number]) =>
    /<p role="(?:alert|status)"[^>]*>([^<]*)<\/p>/.exec(
      renderToStaticMarkup(createElement(RemovePrompt, { member: target, orgName: "Northwind", confirming: false, pending: false, state: { status } })),
    )?.[1];

  test.each(SET_ROLE)("C1543: setMemberRole %s renders a message", (status) => {
    const message = setRoleMessage(status);
    expect(message?.length).toBeGreaterThan(0);
    if (status === "not_found") expect(message).toBe("That member was already removed.");
    if (status === "unavailable") expect(message).toBe("Could not save. Try again.");
  });

  test.each(REMOVE)("C1543: removeMember %s renders a message", (status) => {
    const message = removeMessage(status);
    expect(message?.length).toBeGreaterThan(0);
    if (status === "not_found") expect(message).toBe("That member was already removed.");
    if (status === "unavailable") expect(message).toBe("Could not save. Try again.");
  });

  test("C1543: each list of seven messages is made of seven different texts", () => {
    expect(new Set(SET_ROLE.map(setRoleMessage)).size).toBe(7);
    expect(new Set(REMOVE.map(removeMessage)).size).toBe(7);
  });
});

describe("remove confirmation", () => {
  const target = MEMBERS[3];
  const prompt = (confirming: boolean) =>
    renderToStaticMarkup(createElement(RemovePrompt, { member: target, orgName: "Northwind", confirming, pending: false, state: { status: "idle" } }));

  test("C1544: before Confirm there is only a Remove button and no form that could submit", () => {
    const html = prompt(false);
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Confirm remove");
  });

  test("C1544: the prompt names the member, says they lose access immediately, and has Confirm and Cancel", () => {
    const html = prompt(true);
    expect(html).toContain("Remove bee@example.com?");
    expect(html).toContain("They lose access to Northwind immediately.");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Confirm remove<\/button>/);
    expect(html).toMatch(/<button[^>]*>Cancel<\/button>/);
    expect(html).toMatch(/<input type="hidden" name="userId" value="u-4"/);
  });

  test("C1544: the stateful control starts unconfirmed, Remove only asks, Cancel goes back, and the action is never called", () => {
    const setConfirming = vi.fn();
    const remove = vi.fn();
    const formAction = vi.fn();
    vi.mocked(react.useState).mockImplementationOnce((() => [false, setConfirming]) as never);
    vi.mocked(react.useActionState).mockImplementationOnce((() => [{ status: "idle" }, formAction, false]) as never);

    const element = RemoveControl({ member: target, orgName: "Northwind", action: remove }) as ReactElement<{
      confirming: boolean;
      action: unknown;
      onStart: () => void;
      onCancel: () => void;
    }>;

    expect(element.props.confirming).toBe(false);
    expect(element.props.action).toBe(formAction);
    element.props.onStart();
    expect(setConfirming).toHaveBeenLastCalledWith(true);
    element.props.onCancel();
    expect(setConfirming).toHaveBeenLastCalledWith(false);
    expect(remove).not.toHaveBeenCalled();
    expect(formAction).not.toHaveBeenCalled();
    expect(vi.mocked(react.useActionState).mock.calls.at(-1)?.[0]).toBe(remove);
  });
});
