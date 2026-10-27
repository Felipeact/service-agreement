"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { flagRows, isBlocking, isUuid, normalized, validateImportFile } from "@/domain/imports";
import { validateAsset } from "@/domain/records";
import { canWriteRecords } from "@/components/records/state";
import type { CommitState, ConfirmState, DiscardState, ExtractState, MapState, ReadState, RowState, StartState } from "@/components/imports/state";

const FORBIDDEN = { status: "forbidden" } as const;

/** The container and the member's org, or `null` when the member may not import. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, orgId: member.orgId } : null;
}

/**
 * Creates the job and signs its upload URL. Only `fileName` and `size` are read: the org comes from the member, the
 * site from the route, and the content type from the extension (AC 25).
 */
export async function startImportAction(siteId: string, formData: FormData): Promise<StartState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  const checked = validateImportFile({ name: String(formData.get("fileName") ?? ""), size: Number(formData.get("size") ?? "") });
  if (!checked.ok) return { status: "invalid", message: checked.message };
  if (!isUuid(siteId)) return { status: "not_found" };
  const started = await ctx.container.startImport(ctx.orgId, siteId, checked.value);
  if (!started.ok) return { status: started.code };
  return { status: "started", jobId: started.jobId, signedUrl: started.signedUrl, contentType: started.contentType };
}

export async function confirmImportAction(jobId: string): Promise<ConfirmState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const confirmed = await ctx.container.confirmImportUpload(jobId);
  return confirmed.ok ? { status: "uploaded" } : { status: confirmed.code };
}

export async function discardImportAction(jobId: string): Promise<DiscardState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const discarded = await ctx.container.discardImport(jobId);
  if (!discarded.ok) return { status: discarded.code };
  refresh();
  return { status: "discarded" };
}

/** Reads an uploaded job's file and records what was found; a job already read answers with its outcome. */
export async function readImportAction(jobId: string): Promise<ReadState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const read = await ctx.container.readImport(jobId);
  if (!read.ok) return { status: read.code };
  refresh();
  return read.outcome;
}

/** Extracts the next chunk of a read file; the browser calls again until the job is extracted. */
export async function extractImportAction(jobId: string): Promise<ExtractState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const extracted = await ctx.container.extractImport(jobId);
  if (!extracted.ok) return { status: extracted.code };
  refresh();
  if (extracted.state === "extracting") return { status: "extracting", done: extracted.done, total: extracted.total };
  return { status: "extracted", rows: extracted.rows, unmatched: extracted.unmatched };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** Saves one row's type, unit #, type/model and location, checked as the asset form checks them. */
export async function updateImportRowAction(rowId: string, formData: FormData): Promise<RowState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(rowId)) return { status: "not_found" };
  const types = await ctx.container.listAssetTypes();
  const checked = validateAsset(
    { assetTypeId: text(formData, "assetTypeId"), unitNo: text(formData, "unitNo"), typeModel: text(formData, "typeModel"), location: text(formData, "location") },
    types.map((type) => type.id),
  );
  if (!checked.ok) return { status: "invalid", errors: checked.errors };
  const saved = await ctx.container.updateImportRow(rowId, checked.value);
  if (!saved.ok) return { status: saved.code };
  refresh();
  return { status: "saved" };
}

/** Skips a row, or includes it again. */
export async function skipImportRowAction(rowId: string, skipped: boolean): Promise<RowState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(rowId)) return { status: "not_found" };
  const saved = await ctx.container.skipImportRow(rowId, skipped);
  if (!saved.ok) return { status: saved.code };
  refresh();
  return { status: "saved" };
}

/** Gives every untyped row with one spelling the same type. */
export async function mapImportTypeAction(jobId: string, formData: FormData): Promise<MapState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const assetTypeId = text(formData, "assetTypeId");
  const spelling = normalized(text(formData, "rawText"));
  const types = await ctx.container.listAssetTypes();
  if (!spelling || !types.some((type) => type.id === assetTypeId)) return { status: "invalid" };
  const mapped = await ctx.container.mapImportType(jobId, spelling, assetTypeId);
  if (!mapped.ok) return { status: mapped.code };
  refresh();
  return { status: "mapped", rows: mapped.rows };
}

/** Rows that would stop the commit: included, and untyped or over the asset form's limits. */
function blockingRows(rows: Parameters<typeof flagRows>[0]): number {
  const flags = flagRows(rows, []);
  return rows.filter((row) => (flags.get(row.id) ?? []).some(isBlocking)).length;
}

/** Adds the job's included rows to its site. The site comes from the job, never from the request. */
export async function commitImportAction(jobId: string): Promise<CommitState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const review = await ctx.container.reviewImport(jobId);
  if (!review) return { status: "not_found" };
  if (review.job.status === "extracted") {
    const count = blockingRows(review.rows);
    if (count > 0) return { status: "incomplete", count };
    if (!review.rows.some((row) => !row.skipped)) return { status: "nothing_to_add" };
  }
  const committed = await ctx.container.commitImport(jobId);
  if (!committed.ok) {
    if (committed.code !== "incomplete") return { status: committed.code };
    const again = await ctx.container.reviewImport(jobId);
    return { status: "incomplete", count: again ? blockingRows(again.rows) : 0 };
  }
  refresh();
  return { status: "committed", added: committed.added, skipped: committed.skipped };
}
