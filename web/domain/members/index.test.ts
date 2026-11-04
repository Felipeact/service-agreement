import { describe, expect, test } from "vitest";
import { DEFAULT_INVITE_ROLE, ROLES, ROLE_LABELS, isExpired, validateInvitation } from "./index";

describe("validateInvitation", () => {
  test.each(ROLES)("C1506: %s is accepted and the address comes back trimmed and lowercased", (role) => {
    expect(validateInvitation({ email: "  Pat@Example.COM ", role })).toEqual({ ok: true, value: { email: "pat@example.com", role } });
  });

  test.each([
    ["an empty string", ""],
    ["no @", "patexample.com"],
    ["no dot in the domain", "a@b"],
    ["a space inside", "a b@c.d"],
    ["two @", "a@b@c.d"],
    ["255 characters", `${"a".repeat(248)}@b.test`],
  ])("C1506: %s is rejected", (_label, email) => {
    expect(email === "" || email.length >= 3).toBe(true);
    expect(validateInvitation({ email, role: "viewer" })).toEqual({ ok: false });
  });

  test("C1506: 254 characters are accepted", () => {
    const email = `${"a".repeat(247)}@b.test`;
    expect(email).toHaveLength(254);
    expect(validateInvitation({ email, role: "viewer" })).toEqual({ ok: true, value: { email, role: "viewer" } });
  });

  test.each(["", "contractor", "OWNER", "root"])("C1506: the role %j is rejected", (role) => {
    expect(validateInvitation({ email: "pat@example.com", role })).toEqual({ ok: false });
  });

  test("C1506: the form starts on viewer and offers exactly the four roles", () => {
    expect(DEFAULT_INVITE_ROLE).toBe("viewer");
    expect([...ROLES]).toEqual(["owner", "admin", "estimator", "viewer"]);
    expect(ROLE_LABELS).toEqual({ owner: "Owner", admin: "Admin", estimator: "Estimator", viewer: "Viewer" });
  });
});

describe("isExpired", () => {
  const now = new Date("2026-11-05T12:00:00Z");

  test("C1501: an invitation is expired from the moment its expiry is reached, not before", () => {
    expect(isExpired(new Date("2026-11-05T12:00:01Z"), now)).toBe(false);
    expect(isExpired(new Date("2026-11-05T12:00:00Z"), now)).toBe(true);
    expect(isExpired(new Date("2026-11-04T12:00:00Z"), now)).toBe(true);
  });
});
