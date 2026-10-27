import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Clock, CommitImportResult, CommitView, ExtractionView, ImportJobReader, ImportJobStatus, ImportJobStore, WriteFailure } from "@/application/ports";
import type { ImportContentType, ReadError, ReadOutcome } from "@/domain/imports";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

const BUCKET = "imports";

/** The most rows one list reads (AD-023). */
const ROW_CAP = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The object key of a job's file (door 3): no file name, so nothing needs sanitising. */
export const importKey = (orgId: string, jobId: string) => `${orgId}/${jobId}`;

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

function failure(what: string, error: Pick<PostgrestError, "code" | "message">): { ok: false; code: WriteFailure } {
  if (error.code === "42501") return { ok: false, code: "forbidden" };
  if (error.code === "23503") return { ok: false, code: "not_found" };
  console.error(`${what} failed: ${error.code} ${error.message}`);
  return { ok: false, code: "unavailable" };
}

function unavailable(what: string, detail: string): { ok: false; code: "unavailable" } {
  console.error(`${what} failed: ${detail}`);
  return { ok: false, code: "unavailable" };
}

type StorageFailure = { message: string; status?: number; statusCode?: string };

/** Storage answers a missing object with 404 (as `status`, or `statusCode` in the body). */
const isMissing = (error: StorageFailure) => error.status === 404 || error.statusCode === "404" || /not.?found/i.test(error.message);

type ReadColumns = { status: string; read_error: string | null; table_count: number | null; row_count: number | null };

const READ_COLUMNS = "id, org_id, status, content_type, read_error, table_count, row_count";

/** A job being, or done being, extracted was read first: its read outcome stays on the row. */
const WAS_READ = new Set(["parsed", "extracting", "extracted", "committed"]);

/** The outcome stored on a job, or `null` while it has not been read (import-parse door 1). */
function outcomeFrom(row: ReadColumns): ReadOutcome | null {
  if (WAS_READ.has(row.status)) return { status: "parsed", tables: row.table_count, rows: row.row_count };
  if (row.status === "unreadable") return { status: "unreadable", reason: row.read_error as ReadError };
  return null;
}

/** A job counts as uploaded once its file is stored, whether or not it has been read since. */
const isStored = (status: string) => status !== "uploading";

const SOURCE_COLUMNS = `${READ_COLUMNS}, extract_cursor, extract_total`;

type Counts = { rows: number; unmatched: number };

/** A commit's result: rows cannot change once committed (import-review door 4), so the rows not added were skipped. */
const commitFrom = (committedCount: number | null, rows: number): CommitView => ({ added: committedCount ?? 0, skipped: rows - (committedCount ?? 0) });

