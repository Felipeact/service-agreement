import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { TaskLibraryReader, TaskLibraryStore, TypeFailure, WriteFailure } from "@/application/ports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The most types one read returns (task-library-page door 1). */
const ROW_CAP = 500;

/** SQLSTATEs `save_task_library_type` raises on purpose (door 3). */
const FAILURES: Record<string, WriteFailure> = { "42501": "forbidden", P0002: "not_found" };

/** SQLSTATEs the type functions raise on purpose (type-editor Surface). */
const TYPE_FAILURES: Record<string, TypeFailure> = {
  "42501": "forbidden",
  P0002: "not_found",
  "23505": "conflict",
  "23514": "invalid",
  "23503": "in_use",
  "55000": "no_pack",
};

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

export function supabaseTaskLibraryReader(client: Client): TaskLibraryReader {
  return {
    async list() {
      const { data, error } = await client
        .from("asset_types")
        .select("id, code, name, pack, default_visit_months, asset_type_tasks(description, position, visit_months)")
        .order("name")
        .order("position", { referencedTable: "asset_type_tasks" })
        .limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        pack: row.pack,
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
    async createType(orgId, name) {
      const { data, error } = await client.rpc("create_task_library_type", { p_org_id: orgId, p_name: name });
      if (!error) return { ok: true, code: data };
      return { ok: false, code: typeFailure("Adding", error) };
    },
    async renameType(typeCode, name) {
      const { error } = await client.rpc("rename_task_library_type", { p_type_code: typeCode, p_name: name });
      return error ? { ok: false, code: typeFailure("Renaming", error) } : { ok: true };
    },
    async removeType(typeCode) {
      const { error } = await client.rpc("remove_task_library_type", { p_type_code: typeCode });
      return error ? { ok: false, code: typeFailure("Removing", error) } : { ok: true };
    },
    async resetType(typeCode) {
      const { error } = await client.rpc("reset_task_library_type", { p_type_code: typeCode });
      return error ? { ok: false, code: typeFailure("Resetting", error) } : { ok: true };
    },
  };
}

function typeFailure(doing: string, error: Pick<PostgrestError, "code" | "message">): TypeFailure {
  const code = TYPE_FAILURES[error.code];
  if (code) return code;
  console.error(`${doing} a task library type failed: ${error.code} ${error.message}`);
  return "unavailable";
}
