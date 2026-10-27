import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { Database } from "./database.types";

export type Reply = { data: unknown; error: { code: string; message: string } | null };
export type Call = { table: string; method: string; args: unknown[] };
/** Successive queries on the table get successive replies; the last one repeats. */
export type Sequence = { sequence: Reply[] };

export type StorageReply = { data: unknown; error: { message: string; status?: number; statusCode?: string } | null };

/**
 * A Supabase client double for adapter tests. `from(table)` returns a chainable query that records
 * every call and answers with `tables[table]`: awaited it gives the reply, `maybeSingle()` gives
 * the first row of an array reply (or the object itself). `storage.from(bucket)` records its calls
 * under `storage:<bucket>` and answers each method with `storage[method]`.
 */
export function stubClient(tables: Record<string, Reply | Sequence>, storage: Record<string, StorageReply | (() => never)> = {}) {
  const calls: Call[] = [];
  const served: Record<string, number> = {};
  const client = {
    from(table: string) {
      const entry = tables[table];
      let reply: Reply | undefined;
      const next = () => {
        if (reply) return reply;
        if (entry && "sequence" in entry) {
          const index = served[table] ?? 0;
          served[table] = index + 1;
          reply = entry.sequence[Math.min(index, entry.sequence.length - 1)];
        } else {
          reply = entry;
        }
        reply ??= { data: null, error: null };
        return reply;
      };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "in", "order", "limit", "range", "update", "insert", "delete"]) {
        query[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return query;
        };
      }
      query.maybeSingle = async () => {
        calls.push({ table, method: "maybeSingle", args: [] });
        const { data, error } = next();
        return { data: Array.isArray(data) ? (data[0] ?? null) : data, error };
      };
      query.then = (resolve: (value: Reply) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(next()).then(resolve, reject);
      return query;
    },
    storage: {
      from(bucket: string) {
        const api: Record<string, unknown> = {};
        for (const method of ["createSignedUploadUrl", "info", "remove", "download"]) {
          api[method] = async (...args: unknown[]) => {
            calls.push({ table: `storage:${bucket}`, method, args });
            const reply = storage[method];
            if (typeof reply === "function") return reply();
            return reply ?? { data: null, error: null };
          };
        }
        return api;
      },
    },
    /** Answers `{ data: null, error: null }` until a test gives it a reply. */
    rpc: vi.fn<(...args: unknown[]) => Promise<Reply>>(async () => ({ data: null, error: null })),
  };
  return { client, calls, typed: client as unknown as SupabaseClient<Database> };
}
