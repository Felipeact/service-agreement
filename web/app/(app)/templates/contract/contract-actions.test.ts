import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";
import { contractFormFromBody } from "@/domain/contract/layout-form";

vi.mock("next/cache", () => ({ refresh: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const currentMember = vi.fn();
const saveContractWording = vi.fn();
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveContractWording }) }));

const as = (role: string) => currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role });
const FORM = contractFormFromBody(SYSTEM_CONTRACT_BODY);

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
});

describe("saveContractWordingAction", () => {
  test.each(["owner", "admin"])("C5553: a %s calls save_contract_template once with the validated schema 2 body and answers saved", async (role) => {
    as(role);
    saveContractWording.mockResolvedValue({ ok: true, templateId: "t-1", versionNo: 2 });
    const { saveContractWordingAction } = await import("./contract-actions");
    expect(await saveContractWordingAction(FORM)).toEqual({ status: "saved" });
    expect(saveContractWording).toHaveBeenCalledTimes(1);
    const body = saveContractWording.mock.calls[0][0];
    expect(body).toMatchObject({ schema: 2, doc: { title: "Service Contract", showMeta: true, pageHeader: "first", pageFooter: "number" } });
    expect(body.layout.at(-1)).toEqual({ kind: "section", key: "signatures" });
    expect(revalidatePath).toHaveBeenCalledWith("/templates/contract");
  });

  test.each(["estimator", "viewer"])("C5553: a %s is forbidden and nothing is called", async (role) => {
    as(role);
    const { saveContractWordingAction } = await import("./contract-actions");
    expect(await saveContractWordingAction(FORM)).toEqual({ status: "forbidden" });
    expect(saveContractWording).not.toHaveBeenCalled();
  });

  test("C5553: signed out goes to /login and nothing is called", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const { saveContractWordingAction } = await import("./contract-actions");
    await expect(saveContractWordingAction(FORM)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(saveContractWording).not.toHaveBeenCalled();
  });

  test.each<[string, "forbidden" | "invalid" | "unavailable", string]>([
    ["the database refusing the role", "forbidden", "forbidden"],
    ["the database refusing the body", "invalid", "unavailable"],
    ["the store being unavailable", "unavailable", "unavailable"],
  ])("C5553: %s answers %s without claiming a save", async (_name, code, status) => {
    saveContractWording.mockResolvedValue({ ok: false, code });
    const { saveContractWordingAction } = await import("./contract-actions");
    expect(await saveContractWordingAction(FORM)).toEqual({ status });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveContractWordingAction, invalid values", () => {
  test("C5554: an unknown variable, an empty text and a missing signatures section answer each row's message with what was typed, and call nothing", async () => {
    const { saveContractWordingAction } = await import("./contract-actions");
    const blocks = FORM.layout.flatMap((row, at) => (row.kind === "block" ? [at] : []));
    const typed = {
      ...FORM,
      layout: FORM.layout
        .filter((row) => !(row.kind === "section" && row.key === "signatures"))
        .map((row, at) => (at === blocks[0] && row.kind === "block" ? { ...row, text: "" } : at === blocks[1] && row.kind === "block" ? { ...row, text: "Hello {{nope}}." } : row)),
    };
    const state = await saveContractWordingAction(typed);
    expect(state).toMatchObject({ status: "invalid", values: typed });
    const errors = (state as { errors: Record<string, string> }).errors;
    expect(errors[`layout.${blocks[0]}.text`]).toContain("empty");
    expect(errors[`layout.${blocks[1]}.text`]).toContain("unknown variable");
    expect(errors.layout).toBe("The layout needs the signatures section.");
    expect(saveContractWording).not.toHaveBeenCalled();
  });

  test("C5554: 61 items are refused on the layout and nothing is called", async () => {
    const { saveContractWordingAction } = await import("./contract-actions");
    const clause = FORM.layout.find((row) => row.kind === "block")!;
    const state = await saveContractWordingAction({ ...FORM, layout: [...FORM.layout, ...Array.from({ length: 61 - FORM.layout.length }, () => clause)] });
    expect(state).toMatchObject({ status: "invalid" });
    expect((state as { errors: Record<string, string> }).errors.layout).toContain("too many items");
    expect(saveContractWording).not.toHaveBeenCalled();
  });
});
