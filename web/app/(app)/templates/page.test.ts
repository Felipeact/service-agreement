import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary, CurrentMember, MemberRole } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listAgreementTemplates = vi.fn();
const ensureStarterTemplates = vi.fn();
const listAssetTypes = vi.fn();
const getContractWording = vi.fn(async () => ({ ok: true as const, body: SYSTEM_CONTRACT_BODY, own: false }));
const listCustomers = vi.fn(async () => []);
const listActiveSites = vi.fn(async () => []);
const listEquipmentTypes = vi.fn(async () => []);
const container = { currentMember, listAgreementTemplates, ensureStarterTemplates, listAssetTypes, listEquipmentTypes, getContractWording, listCustomers, listActiveSites, clock: { now: () => new Date("2026-11-12T18:00:00Z") } };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound, useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/templates" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { TemplatesForRequest } = await import("./page");
const { default: NewTemplatePage } = await import("./new/page");
const { default: ContractWordingPage } = await import("./contract/page");
const { EditTemplateForRequest } = await import("./[templateId]/page");
const { TemplatesView } = await import("@/components/templates/templates-view");
const { TemplateEditor } = await import("@/components/templates/template-editor");
const { ContractWordingEditor } = await import("@/components/templates/contract-wording-editor");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role });
const ID = "7f9c2d3e-1a2b-4c5d-8e9f-0a1b2c3d4e5f";
const template = (id: string, name: string, system = false): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 1,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system,
  body: { ...SYSTEM_AGREEMENT_BODY, name },
});
const TEMPLATES = [template("t-a", "Annual boiler"), template("t-b", "Quarterly HVAC"), template("t-c", "Semiannual chiller")];

const render = async () => (await TemplatesForRequest()) as ReactElement<Record<string, unknown>>;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  listAgreementTemplates.mockResolvedValue({ ok: true, templates: TEMPLATES });
  ensureStarterTemplates.mockResolvedValue({ ok: true, templates: TEMPLATES });
  listAssetTypes.mockResolvedValue([{ id: "ty-1", code: "RTU", name: "Rooftop units" }]);
});

describe("/templates", () => {
  test("C5347: every template is a card in the list, each with its name", async () => {
    const element = await render();
    expect(element.type).toBe(TemplatesView);
    const html = renderToStaticMarkup(element);
    expect(html.match(/<article/g)).toHaveLength(4);
    for (const name of ["Annual boiler", "Quarterly HVAC", "Semiannual chiller"]) expect(html).toContain(name);
  });

  test("C5346: when the list cannot be read the view gets no templates and says so, with a retry link", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: false, code: "unavailable" });
    ensureStarterTemplates.mockResolvedValue({ ok: false, code: "unavailable" });
    const element = await render();
    expect(element.type).toBe(TemplatesView);
    expect(element.props).toMatchObject({ templates: null });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("We couldn&#x27;t load templates. Try again.");
    expect(html).toMatch(/<a[^>]*href="\/templates"[^>]*>Try again<\/a>/);
  });

  test("C5557: the view is told whether the org has its own contract wording, and none when it cannot be read", async () => {
    type Wording = ReactElement<{ contractWording?: { own: boolean } }>;
    expect(((await TemplatesForRequest()) as Wording).props.contractWording).toEqual({ own: false });
    getContractWording.mockResolvedValueOnce({ ok: true, body: SYSTEM_CONTRACT_BODY, own: true });
    expect(((await TemplatesForRequest()) as Wording).props.contractWording).toEqual({ own: true });
    getContractWording.mockResolvedValueOnce({ ok: false, code: "unavailable" } as never);
    expect(((await TemplatesForRequest()) as Wording).props.contractWording).toBeUndefined();
  });

  test("C5346: the route has a loading screen that names the page and says it is loading", async () => {
    expect(existsSync(path.join(__dirname, "loading.tsx"))).toBe(true);
    const { default: Loading } = await import("./loading");
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain("Agreement templates");
    expect(html).toContain("Loading");
  });

  test("C5354: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listAgreementTemplates).not.toHaveBeenCalled();
  });

  test("C5344: the owner's view carries the actions and the estimator's does not", async () => {
    const owner = (await render()) as unknown as ReactElement<{ actions?: unknown }>;
    expect(owner.props.actions).toBeDefined();
    currentMember.mockResolvedValue(member("estimator"));
    expect(((await render()) as unknown as ReactElement<{ actions?: unknown }>).props.actions).toBeUndefined();
  });
});

