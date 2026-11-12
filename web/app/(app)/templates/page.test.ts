import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementTemplateSummary, CurrentMember, MemberRole } from "@/application/ports";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listAgreementTemplates = vi.fn();
const listAssetTypes = vi.fn();
const getItemWords = vi.fn(async () => ({ singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" }));
const listCustomers = vi.fn(async () => []);
const listActiveSites = vi.fn(async () => []);
const container = { currentMember, listAgreementTemplates, listAssetTypes, getItemWords, listCustomers, listActiveSites, clock: { now: () => new Date("2026-11-12T18:00:00Z") } };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/templates" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { TemplatesForRequest } = await import("./page");
const { default: NewTemplatePage } = await import("./new/page");
const { TemplatesView } = await import("@/components/templates/templates-view");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role });
const template = (id: string, name: string): AgreementTemplateSummary => ({
  id,
  versionId: `${id}-v`,
  versionNo: 1,
  updatedAt: new Date("2026-10-29T12:00:00Z"),
  system: false,
  body: { ...SYSTEM_AGREEMENT_BODY, name },
});
const TEMPLATES = [template("t-a", "Annual boiler"), template("t-b", "Quarterly HVAC"), template("t-c", "Semiannual chiller")];

const render = async (params: Record<string, string | string[] | undefined>) => (await TemplatesForRequest({ params })) as ReactElement<{ selectedId: string | null }>;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  listAgreementTemplates.mockResolvedValue({ ok: true, templates: TEMPLATES });
  listAssetTypes.mockResolvedValue([{ id: "ty-1", code: "RTU", name: "Rooftop units" }]);
});

describe("/templates", () => {
  test("C5347: the selected card is the one named by ?selected", async () => {
    expect((await render({ selected: "t-b" })).props.selectedId).toBe("t-b");
    const html = renderToStaticMarkup(await render({ selected: "t-c" }));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<h2[^>]*>Semiannual chiller<\/h2>/);
  });

  test("C5422: after a save the page opens on the saved template: selected, with its new name on its card and in the preview", async () => {
    const saved = { ...template("t-new", "Renamed by the owner"), updatedAt: new Date("2026-11-12T17:59:00Z") };
    listAgreementTemplates.mockResolvedValue({ ok: true, templates: [...TEMPLATES, saved] });
    const element = await render({ selected: "t-new" });
    expect(element.props.selectedId).toBe("t-new");
    const html = renderToStaticMarkup(element);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<a[^>]*aria-current="true"[^>]*>Renamed by the owner<\/a>/);
    expect(html).toMatch(/<h2[^>]*>Renamed by the owner<\/h2>/);
    expect(html).toContain("Updated today");
  });

  test("C5347: with no ?selected the first card is selected", async () => {
    expect((await render({})).props.selectedId).toBe("t-a");
  });

  test("C5347: with a ?selected that names no listed template the first card is selected", async () => {
    expect((await render({ selected: "t-zzz" })).props.selectedId).toBe("t-a");
    expect((await render({ selected: "" })).props.selectedId).toBe("t-a");
  });

  test("C5346: when the list cannot be read the view gets no templates and says so, with a retry link", async () => {
    listAgreementTemplates.mockResolvedValue({ ok: false, code: "unavailable" });
    const element = await render({});
    expect(element.type).toBe(TemplatesView);
    expect(element.props).toMatchObject({ templates: null, selectedId: null });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("We couldn&#x27;t load templates. Try again.");
    expect(html).toMatch(/<a[^>]*href="\/templates"[^>]*>Try again<\/a>/);
  });

  test("C2021: the org's item words reach the view", async () => {
    expect(((await render({})) as unknown as ReactElement<{ words: { plural: string } }>).props.words.plural).toBe("stations");
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
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listAgreementTemplates).not.toHaveBeenCalled();
  });

  test("C5344: the owner's view carries the actions, the estimator's does not, and the type names come from the org's types", async () => {
    const owner = (await render({})) as unknown as ReactElement<{ actions?: unknown; typeNames: Record<string, string> }>;
    expect(owner.props.actions).toBeDefined();
    expect(owner.props.typeNames).toEqual({ RTU: "Rooftop units" });
    currentMember.mockResolvedValue(member("estimator"));
    expect(((await render({})) as unknown as ReactElement<{ actions?: unknown }>).props.actions).toBeUndefined();
  });
});

describe("/templates/new", () => {
  test("C5354: signed out goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(NewTemplatePage()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  test.each(["estimator", "viewer"] as const)("C5354: a %s goes to /templates", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(NewTemplatePage()).rejects.toThrow("NEXT_REDIRECT /templates");
  });

  test.each(["owner", "admin"] as const)("C5349: a %s gets the empty editor", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = renderToStaticMarkup((await NewTemplatePage()) as ReactElement);
    expect(html).toContain("New template");
    expect(html).toContain('id="template-name"');
    expect(html).toContain("Save template");
  });
});
