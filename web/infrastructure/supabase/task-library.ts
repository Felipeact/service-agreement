import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { TaskLibraryReader, TaskLibraryStore, WriteFailure } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The most types one read returns (task-library-page door 1). */
const ROW_CAP = 500;

/** SQLSTATEs `save_task_library_type` raises on purpose (door 3). */
const FAILURES: Record<string, WriteFailure> = { "42501": "forbidden", P0002: "not_found" };

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

export function supabaseTaskLibraryReader(client: Client): TaskLibraryReader {
  return {
    async list() {
      const { data, error } = await client
        .from("asset_types")
        .select("id, code, name, default_visit_months, asset_type_tasks(description, position, visit_months)")
        .order("name")
        .order("position", { referencedTable: "asset_type_tasks" })
        .limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        defaultVisitMonths: row.default_visit_months,
        tasks: row.asset_type_tasks.map((task) => ({ description: task.description, visitMonths: task.visit_months })),
      }));
    },
  };
}

export function supabaseTaskLibraryStore(client: Client): TaskLibraryStore {
  return {
    async save(typeCode, value) {
      const { error } = await client.rpc("save_task_library_type", {
        p_type_code: typeCode,
        p_default_months: value.defaultVisitMonths,
        p_tasks: value.tasks,
      });
      if (!error) return { ok: true };
      const code = FAILURES[error.code];
      if (code) return { ok: false, code };
      console.error(`Saving a task library type failed: ${error.code} ${error.message}`);
      return { ok: false, code: "unavailable" };
    },
  };
}