export function supabaseImportJobStore(client: Client, clock: Clock): ImportJobStore {
  async function job(jobId: string) {
    const { data, error } = await client.from("import_jobs").select("id, org_id, size_bytes, status").eq("id", jobId).maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data;
  }

  async function committedResult(jobId: string): Promise<CommitImportResult> {
    const { data, error } = await client.from("import_jobs").select("status, committed_count").eq("id", jobId).maybeSingle();
    if (error) return failure("Reading an import", error);
    if (!data) return { ok: false, code: "not_found" };
    if (data.status !== "committed") return { ok: false, code: "not_ready" };
    const counts = await client.from("import_row_counts").select("rows").eq("job_id", jobId).maybeSingle();
    if (counts.error) return failure("Counting import rows", counts.error);
    return { ok: true, ...commitFrom(data.committed_count, counts.data?.rows ?? 0) };
  }

  return {
    async start(orgId, siteId, file) {
      try {
        const { data, error } = await client
          .from("import_jobs")
          .insert({ org_id: orgId, site_id: siteId, original_name: file.name, size_bytes: file.size, content_type: file.contentType, status: "uploading" })
          .select("id");
        if (error) return failure("Starting an import", error);
        const [row] = data ?? [];
        if (!row) return { ok: false, code: "not_found" };

        const signed = await client.storage.from(BUCKET).createSignedUploadUrl(importKey(orgId, row.id));
        if (signed.error) return unavailable("Signing an import upload", signed.error.message);
        return { ok: true, jobId: row.id, signedUrl: signed.data.signedUrl, contentType: file.contentType };
      } catch (cause) {
        return unavailable("Starting an import", describe(cause));
      }
    },

    async confirmUploaded(jobId) {
      try {
        const found = await job(jobId);
        if (!found) return { ok: false, code: "not_found" };
        if (isStored(found.status)) return { ok: true };

        const info = await client.storage.from(BUCKET).info(importKey(found.org_id, found.id));
        if (info.error) return isMissing(info.error) ? { ok: false, code: "upload_missing" } : unavailable("Checking an import upload", info.error.message);
        if (info.data.size !== found.size_bytes) return { ok: false, code: "upload_missing" };

        // Compare-and-set: only a job still waiting for its file moves, so two confirms write once.
        const { data, error } = await client
          .from("import_jobs")
          .update({ status: "uploaded", updated_at: clock.now().toISOString() })
          .eq("id", jobId)
          .eq("status", "uploading")
          .select("id");
        if (error) return failure("Confirming an import", error);
        if ((data ?? []).length > 0) return { ok: true };

        const now = await job(jobId);
        return now && isStored(now.status) ? { ok: true } : { ok: false, code: "not_found" };
      } catch (cause) {
        return unavailable("Confirming an import", describe(cause));
      }
    },

    async discard(jobId) {
      try {
        // Row first: a failed object delete then leaves an orphan file nothing reads, never a job without its file.
        // A committed job is the record of what was added to the site, so it stays.
        const { data, error } = await client.from("import_jobs").delete().eq("id", jobId).neq("status", "committed").select("id, org_id");
        if (error) return failure("Discarding an import", error);
        const [row] = data ?? [];
        if (!row) return (await job(jobId))?.status === "committed" ? { ok: false, code: "locked" } : { ok: false, code: "not_found" };

        const key = importKey(row.org_id, row.id);
        const removed = await client.storage.from(BUCKET).remove([key]);
        if (removed.error) console.error(`Deleting import file ${BUCKET}/${key} failed: ${removed.error.message}`);
        return { ok: true };
      } catch (cause) {
        return unavailable("Discarding an import", describe(cause));
      }
    },

    async fileOf(jobId) {
      try {
        // As the member: RLS on import_jobs and the `imports` select policy decide what this caller may read.
        const { data, error } = await client.from("import_jobs").select(READ_COLUMNS).eq("id", jobId).maybeSingle();
        if (error) return failure("Reading an import", error);
        if (!data) return { ok: false, code: "not_found" };
        const status = data.status as ImportJobStatus;
        const contentType = data.content_type as ImportContentType;
        if (status !== "uploaded") return { ok: true, status, contentType, outcome: outcomeFrom(data), bytes: null };

        const file = await client.storage.from(BUCKET).download(importKey(data.org_id, data.id));
        if (file.error) return unavailable("Downloading an import", file.error.message);
        return { ok: true, status, contentType, outcome: null, bytes: new Uint8Array(await file.data.arrayBuffer()) };
      } catch (cause) {
        return unavailable("Reading an import", describe(cause));
      }
    },

    async sourceOf(jobId) {
      try {
        const { data, error } = await client.from("import_jobs").select(SOURCE_COLUMNS).eq("id", jobId).maybeSingle();
        if (error) return failure("Reading an import", error);
        if (!data) return { ok: false, code: "not_found" };
        const status = data.status as ImportJobStatus;
        const contentType = data.content_type as ImportContentType;
        const progress =
          data.extract_cursor !== null && data.extract_total !== null ? { cursor: data.extract_cursor, total: data.extract_total } : null;

        let result: Counts | null = null;
        if (status === "extracted") {
          const counts = await client.from("import_row_counts").select("rows, unmatched").eq("job_id", jobId).maybeSingle();
          if (counts.error) return failure("Counting import rows", counts.error);
          result = { rows: counts.data?.rows ?? 0, unmatched: counts.data?.unmatched ?? 0 };
        }
        if (status !== "parsed" && status !== "extracting") return { ok: true, status, contentType, progress, result, bytes: null };

        // As the member, like fileOf: the `imports` select policy decides who may read the file.
        const file = await client.storage.from(BUCKET).download(importKey(data.org_id, data.id));
        if (file.error) return unavailable("Downloading an import", file.error.message);
        return { ok: true, status, contentType, progress, result, bytes: new Uint8Array(await file.data.arrayBuffer()) };
      } catch (cause) {
        return unavailable("Reading an import", describe(cause));
      }
    },

    async recordExtraction(jobId, expectedCursor, total, rows) {
      try {
        const { data, error } = await client.rpc("record_extraction_chunk", {
          p_job_id: jobId,
          // SQL reads null as the first chunk; the generated argument types cannot say an argument may be null.
          p_expected_cursor: expectedCursor as number,
          p_total: total,
          p_rows: rows.map((row) => ({
            asset_type_raw: row.assetTypeRaw,
            unit_no: row.unitNo,
            type_model: row.typeModel,
            location: row.location,
            confidence: row.confidence,
            source_ref: row.sourceRef,
            asset_type_id: row.assetTypeId,
          })),
        });
        if (!error) return { ok: true, progress: { cursor: data, total }, done: data === total };
        if (error.code === "P0002") return { ok: false, code: "not_found" };
        if (error.code === "42501") return { ok: false, code: "forbidden" };
        if (error.code !== "40001") return failure("Recording an import chunk", error);

        // Stale: another call recorded this chunk first. Answer with where the job stands now.
        const { data: row, error: readError } = await client
          .from("import_jobs")
          .select("status, extract_cursor, extract_total")
          .eq("id", jobId)
          .maybeSingle();
        if (readError) return failure("Reading an import", readError);
        if (!row) return { ok: false, code: "not_found" };
        if (row.extract_cursor === null || row.extract_total === null) return { ok: false, code: "unavailable" };
        return { ok: true, progress: { cursor: row.extract_cursor, total: row.extract_total }, done: row.status === "extracted" };
      } catch (cause) {
        return unavailable("Recording an import chunk", describe(cause));
      }
    },

    async commit(jobId) {
      try {
        const { error } = await client.rpc("commit_import", { p_job_id: jobId });
        if (error) {
          if (error.code === "P0002") return { ok: false, code: "not_found" };
          if (error.code === "42501") return { ok: false, code: "forbidden" };
          if (error.code === "23514") return { ok: false, code: "incomplete" };
          if (error.code !== "40001") return failure("Adding imported assets", error);
        }
        // Done, or stale: either way the stored commit is the answer, so a repeat reports what the first call added.
        return await committedResult(jobId);
      } catch (cause) {
        return unavailable("Adding imported assets", describe(cause));
      }
    },

    async recordRead(jobId, outcome) {
      try {
        const at = clock.now().toISOString();
        const values =
          outcome.status === "parsed"
            ? { status: "parsed", table_count: outcome.tables, row_count: outcome.rows, read_error: null, read_at: at, updated_at: at }
            : { status: "unreadable", read_error: outcome.reason, table_count: null, row_count: null, read_at: at, updated_at: at };
        // Compare-and-set: only a job still waiting to be read takes an outcome, so two reads write once.
        const { data, error } = await client.from("import_jobs").update(values).eq("id", jobId).eq("status", "uploaded").select("id");
        if (error) return failure("Recording an import read", error);
        if ((data ?? []).length > 0) return { ok: true, outcome };

        const { data: row, error: readError } = await client.from("import_jobs").select(READ_COLUMNS).eq("id", jobId).maybeSingle();
        if (readError) return failure("Reading an import", readError);
        if (!row) return { ok: false, code: "not_found" };
        const stored = outcomeFrom(row);
        if (stored) return { ok: true, outcome: stored };
        // Still uploading: nothing to read yet. Still uploaded: RLS refused the update.
        return { ok: false, code: row.status === "uploading" ? "not_ready" : "forbidden" };
      } catch (cause) {
        return unavailable("Recording an import read", describe(cause));
      }
    },
  };
}

