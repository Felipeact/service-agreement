import type { AgreementLister, AssistantModel, AssistantUsage, SiteLister } from "@/application/ports";
import { DAILY_QUESTION_LIMIT, LIMIT_MESSAGE, UNAVAILABLE_MESSAGE, cleanHistory, readReply, validateQuestion, type AssistantReply } from "@/domain/assistant";

export type AskAssistantResult = { ok: true; reply: AssistantReply; left: number } | { ok: false; error: string };

const MAX_AGREEMENTS = 80;
const MAX_SITES = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

type Deps = {
  agreements: AgreementLister;
  sites: SiteLister;
  model: AssistantModel;
  usage: AssistantUsage;
  now: () => Date;
  today: (now: Date) => string;
};

/**
 * Answers a member's question about their agreements, sites and the page they are on (assistant door 2). The daily limit is checked
 * first and a question counts once the model is asked, so a failed answer still costs one and the limit holds. The reply may carry one
 * action to confirm; this never runs it.
 */
export function makeAskAssistant({ agreements, sites, model, usage, now, today }: Deps) {
  return async function askAssistant(input: { question: unknown; page: string; history: unknown; orgId: string; canAct: boolean }): Promise<AskAssistantResult> {
    const checked = validateQuestion(input.question);
    if (!checked.ok) return checked;
    const clock = now();
    const asked = await usage.countSince(new Date(clock.getTime() - DAY_MS).toISOString()).catch(() => null);
    if (asked === null) return { ok: false, error: UNAVAILABLE_MESSAGE };
    if (asked >= DAILY_QUESTION_LIMIT) return { ok: false, error: LIMIT_MESSAGE };

    const day = today(clock);
    const [agreementRows, siteRows] = await Promise.all([agreements.list({}, day).catch(() => null), sites.listActive().catch(() => null)]);
    if (!agreementRows || !siteRows) return { ok: false, error: UNAVAILABLE_MESSAGE };
    const shownAgreements = agreementRows.slice(0, MAX_AGREEMENTS);
    const shownSites = siteRows.slice(0, MAX_SITES);

    await usage.record(input.orgId).catch(() => undefined);
    const text = await model
      .ask({
        today: day,
        page: input.page,
        canAct: input.canAct,
        agreements: shownAgreements.map((row) => ({ id: row.id, number: row.number, status: row.status, customer: row.customer, site: row.site, annualCents: row.annualCents, termEnd: row.termEnd })),
        sites: shownSites.map((site) => ({ id: site.id, name: site.name, customer: site.customer, liveAgreementNumber: site.liveAgreement?.number ?? null })),
        history: cleanHistory(input.history),
        question: checked.question,
      })
      .catch(() => null);
    const reply =
      text === null ? null : readReply(text, { siteIds: new Set(shownSites.map((site) => site.id)), agreementIds: new Set(shownAgreements.map((row) => row.id)) }, input.canAct);
    return reply ? { ok: true, reply, left: Math.max(0, DAILY_QUESTION_LIMIT - asked - 1) } : { ok: false, error: UNAVAILABLE_MESSAGE };
  };
}
