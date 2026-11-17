"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { importReadyEmail, importStalledEmail } from "@/domain/notifications";
import { linkBase } from "./link-base";
import { audienceOf, planLimitMessage } from "@/domain/billing/plan-limits";
import { flagRows, isBlocking, isUuid, normalized, unmatchedSpellings, validateImportFile } from "@/domain/imports";
import { validateAsset } from "@/domain/records";
import { canWriteRecords } from "@/components/records/state";
import type { CommitState, ConfirmState, DiscardState, ExtractState, MapState, SuggestState, ReadState, RowState, StartState } from "@/components/imports/state";

const FORBIDDEN = { status: "forbidden" } as const;

/** The container, the member's org and role, or `null` when the member may not import. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, orgId: member.orgId, role: member.role, email: member.email } : null;
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

/** The jobs this server process is finishing in the background; a second request for one only reports where it is. */
const draining = new Set<string>();
/** More chunks than any file has, so a loop that never ends still ends. */
const MAX_BACKGROUND_CHUNKS = 200;

/**
 * Extracts a read file. The first chunk is done here, so a refusal (the plan's allowance, an unreadable file) comes back at
 * once; the rest is finished in the background, so the job completes even if the person closes the page. The browser looks
 * back with the same call, which only reports progress while the background work runs, and picks the job up again (resume)
 * when the server restarted mid-way.
 */
export async function extractImportAction(jobId: string): Promise<ExtractState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const { importProgress, extractImport, reviewImport, sendEmail } = ctx.container;
  const extracted = await (draining.has(jobId) ? importProgress(jobId) : extractImport(jobId));
  if (extracted.ok && extracted.state === "extracting" && !draining.has(jobId)) {
    draining.add(jobId);
    // Read now: the request is over by the time the background work ends.
    const reviewUrl = `${await linkBase()}/imports/${jobId}`;
    const email = ctx.email;
    after(async () => {
      let last: Awaited<ReturnType<typeof extractImport>> | null = null;
      try {
        for (let chunk = 0; chunk < MAX_BACKGROUND_CHUNKS; chunk += 1) {
          last = await extractImport(jobId);
          if (!last.ok || last.state !== "extracting") break;
        }
      } catch (cause) {
        console.error(`Finishing import ${jobId} in the background failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        last = { ok: false, code: "unavailable" };
      } finally {
        draining.delete(jobId);
      }
      await tellAboutImport({ jobId, email, reviewUrl, last, reviewImport, sendEmail });
    });
  }
  if (!extracted.ok) {
    if (extracted.code === "plan_limit") return { status: "plan_limit", ...planLimitMessage("imports", extracted, audienceOf(ctx.role)) };
    return { status: extracted.code };
  }
  refresh();
  if (extracted.state === "extracting") return { status: "extracting", done: extracted.done, total: extracted.total, background: true };
  return { status: "extracted", rows: extracted.rows, unmatched: extracted.unmatched };
}

/**
 * Emails whoever started the import once the background work ends, since they may have left the page: the review when it is
 * read, a way back in when it stopped. A job a refusal stopped at once (the plan's allowance) never gets here. A failure to
 * email is logged and costs nothing else.
 */
async function tellAboutImport(job: {
  jobId: string;
  email: string;
  reviewUrl: string;
  last: { ok: true; state: "extracting" | "extracted"; rows?: number; unmatched?: number } | { ok: false } | null;
  reviewImport: (jobId: string) => Promise<{ job: { originalName: string; siteName: string } } | null>;
  sendEmail: (message: import("@/application/ports").EmailMessage) => Promise<unknown>;
}): Promise<void> {
  try {
    const found = await job.reviewImport(job.jobId);
    if (!found || !job.last) return;
    const common = { fileName: found.job.originalName, siteName: found.job.siteName, reviewUrl: job.reviewUrl };
    const last = job.last;
    const done = last.ok && last.state === "extracted";
    const content = last.ok && last.state === "extracted" ? importReadyEmail({ ...common, rows: last.rows ?? 0, unmatched: last.unmatched ?? 0 }) : importStalledEmail(common);
    await job.sendEmail({ to: [job.email], fromName: "Service Pacts", idempotencyKey: `import-${done ? "ready" : "stalled"}-${job.jobId}`, ...content });
  } catch (cause) {
    console.error(`Emailing about import ${job.jobId} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
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

/**
 * Asks the model which type each unrecognised spelling of the job means. Nothing is saved or changed: the review shows the
 * suggestions, and the person applies them (one by one or all at once, through `mapImportTypeAction`).
 */
export async function suggestImportTypesAction(jobId: string): Promise<SuggestState> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const review = await ctx.container.reviewImport(jobId);
  if (!review) return { status: "not_found" };
  if (review.job.status !== "extracted") return { status: "idle" };
  const spellings = unmatchedSpellings(review.rows).slice(0, 60);
  if (spellings.length === 0) return { status: "none" };
  const answer = await ctx.container.suggestImportTypes(spellings.map(({ key, raw }) => ({ key, raw })));
  if (!answer.ok) return { status: "unavailable" };
  return answer.suggestions.length > 0 ? { status: "suggested", suggestions: answer.suggestions } : { status: "none" };
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

/**
 * After a list is read: adds it to the site at once when nothing in it needs a person (no row without a type, too long, low
 * confidence, repeated or already on the site). Otherwise nothing is added and the answer is `needs_review`, so the estimator
 * is sent to the review only when the file has something wrong.
 */
export async function commitCleanImportAction(jobId: string): Promise<CommitState | { status: "needs_review" }> {
  const ctx = await writer();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(jobId)) return { status: "not_found" };
  const review = await ctx.container.reviewImport(jobId);
  if (!review) return { status: "not_found" };
  if (review.job.status !== "extracted" || !review.rows.some((row) => !row.skipped)) return { status: "needs_review" };
  const [types, site] = await Promise.all([ctx.container.listAssetTypes(), ctx.container.siteRegister(review.job.siteId)]);
  const idOf = new Map(types.map((type) => [type.code, type.id]));
  const siteAssets = (site?.assets ?? []).flatMap((asset) => {
    const assetTypeId = idOf.get(asset.typeCode);
    return assetTypeId ? [{ assetTypeId, unitNo: asset.unitNo }] : [];
  });
  const flags = flagRows(review.rows, siteAssets);
  if ([...flags.values()].some((found) => found.length > 0)) return { status: "needs_review" };
  const committed = await commitImportAction(jobId);
  return committed.status === "committed" ? committed : { status: "needs_review" };
}
