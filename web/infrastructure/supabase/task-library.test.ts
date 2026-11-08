import { describe, expect, test } from "vitest";
import { supabaseTaskLibraryReader, supabaseTaskLibraryStore } from "./task-library";
import { stubClient } from "./stub-client";

const typeRow = (code: string, name: string, months: number[], tasks: { description: string; position: number; visit_months: number[] | null }[]) => ({
  id: `id-${code}`,
  code,
  name,
  pack: "hvac",
  default_visit_months: months,
  asset_type_tasks: tasks,
});

describe("TaskLibraryReader", () => {
  test("C1407: one entry per type with its months and tasks, read in name and position order, capped at 500", async () => {
    const { typed, calls } = stubClient({
      asset_types: {
        data: [
          typeRow("BOILER", "Boiler", [10], [{ description: "Check flue", position: 0, visit_months: null }]),
          typeRow("RTU", "Rooftop unit", [3, 6, 9, 12], [
            { description: "Inspect belts", position: 0, visit_months: null },
            { description: "Cooling start-up", position: 1, visit_months: [3, 4, 5] },
          ]),
        ],
        error: null,
      },
    });
    const types = await supabaseTaskLibraryReader(typed).list();

    expect(types).toEqual([
      { id: "id-BOILER", code: "BOILER", name: "Boiler", pack: "hvac", defaultVisitMonths: [10], tasks: [{ description: "Check flue", visitMonths: null }] },
      {
        id: "id-RTU",
        code: "RTU",
        name: "Rooftop unit",
        pack: "hvac",
        defaultVisitMonths: [3, 6, 9, 12],
        tasks: [
          { description: "Inspect belts", visitMonths: null },
          { description: "Cooling start-up", visitMonths: [3, 4, 5] },
        ],
      },
    ]);
    const select = calls.find((call) => call.method === "select");
    expect(select?.table).toBe("asset_types");
    expect(String(select?.args[0])).toContain("asset_type_tasks(");
    expect(calls.find((call) => call.method === "order" && call.args[0] === "name")).toBeTruthy();
    expect(calls.find((call) => call.method === "order" && call.args[0] === "position")?.args[1]).toEqual({ referencedTable: "asset_type_tasks" });
    expect(calls.find((call) => call.method === "limit")?.args[0]).toBe(500);
  });

  test("an unexpected database error throws", async () => {
    const { typed } = stubClient({ asset_types: { data: null, error: { code: "XX000", message: "boom" } } });
    await expect(supabaseTaskLibraryReader(typed).list()).rejects.toThrow("XX000");
  });
});

describe("TaskLibraryStore", () => {
  const value = {
    defaultVisitMonths: [4, 10],
    tasks: [
      { description: "Inspect belts", visitMonths: null },
      { description: "Cooling start-up", visitMonths: [3, 4, 5] },
    ],
  };

  test("C1429: one rpc call with numbers and the task list, and no direct table write", async () => {
    const { typed, calls, client } = stubClient({});
    expect(await supabaseTaskLibraryStore(typed).save("RTU", value)).toEqual({ ok: true });

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("save_task_library_type", {
      p_type_code: "RTU",
      p_default_months: [4, 10],
      p_tasks: [
        { description: "Inspect belts", visitMonths: null },
        { description: "Cooling start-up", visitMonths: [3, 4, 5] },
      ],
    });
    expect(calls).toEqual([]);
  });

  test.each([
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["23514", "unavailable"],
    ["XX000", "unavailable"],
  ])("C1430: database code %s gives %s", async (code, expected) => {
    const { typed, client } = stubClient({});
    client.rpc.mockResolvedValue({ data: null, error: { code, message: "boom" } });
    expect(await supabaseTaskLibraryStore(typed).save("RTU", value)).toEqual({ ok: false, code: expected });
  });
});

describe("TaskLibraryStore type functions", () => {
  const calls = {
    create: (store: ReturnType<typeof supabaseTaskLibraryStore>) => store.createType("org-1", "Sump pump"),
    rename: (store: ReturnType<typeof supabaseTaskLibraryStore>) => store.renameType("SUMP_PUMP", "Sump"),
    remove: (store: ReturnType<typeof supabaseTaskLibraryStore>) => store.removeType("SUMP_PUMP"),
    reset: (store: ReturnType<typeof supabaseTaskLibraryStore>) => store.resetType("RTU"),
  } as const;
  const failures = [
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["23505", "conflict"],
    ["23514", "invalid"],
    ["23503", "in_use"],
    ["55000", "no_pack"],
    ["XX000", "unavailable"],
  ] as const;

  test.each(Object.keys(calls).flatMap((fn) => failures.map(([sqlstate, expected]) => [fn, sqlstate, expected] as const)))(
    "C1938: %s maps SQLSTATE %s to %s",
    async (fn, sqlstate, expected) => {
      const { typed, client } = stubClient({});
      client.rpc.mockResolvedValue({ data: null, error: { code: sqlstate, message: "boom" } });
      expect(await calls[fn as keyof typeof calls](supabaseTaskLibraryStore(typed))).toEqual({ ok: false, code: expected });
    },
  );

  test("C1938: each function calls its own rpc with the names it is given and success returns ok", async () => {
    const { typed, client } = stubClient({});
    client.rpc.mockResolvedValue({ data: "SUMP_PUMP", error: null });
    const store = supabaseTaskLibraryStore(typed);
    expect(await calls.create(store)).toEqual({ ok: true, code: "SUMP_PUMP" });
    expect(await calls.rename(store)).toEqual({ ok: true });
    expect(await calls.remove(store)).toEqual({ ok: true });
    expect(await calls.reset(store)).toEqual({ ok: true });
    expect(client.rpc.mock.calls).toEqual([
      ["create_task_library_type", { p_org_id: "org-1", p_name: "Sump pump" }],
      ["rename_task_library_type", { p_type_code: "SUMP_PUMP", p_name: "Sump" }],
      ["remove_task_library_type", { p_type_code: "SUMP_PUMP" }],
      ["reset_task_library_type", { p_type_code: "RTU" }],
    ]);
  });
});
