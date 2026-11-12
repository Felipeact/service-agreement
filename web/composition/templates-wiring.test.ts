import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const rpc = vi.fn();
const from = vi.fn();
// The container builds one client per request from @supabase/ssr; every adapter in it shares that client (the member's own).
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ rpc, from, auth: {} }) }));

const OWN = { id: "t-1", org_id: "org-1", document_template_versions: [{ id: "v-1", version_no: 1, body: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC" }, created_at: "2026-11-10T12:00:00Z" }] };
const SYSTEM = { id: "t-0", org_id: null, document_template_versions: [{ id: "v-0", version_no: 1, body: SYSTEM_AGREEMENT_BODY, created_at: "2026-11-01T12:00:00Z" }] };

/** `from("document_templates")` is a chain that ends awaited. */
function templatesAre(rows: unknown[]) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  from.mockReturnValue(query);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  rpc.mockReset();
  from.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("the container's agreement templates", () => {
  test("C5359: listAgreementTemplates reads through the member's client and shows the system template only when the org has none", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    templatesAre([SYSTEM, OWN]);
    const own = await container.listAgreementTemplates();
    expect(own.ok && own.templates.map((template) => template.id)).toEqual(["t-1"]);
    expect(from).toHaveBeenCalledWith("document_templates");
    templatesAre([SYSTEM]);
    const none = await container.listAgreementTemplates();
    expect(none.ok && none.templates.map((template) => template.id)).toEqual(["t-0"]);
  });

  test("C5359: saveAgreementTemplate and archiveAgreementTemplate call the two functions as the member", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    rpc.mockResolvedValue({ data: [{ template_id: "t-1", version_no: 2 }], error: null });
    expect(await container.saveAgreementTemplate("t-1", SYSTEM_AGREEMENT_BODY)).toEqual({ ok: true, templateId: "t-1", versionNo: 2 });
    expect(rpc).toHaveBeenCalledWith("save_agreement_template", { p_template_id: "t-1", p_body: SYSTEM_AGREEMENT_BODY });
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await container.archiveAgreementTemplate("t-1")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("archive_agreement_template", { p_template_id: "t-1" });
  });

  test("C5359: duplicateAgreementTemplate saves the copy under the first free name", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    const taken = { ...OWN, id: "t-2", document_template_versions: [{ ...OWN.document_template_versions[0], id: "v-2", body: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC (copy)" } }] };
    templatesAre([SYSTEM, OWN, taken]);
    rpc.mockResolvedValue({ data: [{ template_id: "t-3", version_no: 1 }], error: null });
    expect(await container.duplicateAgreementTemplate("t-1")).toEqual({ ok: true, templateId: "t-3" });
    expect(rpc).toHaveBeenCalledWith("save_agreement_template", { p_template_id: null, p_body: { ...SYSTEM_AGREEMENT_BODY, name: "Quarterly HVAC (copy 2)" } });
  });

  test("C5359: the agreement store takes the optional template version", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    rpc.mockResolvedValue({ data: "ag-1", error: null });
    expect(await container.agreementStore.create("site-1", "v-1")).toEqual({ ok: true, id: "ag-1" });
    expect(rpc).toHaveBeenCalledWith("create_agreement", { p_site_id: "site-1", p_template_version_id: "v-1" });
  });
});
