import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";
import type { LibraryType } from "@/domain/task-library";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listTaskLibrary = vi.fn<() => Promise<LibraryType[]>>();
const saveTaskLibraryType = vi.fn();
const container = { currentMember, listTaskLibrary, saveTaskLibraryType };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), usePathname: () => "/task-library" }));

const { TaskLibraryForRequest } = await import("./task-library/page");
const { saveTaskLibraryAction } = await import("./task-library/actions");

const TYPES: LibraryType[] = [
  { id: "t-b", code: "BOILER", name: "Boiler", defaultVisitMonths: [10], tasks: [{ description: "Check flue", visitMonths: null }] },
  { id: "t-r", code: "RTU", name: "Rooftop unit", defaultVisitMonths: [3, 6, 9, 12], tasks: [{ description: "Inspect belts", visitMonths: null }] },
];
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "org-1", orgName: "Org", role });
const render = async (params: { type?: string | string[] }) => renderToStaticMarkup((await TaskLibraryForRequest({ params })) as ReactElement);

function form(patch: Record<string, string | string[]> = {}) {
  const data = new FormData();
  const fields: Record<string, string | string[]> = {
    typeCode: "RTU",
    defaultVisitMonths: ["3", "6", "9", "12"],
    taskDescription: ["Inspect belts", "Cooling start-up"],
    "taskMonths-1": ["3", "4", "5"],
    ...patch,
  };
  for (const [name, value] of Object.entries(fields)) for (const one of [value].flat()) data.append(name, one);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  listTaskLibrary.mockResolvedValue(TYPES);
  saveTaskLibraryType.mockResolvedValue({ ok: true });
});

describe("/task-library", () => {
  test("C1412: the library is read once, ?type= picks the type, and the view renders for the member's role", async () => {
    const out = await render({ type: "RTU" });
    expect(listTaskLibrary).toHaveBeenCalledTimes(1);
    expect(out).toContain('value="RTU"');
    expect(out).toContain("Inspect belts");
    expect(out).not.toContain("Check flue");
    expect(await render({ type: "NOPE" })).toContain("Check flue");

    currentMember.mockResolvedValue(member("viewer"));
    const readOnly = await render({ type: "RTU" });
    expect(readOnly).toContain("Inspect belts");
    expect(readOnly).not.toContain("Save changes");
  });

  test("C1411: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listTaskLibrary).not.toHaveBeenCalled();
  });
});

describe("saveTaskLibraryAction", () => {
  const idle = { status: "idle" } as const;

  test("C1431: an invalid form returns invalid with what was typed and never calls the store", async () => {
    const state = await saveTaskLibraryAction(idle, form({ defaultVisitMonths: ["6", "3"], taskDescription: ["", "Fine"] }));
    expect(saveTaskLibraryType).not.toHaveBeenCalled();
    expect(state.status).toBe("invalid");
    if (state.status !== "invalid") return;
    expect(state.errors.defaultVisitMonths).toBeTruthy();
    expect(state.errors.rows?.[0]?.description).toBeTruthy();
    expect(state.values.defaultVisitMonths).toEqual(["6", "3"]);
    expect(state.values.tasks.map((task) => task.description)).toEqual(["", "Fine"]);
  });

  test("C1432: a valid form as an owner saves once with the validated value and returns saved", async () => {
    const state = await saveTaskLibraryAction(idle, form());
    expect(saveTaskLibraryType).toHaveBeenCalledTimes(1);
    expect(saveTaskLibraryType).toHaveBeenCalledWith("RTU", {
      defaultVisitMonths: [3, 6, 9, 12],
      tasks: [
        { description: "Inspect belts", visitMonths: null },
        { description: "Cooling start-up", visitMonths: [3, 4, 5] },
      ],
    });
    expect(state.status).toBe("saved");
  });

  test("C1432: a store failure of unavailable returns unavailable with what was typed", async () => {
    saveTaskLibraryType.mockResolvedValue({ ok: false, code: "unavailable" });
    const state = await saveTaskLibraryAction(idle, form());
    expect(state.status).toBe("unavailable");
    expect(state.status !== "idle" && "values" in state && state.values.typeCode).toBe("RTU");
  });

  test.each(["estimator", "viewer"] as const)("C1433: as %s the action returns forbidden and never calls the store", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const state = await saveTaskLibraryAction(idle, form());
    expect(state.status).toBe("forbidden");
    expect(saveTaskLibraryType).not.toHaveBeenCalled();
  });

  test("C1434: an orgId in the form never reaches the store, and signed out goes to /login", async () => {
    await saveTaskLibraryAction(idle, form({ orgId: "other-org", org_id: "other-org" }));
    expect(JSON.stringify(saveTaskLibraryType.mock.calls)).not.toContain("other-org");
    expect(saveTaskLibraryType.mock.calls[0]).toHaveLength(2);

    vi.clearAllMocks();
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(saveTaskLibraryAction(idle, form())).rejects.toThrow("NEXT_REDIRECT /login");
    expect(saveTaskLibraryType).not.toHaveBeenCalled();
  });
});
