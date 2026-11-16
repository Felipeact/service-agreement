import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const currentMember = vi.fn();
const importContractWording = vi.fn();
const saveContractWording = vi.fn();
vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, importContractWording, saveContractWording }) }));

const as = (role: string) => currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "u@example.test", orgId: "org-1", orgName: "Org", role });
const FORM = { doc: { title: "T", showMeta: true, pageHeader: "first", pageFooter: "number" }, layout: [] };
const data = (file?: File) => {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return formData;
};

beforeEach(() => {
  vi.clearAllMocks();
  as("owner");
});

describe("importContractWordingAction", () => {
  test("C5816: an owner's file is passed with its name and bytes and the form comes back as imported", async () => {
    importContractWording.mockResolvedValue({ ok: true, form: FORM });
    const { importContractWordingAction } = await import("./import-actions");
    expect(await importContractWordingAction(data(new File([new Uint8Array([7, 8])], "contract.docx")))).toEqual({ status: "imported", form: FORM });
    const call = importContractWording.mock.calls[0][0];
    expect(call.role).toBe("owner");
    expect(call.file.name).toBe("contract.docx");
    expect([...call.file.bytes]).toEqual([7, 8]);
  });

  test("C5816: a signed-out caller goes to /login and nothing is imported", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const { importContractWordingAction } = await import("./import-actions");
    await expect(importContractWordingAction(data())).rejects.toThrow("NEXT_REDIRECT /login");
    expect(importContractWording).not.toHaveBeenCalled();
  });

  test("C5816: a request with no file passes none, and every use-case code comes back as failed with that code", async () => {
    const { importContractWordingAction } = await import("./import-actions");
    for (const code of ["invalid", "forbidden", "unreadable", "too_large", "unavailable"]) {
      importContractWording.mockResolvedValue({ ok: false, code });
      expect(await importContractWordingAction(data()), code).toEqual({ status: "failed", code });
      expect(importContractWording.mock.calls.at(-1)![0].file).toBeUndefined();
    }
  });

  test("C5811: importing never saves the wording", async () => {
    importContractWording.mockResolvedValue({ ok: true, form: FORM });
    const { importContractWordingAction } = await import("./import-actions");
    await importContractWordingAction(data(new File([new Uint8Array([1])], "c.pdf")));
    expect(saveContractWording).not.toHaveBeenCalled();
  });
});
