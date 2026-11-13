import { afterEach, describe, expect, test, vi } from "vitest";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { stubClient } from "./stub-client";
import { supabaseAgreementTemplateReader, supabaseAgreementTemplateStore } from "./templates";

const body = (name: string) => ({ ...SYSTEM_AGREEMENT_BODY, name });
const row = (id: string, orgId: string | null, name: string, versionNo = 2) => ({
  id,
  org_id: orgId,
  document_template_versions: [{ id: `${id}-v${versionNo}`, version_no: versionNo, body: body(name), created_at: "2026-11-10T12:00:00Z" }],
});
const error = (code: string): { data: null; error: { code: string; message: string } } => ({ data: null, error: { code, message: "boom" } });

afterEach(() => vi.restoreAllMocks());

describe("the agreement template reader", () => {
  test("C5355: lists the non-archived agreement templates with their latest version, in name order", async () => {
    const { calls, typed } = stubClient({
      document_templates: { data: [row("t-2", "org-1", "quarterly hvac"), row("t-1", "org-1", "Annual boiler"), row("t-0", null, "Standard agreement", 1)], error: null },
    });
    const result = await supabaseAgreementTemplateReader(typed).list();
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("unreachable");
    expect(result.templates.map((template) => template.body.name)).toEqual(["Annual boiler", "quarterly hvac", "Standard agreement"]);
    expect(result.templates[0]).toEqual({
      id: "t-1",
      versionId: "t-1-v2",
      versionNo: 2,
      updatedAt: new Date("2026-11-10T12:00:00Z"),
      system: false,
      body: body("Annual boiler"),
    });
    expect(result.templates[2].system).toBe(true);
    const query = calls.filter((call) => call.table === "document_templates");
    expect(query.find((call) => call.method === "eq")?.args).toEqual(["kind", "agreement"]);
    expect(query.find((call) => call.method === "is")?.args).toEqual(["archived_at", null]);
    expect(query.find((call) => call.method === "order")?.args).toEqual(["version_no", { referencedTable: "document_template_versions", ascending: false }]);
    expect(query.find((call) => call.method === "limit")?.args).toEqual([1, { referencedTable: "document_template_versions" }]);
  });

  test("C5355: a read error is unavailable and the code is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { typed } = stubClient({ document_templates: error("XX000") });
    expect(await supabaseAgreementTemplateReader(typed).list()).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("XX000"));
  });

  test("C5355: a stored body this product cannot draw is unavailable, not a card", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = { id: "t-9", org_id: "org-1", document_template_versions: [{ id: "v", version_no: 1, body: { schema: 2 }, created_at: "2026-11-10T12:00:00Z" }] };
    const { typed } = stubClient({ document_templates: { data: [broken], error: null } });
    expect(await supabaseAgreementTemplateReader(typed).list()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("the agreement template store", () => {
  test("C5355: save sends the id and the body once and answers the template id and version number", async () => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue({ data: [{ template_id: "t-1", version_no: 3 }], error: null });
    expect(await supabaseAgreementTemplateStore(typed).save("t-1", body("X"))).toEqual({ ok: true, templateId: "t-1", versionNo: 3 });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("save_agreement_template", { p_template_id: "t-1", p_body: body("X") });
  });

  test.each([
    ["42501", "forbidden"],
    ["22023", "invalid"],
    ["23505", "name_taken"],
    ["P0002", "not_found"],
  ])("C5355: save maps %s to %s", async (code, expected) => {
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(error(code));
    expect(await supabaseAgreementTemplateStore(typed).save(null, body("X"))).toEqual({ ok: false, code: expected });
  });

  test("C5355: save maps any other code to unavailable and logs the code", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(error("XX000"));
    expect(await supabaseAgreementTemplateStore(typed).save(null, body("X"))).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("XX000"));
  });

  test.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["XX000", "unavailable"],
  ])("C5355: archive maps %s to %s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, typed } = stubClient({});
    client.rpc.mockResolvedValue(error(code));
    expect(await supabaseAgreementTemplateStore(typed).archive("t-1")).toEqual({ ok: false, code: expected });
    expect(client.rpc).toHaveBeenCalledWith("archive_agreement_template", { p_template_id: "t-1" });
  });

  test("C5355: archive answers ok", async () => {
    const { typed } = stubClient({});
    expect(await supabaseAgreementTemplateStore(typed).archive("t-1")).toEqual({ ok: true });
  });
});
