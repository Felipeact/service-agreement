import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { Database } from "./database.types";

export type Reply = { data: unknown; error: { code: string; message: string } | null };
export type Call = { table: string; method: string; args: unknown[] };

/**
 * A Supabase client double for adapter tests. `from(table)` returns a chainable query that records
 * every call and answers with `tables[table]`: awaited it gives the reply, `maybeSingle()` gives
 * the first row of an array reply (or the object itself).
 */
export function stubClient(tables: Record<string, Reply>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const reply = () => tables[table] ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit", "update", "insert", "delete"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      query.maybeSingle = async () => {
        calls.push({ table, method: "maybeSingle", args: [] });
        const { data, error } = reply();
        return { data: Array.isArray(data) ? (data[0] ?? null) : data, error };
      };
      query.then = (resolve: (value: Reply) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(reply()).then(resolve, reject);
      return query;
    },
    rpc: vi.fn(),
  };
  return { client, calls, typed: client as unknown as SupabaseClient<Database> };
}
