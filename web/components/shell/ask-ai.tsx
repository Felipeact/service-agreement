"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { MAX_QUESTION_LENGTH, type AssistantAction, type AssistantTurn } from "@/domain/assistant";

type Result = { ok: true; reply: { answer: string; action: AssistantAction | null }; left: number } | { ok: false; error: string };

/** What the panel calls: the question, and the two actions it may offer to run (the same server actions the pages use). */
export type AskAiActions = {
  ask: (question: string, page: string, history: AssistantTurn[]) => Promise<Result>;
  createAgreement: (siteId: string) => Promise<{ status: string }>;
  generateLines: (agreementId: string) => Promise<{ status: string; added?: number }>;
};

type Entry = AssistantTurn & { action?: AssistantAction | null; error?: boolean };

const SUGGESTIONS = ["What needs follow-up?", "Which agreements end in the next 60 days?", "Explain this page"];

/**
 * The "Ask AI" button and its panel (assistant door 4). The member asks about their agreements, sites or the page they are on; the
 * answer may come with one button (open a page, start a draft, build its service lines) that does nothing until pressed.
 */
export function AskAi({ actions, canAct }: { actions: AskAiActions; canAct: boolean }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAsk(question: string) {
    const text = question.trim();
    if (!text || isPending) return;
    const history = entries.filter((entry) => !entry.error).map(({ role, text: said }) => ({ role, text: said }));
    setEntries((current) => [...current, { role: "user", text }]);
    setNotice(null);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(async () => {
      const result = await actions.ask(text, pathname, history).catch(() => ({ ok: false, error: "Ask AI could not answer right now. Try again in a moment." }) as Result);
      if (result.ok) {
        setLeft(result.left);
        setEntries((current) => [...current, { role: "assistant", text: result.reply.answer, action: result.reply.action }]);
      } else {
        setEntries((current) => [...current, { role: "assistant", text: result.error, error: true }]);
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAsk(String(new FormData(event.currentTarget).get("question") ?? ""));
  }

  function handleAction(action: AssistantAction) {
    setNotice(null);
    if (action.kind === "open") {
      setOpen(false);
      router.push(action.path);
      return;
    }
    startTransition(async () => {
      if (action.kind === "create_agreement") {
        // On success the action redirects to the new draft; a refusal comes back as a status.
        const result = await actions.createAgreement(action.siteId).catch(() => null);
        if (result) setNotice(result.status === "open_exists" ? "That site already has a live agreement." : result.status === "plan_limit" ? "Your plan's live agreement limit is reached." : "The agreement could not be started.");
        else setOpen(false);
        return;
      }
      const result = await actions.generateLines(action.agreementId).catch(() => null);
      if (result?.status === "generated") {
        setNotice(`Added ${result.added ?? 0} service ${result.added === 1 ? "line" : "lines"}.`);
        router.refresh();
      } else setNotice(result?.status === "locked" ? "That agreement is already sent, so its lines are locked." : "The service lines could not be built.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3.5 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 lg:min-h-9"
      >
        <SparklesIcon aria-hidden="true" className="size-3.5" />
        <span className="max-sm:sr-only">Ask AI</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ask AI" sub="Ask about your agreements, sites or this page. It can only read; anything it offers to do waits for your tap.">
        <div className="flex flex-col gap-3" data-slot="ask-ai">
          {entries.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => handleAsk(suggestion)} className="min-h-11 rounded-full border border-hairline bg-ground px-3.5 text-[13px] font-medium hover:bg-board lg:min-h-9">
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <ol className="flex flex-col gap-3" aria-live="polite">
              {entries.map((entry, index) => (
                <li key={index} className={entry.role === "user" ? "self-end rounded-panel bg-action px-3.5 py-2 text-[13px] text-surface" : `flex flex-col items-start gap-2 whitespace-pre-wrap text-[13px] ${entry.error ? "text-danger" : "text-ink"}`}>
                  {entry.text}
                  {entry.action && (canAct || entry.action.kind === "open") && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAction(entry.action as AssistantAction)}
                      className="inline-flex min-h-11 items-center rounded-control bg-violet-600 px-4 text-[13px] font-semibold text-surface hover:bg-violet-700 disabled:opacity-60 lg:min-h-9"
                    >
                      {entry.action.label}
                    </button>
                  )}
                </li>
              ))}
              {isPending && <li className="text-[13px] text-ink-2">Thinking…</li>}
            </ol>
          )}
          {notice && (
            <p role="status" className="text-[13px] font-medium text-ink">
              {notice}
            </p>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <label htmlFor="ask-ai-question" className="sr-only">
              Your question
            </label>
            <input
              ref={inputRef}
              id="ask-ai-question"
              name="question"
              maxLength={MAX_QUESTION_LENGTH}
              autoComplete="off"
              placeholder="Ask a question"
              className="min-h-11 min-w-0 flex-1 rounded-control border border-field bg-ground px-3 text-[14px] lg:min-h-9"
            />
            <button type="submit" disabled={isPending} className="min-h-11 rounded-control bg-violet-600 px-4 text-[13px] font-semibold text-surface hover:bg-violet-700 disabled:opacity-60 lg:min-h-9">
              Ask
            </button>
          </form>
          <p className="text-[12px] text-ink-2">
            Your question and a short list of your agreements and sites go to Claude to answer it. Nothing is saved but the time you asked.
            {left !== null && ` ${left} ${left === 1 ? "question" : "questions"} left for now.`}{" "}
            <Link href="/security" className="underline">
              Security
            </Link>
          </p>
        </div>
      </Modal>
    </>
  );
}