describe("/templates, Use template and Customize wiring", () => {
  type Wired = ReactElement<{ dialog?: { templates: unknown }; actions?: { customize?: unknown; duplicate?: unknown } }>;

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
  ] as const)("C5410: for role %s the page mounts the Use template dialog: %s", async (role, shown) => {
    currentMember.mockResolvedValue(member(role));
    const element = (await TemplatesForRequest()) as Wired;
    expect(element.props.dialog !== undefined).toBe(shown);
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
    ["viewer", false],
  ] as const)("C5410: for role %s the page passes the customize action: %s", async (role, shown) => {
    currentMember.mockResolvedValue(member(role));
    const element = (await TemplatesForRequest()) as Wired;
    expect(typeof element.props.actions?.customize === "function").toBe(shown);
  });
});

describe("the editor routes", () => {
  const FORM_TEMPLATE = template(ID, "Quarterly HVAC");

  test("[C32] /templates/new, /templates/[templateId] and /templates/contract each render the one editor of their document", async () => {
    const found = (node: unknown, type: unknown): boolean => {
      const element = node as ReactElement<{ children?: unknown }> | null;
      if (!element || typeof element !== "object") return false;
      if (element.type === type) return true;
      const children = element.props?.children;
      return (Array.isArray(children) ? children : [children]).some((child) => found(child, type));
    };
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [FORM_TEMPLATE] });
    expect(found(await NewTemplatePage(), TemplateEditor)).toBe(true);
    expect(found(await EditTemplateForRequest({ templateId: ID }), TemplateEditor)).toBe(true);
    expect(found(await ContractWordingPage(), ContractWordingEditor)).toBe(true);
  });

  test("[C32] the editor is given the company's name for the page's letterhead on all three routes", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [FORM_TEMPLATE] });
    for (const node of [await NewTemplatePage(), await EditTemplateForRequest({ templateId: ID }), await ContractWordingPage()]) {
      expect(JSON.stringify(node, (_key, value) => (typeof value === "function" ? "fn" : value))).toContain('"orgName":"Org"');
    }
  });

  test("[C34] signed out goes to /login on every editor route", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(NewTemplatePage()).rejects.toThrow("NEXT_REDIRECT /login");
    await expect(EditTemplateForRequest({ templateId: ID })).rejects.toThrow("NEXT_REDIRECT /login");
    await expect(ContractWordingPage()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  test.each(["estimator", "viewer"] as const)("[C34] a %s goes to /templates from every editor route", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(NewTemplatePage()).rejects.toThrow("NEXT_REDIRECT /templates");
    await expect(EditTemplateForRequest({ templateId: ID })).rejects.toThrow("NEXT_REDIRECT /templates");
    await expect(ContractWordingPage()).rejects.toThrow("NEXT_REDIRECT /templates");
  });

  test("[C32] a malformed id, an unknown one and the system template are 404", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [FORM_TEMPLATE, template("00000000-0000-4000-8000-000000000001", "Standard", true)] });
    await expect(EditTemplateForRequest({ templateId: "not-an-id" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(EditTemplateForRequest({ templateId: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(EditTemplateForRequest({ templateId: "00000000-0000-4000-8000-000000000001" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test.each(["owner", "admin"] as const)("C5349: a %s gets the empty editor on /templates/new", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = renderToStaticMarkup((await NewTemplatePage()) as ReactElement);
    expect(html).toContain("New template");
    expect(html).toContain('id="template-name"');
    expect(html).toContain("Save template");
  });
});
