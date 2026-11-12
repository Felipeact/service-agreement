import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { setupGate } from "@/domain/org-settings/setup";
import { DRAFT_ERROR_MESSAGES, DRAFT_TOO_LARGE_MESSAGE, type DraftErrorCode } from "@/domain/task-library/draft";

/** Seconds. A proposal read by Claude can take most of a minute (other-trade-draft door 3). */
export const maxDuration = 60;

/** A request this large cannot hold a file under the 5 MB limit, so it is refused before it is buffered. */
const MAX_BODY_BYTES = 6 * 1024 * 1024;

const STATUS: Record<DraftErrorCode, number> = {
  invalid_input: 400,
  signed_out: 401,
  forbidden: 403,
  not_available: 409,
  file_too_large: 413,
  unsupported_type: 415,
  unreadable: 422,
  empty_draft: 422,
  unavailable: 503,
};

const refuse = (error: DraftErrorCode, message = DRAFT_ERROR_MESSAGES[error]) => NextResponse.json({ error, message }, { status: STATUS[error] });

/**
 * An owner or admin of a paid "Other" org drafts a catalog from a description and/or a proposal while setup is pending.
 * Nothing is stored: the answer is a draft for the owner to review (other-trade-draft doors 1 to 4).
 */
export async function POST(request: NextRequest) {
  const { currentMember, catalogDraftAllowed, draftCatalog } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") return refuse("signed_out");
  if (member.status !== "member" || setupGate(member.role, true) !== "setup") return refuse("forbidden");
  if (!(await catalogDraftAllowed(member.orgId))) return refuse("not_available");

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return refuse("file_too_large");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse("invalid_input");
  }
  const description = form.get("description");
  const file = form.get("file");
  if ((description !== null && typeof description !== "string") || (file !== null && typeof file === "string")) return refuse("invalid_input");

  const outcome = await draftCatalog({
    ...(typeof description === "string" && { description }),
    ...(file && file.size > 0 && { file: { contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } }),
  });
  if (outcome.ok) return NextResponse.json({ types: outcome.types });
  return outcome.error === "unreadable" && outcome.reason === "too_large" ? refuse("unreadable", DRAFT_TOO_LARGE_MESSAGE) : refuse(outcome.error);
}
