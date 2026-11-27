import type { SiteAgentModel } from "@/application/ports";
import { UNAVAILABLE_MESSAGE, cleanHistory, readReply, validateQuestion, type SiteAgentResult } from "@/domain/site-agent";

/**
 * Answers a visitor's question from the public site's own words (site agent door 2). No sign-in, no database: the model gets the
 * site's knowledge text, the last few turns and the question, and nothing else. The reply may name one public page as a link.
 */
export function makeAskSiteAgent(model: SiteAgentModel) {
  return async function askSiteAgent(input: { question: unknown; history: unknown }): Promise<SiteAgentResult> {
    const checked = validateQuestion(input.question);
    if (!checked.ok) return checked;
    const text = await model.ask({ history: cleanHistory(input.history), question: checked.question }).catch(() => null);
    const reply = text === null ? null : readReply(text);
    return reply ? { ok: true, reply } : { ok: false, error: UNAVAILABLE_MESSAGE };
  };
}
