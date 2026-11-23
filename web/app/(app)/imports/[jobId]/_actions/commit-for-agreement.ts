"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";
import type { CommitState } from "@/components/imports/state";
import { commitImportAction } from "../../../import-actions";

const idSchema = z.uuid();

/**
 * The commit of a reviewed list that was uploaded for a new agreement (`?agreement=`): adds the rows to the site, builds the
 * agreement's service lines from the site's equipment with the standard plan (lines by frequency, visits and a suggested price),
 * then opens the agreement. So an agreement made from an upload is complete whether or not its list needed a review; a
 * failed build leaves the "Build service lines" button on the agreement.
 */
export async function commitImportForAgreementAction(jobId: string, agreementId: string): Promise<CommitState> {
  if (!idSchema.safeParse(agreementId).success) return commitImportAction(jobId);
  const committed = await commitImportAction(jobId);
  if (committed.status !== "committed") return committed;
  const container = await getContainer();
  await container.generateServiceLines(agreementId).catch(() => null);
  revalidatePath(`/agreements/${agreementId}`);
  revalidatePath("/pipeline");
  redirect(`/agreements/${agreementId}`);
}
