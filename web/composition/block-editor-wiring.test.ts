import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_CONTRACT_BODY } from "@/domain/contract";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const rpc = vi.fn();
const from = vi.fn();
// The container builds one client per request from @supabase/ssr; every adapter in it shares that client (the member's own).
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ rpc, from, auth: {} }) }));

const SYSTEM = { id: "t-0", org_id: null, document_template_versions: [{ version_no: 1, body: SYSTEM_CONTRACT_BODY }] };

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

describe("the container's contract wording", () => {
  test("C5560: getContractWording reads through the member's client and answers the system wording while the org has none", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    templatesAre([SYSTEM]);
    expect(await container.getContractWording()).toEqual({ ok: true, body: SYSTEM_CONTRACT_BODY, own: false });
    expect(from).toHaveBeenCalledWith("document_templates");
  });

  test("C5560: saveContractWording calls save_contract_template as the member", async () => {
    const { getContainer } = await import("./index");
    const container = await getContainer();
    rpc.mockResolvedValue({ data: [{ template_id: "t-1", version_no: 2 }], error: null });
    expect(await container.saveContractWording(SYSTEM_CONTRACT_BODY)).toEqual({ ok: true, templateId: "t-1", versionNo: 2 });
    expect(rpc).toHaveBeenCalledWith("save_contract_template", { p_body: SYSTEM_CONTRACT_BODY });
  });
});
