"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";
import { canWriteRecords } from "@/components/records/state";
import { MAX_TYPE_COUNT } from "@/domain/records/type-count";

/** What the equipment and contact edits on the agreement page answer. */
export type SiteEditState = { status: "saved" } | { status: "forbidden" | "not_found" | "invalid" | "in_term" | "unavailable" } | { status: "tagged"; tagged: number };

const countSchema = z.object({
  siteId: z.uuid(),
  assetTypeId: z.uuid(),
  count: z.number().int().min(0).max(MAX_TYPE_COUNT),
  /** `null` leaves the units' locations as they are. */
  location: z.string().trim().max(200).nullable(),
});

const contactSchema = z.object({
  siteId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(254),
});

/** The member, when they may write records; signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, orgId: member.orgId } : null;
}

function refresh(agreementId: string, siteId: string) {
  revalidatePath(`/agreements/${agreementId}`);
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/pipeline");
}

/**
 * Sets how many units of one equipment type the agreement's site has, and their location (0 takes the type off the site). Also
 * adds a new type: a count for a type the site does not have yet.
 */
export async function setSiteTypeCountAction(agreementId: string, input: unknown): Promise<SiteEditState> {
  const ctx = await writer();
  if (!ctx) return { status: "forbidden" };
  const parsed = countSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(agreementId).success) return { status: "invalid" };
  const { siteId, assetTypeId, count, location } = parsed.data;
  const result = await ctx.container.setSiteTypeCount(ctx.orgId, siteId, assetTypeId, count, location);
  refresh(agreementId, siteId);
  if (result.ok) return { status: "saved" };
  return result.code === "tagged" ? { status: "tagged", tagged: result.tagged ?? 0 } : { status: result.code };
}

/** Changes who the agreement goes to: the site contact's name and email. */
export async function setAgreementContactAction(agreementId: string, input: unknown): Promise<SiteEditState> {
  const ctx = await writer();
  if (!ctx) return { status: "forbidden" };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(agreementId).success) return { status: "invalid" };
  const result = await ctx.container.setAgreementContact(agreementId, parsed.data.siteId, parsed.data.name, parsed.data.email);
  refresh(agreementId, parsed.data.siteId);
  return result.ok ? { status: "saved" } : { status: result.code };
}
