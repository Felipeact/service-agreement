import type { AgreementInsighter, AgreementInsightResult, AgreementReader, AssetTypeCatalog } from "@/application/ports";
import { insightFacts } from "@/domain/agreement/insight-facts";

export type AgreementInsightOutcome = AgreementInsightResult | { ok: false; code: "not_found" };

/**
 * Asks the model what to look at on an agreement before it is sent. Only its figures and equipment by type leave (see
 * `insightFacts`); nothing is saved, and the model's answer is text for a person to read, never an action.
 */
export function makeAgreementInsight(reader: AgreementReader, catalog: Pick<AssetTypeCatalog, "tradeContext">, insighter: AgreementInsighter) {
  return async function agreementInsight(agreementId: string): Promise<AgreementInsightOutcome> {
    const agreement = await reader.get(agreementId).catch(() => undefined);
    if (agreement === undefined) return { ok: false, code: "unavailable" };
    if (agreement === null) return { ok: false, code: "not_found" };
    const tradeContext = await catalog.tradeContext().catch(() => null);
    return insighter.insight(insightFacts(agreement, tradeContext));
  };
}
