import { describe, expect, test } from "vitest";
import { supabaseTaskLibraryReader, supabaseTaskLibraryStore } from "./task-library";
import { stubClient } from "./stub-client";

const typeRow = (code: string, name: string, months: number[], tasks: { description: string; position: number; visit_months: number[] | null }[]) => ({
  id: `id-${code}`,
  code,
  name,
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
      { id: "id-BOILER", code: "BOILER", name: "Boiler", defaultVisitMonths: [10], tasks: [{ description: "Check flue", visitMonths: null }] },
      {
        id: "id-RTU",
        code: "RTU",
        name: "Rooftop unit",
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
