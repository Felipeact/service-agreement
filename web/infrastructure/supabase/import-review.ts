import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ExtractConfidence, ImportJobStatus, ImportReviewReader, ImportRowStore, ImportRowView, RowWriteResult, WriteFailure } from "@/application/ports";
import { isUuid, normalized } from "@/domain/imports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** PostgREST answers at most this many rows per request, so whole jobs are read in pages of it (import-review door 6). */
const PAGE = 1000;

/** Ids per update when mapping a spelling: 100 uuids keep the request URL short. */
const ID_BATCH = 100;

const ROW_COLUMNS = "id, position, asset_type_raw, asset_type_id, unit_no, type_model, location, confidence, source_ref, skipped, asset_id";

/** Raised by `import_rows_frozen` when the row's job is no longer `extracted` (door 4). */
const FROZEN = "55000";

const REVIEWABLE = new Set(["extracted", "committed"]);

function failure(what: string, error: Pick<PostgrestError, "code" | "message">): { ok: false; code: WriteFailure | "locked" } {
  if (error.code === FROZEN) return { ok: false, code: "locked" };
  if (error.code === "42501") return { ok: false, code: "forbidden" };
  if (error.code === "23503") return { ok: false, code: "not_found" };
  console.error(`${what} failed: ${error.code} ${error.message}`);
  return { ok: false, code: "unavailable" };
}

function unavailable(what: string, cause: unknown): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  return { ok: false, code: "unavailable" };
}

/** Every page of a query, `PAGE` rows at a time, until one comes back short. */
async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

export function supabaseImportReviewReader(client: Client): ImportReviewReader {
  return {
    async forJob(jobId) {
      if (!isUuid(jobId)) return null;
      const { data: job, error } = await client
        .from("import_jobs")
        .select("id, site_id, original_name, status, committed_at, committed_count, sites(name)")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      if (!job || !REVIEWABLE.has(job.status)) return null;

      const rows = await allPages((from, to) =>
        client.from("import_rows").select(ROW_COLUMNS).eq("job_id", jobId).order("position", { ascending: true }).range(from, to),
      );
      const views: ImportRowView[] = rows.map((row) => ({
        id: row.id,
        position: row.position,
        assetTypeRaw: row.asset_type_raw,
        assetTypeId: row.asset_type_id,
        unitNo: row.unit_no,
        typeModel: row.type_model,
        location: row.location,
        confidence: row.confidence as ExtractConfidence,
        sourceRef: row.source_ref,
        skipped: row.skipped,
        assetId: row.asset_id,
      }));
      const committed =
        job.status === "committed" && job.committed_at
          ? { added: job.committed_count ?? 0, skipped: views.filter((row) => row.skipped).length, at: new Date(job.committed_at) }
          : null;

      return {
        job: {
          id: job.id,
          siteId: job.site_id,
          siteName: job.sites?.name ?? "",
          originalName: job.original_name,
          status: job.status as ImportJobStatus,
          committed,
        },
        rows: views,
      };
    },
  };
}

export function supabaseImportRowStore(client: Client): ImportRowStore {
  /** One row's update as the member; RLS hides other orgs' rows, so no row back is `not_found`. */
  async function updateRow(what: string, rowId: string, values: Database["public"]["Tables"]["import_rows"]["Update"]): Promise<RowWriteResult> {
    try {
      const { data, error } = await client.from("import_rows").update(values).eq("id", rowId).select("id");
      if (error) return failure(what, error);
      return (data ?? []).length > 0 ? { ok: true } : { ok: false, code: "not_found" };
    } catch (cause) {
      return unavailable(what, cause);
    }
  }

  return {
    update(rowId, value) {
      return updateRow("Saving an import row", rowId, {
        asset_type_id: value.assetTypeId,
        unit_no: value.unitNo,
        type_model: value.typeModel,
        location: value.location,
      });
    },

    setSkipped(rowId, skipped) {
      return updateRow("Skipping an import row", rowId, { skipped });
    },

    async mapType(jobId, rawNormalized, assetTypeId) {
      try {
        // The job first: a missing or other-org job reads no rows, which would otherwise answer "0 rows mapped".
        const { data: job, error: jobError } = await client.from("import_jobs").select("status").eq("id", jobId).maybeSingle();
        if (jobError) return failure("Mapping an import spelling", jobError);
        if (!job) return { ok: false, code: "not_found" };
        if (job.status !== "extracted") return { ok: false, code: "locked" };
        const untyped = await allPages((from, to) =>
          client
            .from("import_rows")
            .select("id, asset_type_raw")
            .eq("job_id", jobId)
            .is("asset_type_id", null)
            .order("position", { ascending: true })
            .range(from, to),
        );
        const ids = untyped.filter((row) => normalized(row.asset_type_raw ?? "") === rawNormalized).map((row) => row.id);
        let rows = 0;
        for (let at = 0; at < ids.length; at += ID_BATCH) {
          // `asset_type_id is null` again: a row typed since the read above keeps its type.
          const { data, error } = await client
            .from("import_rows")
            .update({ asset_type_id: assetTypeId })
            .in("id", ids.slice(at, at + ID_BATCH))
            .is("asset_type_id", null)
            .select("id");
          if (error) return failure("Mapping an import spelling", error);
          rows += (data ?? []).length;
        }
        return { ok: true, rows };
      } catch (cause) {
        return unavailable("Mapping an import spelling", cause);
      }
    },
  };
}