function extractionFrom(
  row: { status: string; extract_cursor: number | null; extract_total: number | null },
  counts: Counts | undefined,
): ExtractionView | null {
  if (row.status === "extracting" && row.extract_cursor !== null && row.extract_total !== null) {
    return { status: "extracting", cursor: row.extract_cursor, total: row.extract_total };
  }
  if (row.status === "extracted") return { status: "extracted", rows: counts?.rows ?? 0, unmatched: counts?.unmatched ?? 0 };
  return null;
}

export function supabaseImportJobReader(client: Client): ImportJobReader {
  return {
    async forSite(siteId) {
      if (!UUID.test(siteId)) return [];
      const { data, error } = await client
        .from("import_jobs")
        .select(
          "id, original_name, size_bytes, status, created_by_email, created_at, read_error, table_count, row_count, extract_cursor, extract_total, committed_count",
        )
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      const jobs = data ?? [];

      // Counts only for finished extractions and commits, from the view so RLS and a 2,000-row job both hold.
      const counts = new Map<string, Counts>();
      const extracted = jobs.filter((row) => row.status === "extracted" || row.status === "committed").map((row) => row.id);
      if (extracted.length > 0) {
        const { data: rows, error: countError } = await client.from("import_row_counts").select("job_id, rows, unmatched").in("job_id", extracted);
        if (countError) throw new Error(`Supabase error ${countError.code}: ${countError.message}`);
        for (const row of rows ?? []) if (row.job_id) counts.set(row.job_id, { rows: row.rows ?? 0, unmatched: row.unmatched ?? 0 });
      }

      return jobs.map((row) => ({
        id: row.id,
        originalName: row.original_name,
        sizeBytes: row.size_bytes,
        status: row.status as ImportJobStatus,
        uploadedBy: row.created_by_email,
        createdAt: new Date(row.created_at),
        outcome: outcomeFrom(row),
        extraction: extractionFrom(row, counts.get(row.id)),
        ...(row.status === "committed" ? { committed: commitFrom(row.committed_count, counts.get(row.id)?.rows ?? 0) } : {}),
      }));
    },
  };
}
