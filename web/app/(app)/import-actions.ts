"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid, validateImportFile } from "@/domain/imports";
import { canWriteRecords } from "@/components/records/state";
import type { ConfirmState, DiscardState, ExtractState, ReadState, StartState } from "@/components/imports/state";

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
