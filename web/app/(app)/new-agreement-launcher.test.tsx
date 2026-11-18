import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const listAgreementTemplates = vi.fn();
const container = {
  listCustomers: async () => [{ id: "c1", name: "Harbourview", active: true }],
  listActiveSites: async () => [],
  listAgreementTemplates,
  listEquipmentTypes: async () => [{ id: "t1", code: "RTU", name: "Rooftop unit", pack: "hvac" }],
};
vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("./import-actions", () => ({ commitCleanImportAction: vi.fn(), confirmImportAction: vi.fn(), extractImportAction: vi.fn(), readImportAction: vi.fn(), startImportAction: vi.fn() }));
vi.mock("./new-agreement-actions", () => ({ startAgreementAction: vi.fn(), addEquipmentAction: vi.fn() }));
vi.mock("./agreement-actions", () => ({ recommendServiceLinesAction: vi.fn() }));

const { Banner, Dialog, dialogProps } = await import("./new-agreement-launcher");

const template = (id: string, name: string, system = false) => ({
  id,
  versionId: `${id}-v`,
  versionNo: 1,
  updatedAt: new Date("2026-11-12T12:00:00Z"),
  system,
  body: { ...SYSTEM_AGREEMENT_BODY, name, description: `${name} wording`, preset: { termMonths: 12, lines: [] } },
});

describe("the dialog's props", () => {
  test("C5406: the Agreements and Pipeline launcher and the Imports drop banner each receive the same templates, from the one function", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [template("q", "Quarterly HVAC"), template("s", "Standard agreement", true)] });
    const expected = [{ versionId: "q-v", name: "Quarterly HVAC", description: "Quarterly HVAC wording", presetLines: 0, termMonths: 12 }];

    const launcher = (await Dialog()) as ReactElement<{ templates: unknown }>;
    const banner = (await Banner()) as ReactElement<{ templates: unknown }>;

    expect((await dialogProps()).templates).toEqual(expected);
    expect(launcher.props.templates).toEqual(expected);
    expect(banner.props.templates).toEqual(expected);
    // The equipment picker gets the org's types with their packs, for picking by hand when there is no list.
    expect((await dialogProps()).equipmentTypes).toEqual([{ id: "t1", code: "RTU", name: "Rooftop unit", pack: "hvac" }]);
  });

  test("C5406: when the templates cannot be listed all three get null, so each still starts a Standard agreement", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: false, code: "unavailable" });
    const launcher = (await Dialog()) as ReactElement<{ templates: unknown }>;
    const banner = (await Banner()) as ReactElement<{ templates: unknown }>;
    expect(launcher.props.templates).toBeNull();
    expect(banner.props.templates).toBeNull();
  });
});
