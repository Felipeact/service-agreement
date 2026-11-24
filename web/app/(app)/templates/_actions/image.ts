"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";
import { checkTemplateImageFile, TEMPLATE_IMAGE_FILE_ERROR } from "@/domain/rich-document";
import { canWriteTemplates } from "../_components/state";

export type TemplateImageUploadAnswer = { success: true; path: string; signedUrl: string; contentType: string } | { success: false; message: string };

const NOT_ALLOWED = "You don't have permission to change templates.";
const UNAVAILABLE = "The picture didn't upload. Try again.";

const PickedFile = z.object({ type: z.string().max(100), size: z.number().int().nonnegative() });

/**
 * The first half of a picture upload (rich-templates): the prepared file's type and size are checked again here, only an owner or
 * admin is answered, and what comes back is a signed URL for a new key of the member's own org. The browser PUTs the bytes there;
 * nothing is stored on a template until it is saved.
 */
export async function prepareTemplateImageAction(file: unknown): Promise<TemplateImageUploadAnswer> {
  const parsed = PickedFile.safeParse(file);
  if (!parsed.success) return { success: false, message: TEMPLATE_IMAGE_FILE_ERROR };

  const { currentMember, templateImages } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) return { success: false, message: NOT_ALLOWED };

  const checked = checkTemplateImageFile(parsed.data);
  if (!checked.ok) return { success: false, message: checked.error };

  const prepared = await templateImages.prepareUpload(member.orgId, checked.ext);
  return prepared.ok ? { success: true, path: prepared.path, signedUrl: prepared.signedUrl, contentType: parsed.data.type } : { success: false, message: UNAVAILABLE };
}
