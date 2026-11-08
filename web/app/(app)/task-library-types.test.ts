import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const createLibraryType = vi.fn();
const renameLibraryType = vi.fn();
const removeLibraryType = vi.fn();
const resetLibraryType = vi.fn();
const container = { currentMember, createLibraryType, renameLibraryType, removeLibraryType, resetLibraryType };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

const { createTypeAction, renameTypeAction, removeTypeAction, resetTypeAction } = await import("./task-library/type-actions");
const { TYPE_STATUS_MESSAGES } = await import("@/components/task-library/state");

const idle = { status: "idle" } as const;
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "org-1", orgName: "Org", role });
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
});

describe("createTypeAction", () => {
  test.each([
    ["empty", ""],
    ["61 characters", "a".repeat(61)],
    ["no letter or number", "--- !!!"],
  ])("C1937: %s returns invalid and never calls the store", async (_label, name) => {
    expect(await createTypeAction(idle, form({ name }))).toEqual({ status: "invalid", name });
    expect(createLibraryType).not.toHaveBeenCalled();
  });

  test("C1937: the invalid and conflict states carry the two messages the page shows", async () => {
    expect(TYPE_STATUS_MESSAGES.invalid).toBe("Name the type in 1 to 60 characters, with at least one letter or number");
    expect(TYPE_STATUS_MESSAGES.conflict).toBe("A type with that name already exists");
    createLibraryType.mockResolvedValue({ ok: false, code: "conflict" });
    expect(await createTypeAction(idle, form({ name: "Sump pump" }))).toEqual({ status: "conflict", name: "Sump pump" });
  });

  test("C1937: a valid name is trimmed, sent with the member's org, and opens the new type", async () => {
    createLibraryType.mockResolvedValue({ ok: true, code: "SUMP_PUMP" });
    await expect(createTypeAction(idle, form({ name: "  Sump pump  ", orgId: "other-org" }))).rejects.toThrow("NEXT_REDIRECT /task-library?type=SUMP_PUMP");
    expect(createLibraryType).toHaveBeenCalledWith("org-1", "Sump pump");
  });

  test("C1937: signed out goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(createTypeAction(idle, form({ name: "Sump pump" }))).rejects.toThrow("NEXT_REDIRECT /login");
    expect(createLibraryType).not.toHaveBeenCalled();
  });
});

describe("removeTypeAction", () => {
  test("C1919: a store answer of in_use returns in_use, which the page words as the still-used message", async () => {
    removeLibraryType.mockResolvedValue({ ok: false, code: "in_use" });
    expect(await removeTypeAction(idle, form({ typeCode: "SUMP_PUMP" }))).toEqual({ status: "in_use", name: "" });
    expect(TYPE_STATUS_MESSAGES.in_use).toBe("This type is still used by assets, service lines or import rows");
    expect(removeLibraryType).toHaveBeenCalledWith("SUMP_PUMP");
  });

  test.each(["estimator", "viewer"] as const)("C1919: as %s the action returns forbidden and never calls the store", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect(await removeTypeAction(idle, form({ typeCode: "SUMP_PUMP" }))).toEqual({ status: "forbidden", name: "" });
    expect(removeLibraryType).not.toHaveBeenCalled();
  });

  test("C1919: a removal that succeeds returns to the library", async () => {
    removeLibraryType.mockResolvedValue({ ok: true });
    await expect(removeTypeAction(idle, form({ typeCode: "SUMP_PUMP" }))).rejects.toThrow("NEXT_REDIRECT /task-library");
  });
});

describe("renameTypeAction and resetTypeAction", () => {
  test.each(["estimator", "viewer"] as const)("C1937: as %s rename and reset return forbidden and never call the store", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect((await renameTypeAction(idle, form({ typeCode: "RTU", name: "Roof" }))).status).toBe("forbidden");
    expect((await resetTypeAction(idle, form({ typeCode: "RTU" }))).status).toBe("forbidden");
    expect(renameLibraryType).not.toHaveBeenCalled();
    expect(resetLibraryType).not.toHaveBeenCalled();
  });

  test("C1937: rename validates the name before the store and keeps the type selected on success", async () => {
    expect(await renameTypeAction(idle, form({ typeCode: "RTU", name: "" }))).toEqual({ status: "invalid", name: "" });
    expect(renameLibraryType).not.toHaveBeenCalled();
    renameLibraryType.mockResolvedValue({ ok: true });
    await expect(renameTypeAction(idle, form({ typeCode: "RTU", name: " Roof " }))).rejects.toThrow("NEXT_REDIRECT /task-library?type=RTU");
    expect(renameLibraryType).toHaveBeenCalledWith("RTU", "Roof");
  });
});
