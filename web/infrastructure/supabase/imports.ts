import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Clock, ImportJobReader, ImportJobStatus, ImportJobStore, WriteFailure } from "@/application/ports";
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

export function supabaseImportJobStore(client: Client, clock: Clock): ImportJobStore {
  async function job(jobId: string) {
    const { data, error } = await client.from("import_jobs").select("id, org_id, size_bytes, status").eq("id", jobId).maybeSingle();
    if (error) throw new Error(`${error.code} ${error.message}`);
    return data;
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
        if (found.status === "uploaded") return { ok: true };

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
        return now?.status === "uploaded" ? { ok: true } : { ok: false, code: "not_found" };
      } catch (cause) {
        return unavailable("Confirming an import", describe(cause));
      }
    },

    async discard(jobId) {
      try {
        // Row first: a failed object delete then leaves an orphan file nothing reads, never a job without its file.
        const { data, error } = await client.from("import_jobs").delete().eq("id", jobId).select("id, org_id");
        if (error) return failure("Discarding an import", error);
        const [row] = data ?? [];
        if (!row) return { ok: false, code: "not_found" };

        const key = importKey(row.org_id, row.id);
        const removed = await client.storage.from(BUCKET).remove([key]);
        if (removed.error) console.error(`Deleting import file ${BUCKET}/${key} failed: ${removed.error.message}`);
        return { ok: true };
      } catch (cause) {
        return unavailable("Discarding an import", describe(cause));
      }
    },
  };
}

export function supabaseImportJobReader(client: Client): ImportJobReader {
  return {
    async forSite(siteId) {
      if (!UUID.test(siteId)) return [];
      const { data, error } = await client
        .from("import_jobs")
        .select("id, original_name, size_bytes, status, created_by_email, created_at")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      if (error) throw new Error(`Supabase error ${error.code}: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: row.id,
        originalName: row.original_name,
        sizeBytes: row.size_bytes,
        status: row.status as ImportJobStatus,
        uploadedBy: row.created_by_email,
        createdAt: new Date(row.created_at),
      }));
    },
  };
}
