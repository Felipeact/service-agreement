"use server";

import { getContainer } from "@/composition";
import { setupGate } from "@/domain/org-settings/setup";
import { normalizeDraft } from "@/domain/task-library/draft";
import type { AddTypesAnswer } from "@/components/setup/draft-state";

/**
 * Adds the types an owner or admin reviewed (other-trade-draft door 1). The submitted draft is cleaned again here, and one the
 * cleaning would change is refused, so what is written is exactly what the owner saw. Never throws for a refusal.
 */
export async function addCatalogTypesAction(input: unknown): Promise<AddTypesAnswer> {
  const { currentMember, addCatalogTypes } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member" || setupGate(member.role, true) !== "setup") return { ok: false, code: "forbidden" };

  const types = normalizeDraft({ types: input });
  if (!Array.isArray(input) || types.length === 0) return { ok: false, code: "invalid" };
  if (types.length !== input.length) return { ok: false, code: "invalid" };

  const result = await addCatalogTypes(member.orgId, types);
  if (result.ok) return { ok: true, added: types.map((type) => type.name) };
  return result;
}
