"use client";

import { ArrowRightIcon, ArrowUpIcon, RotateCcwIcon, SparklesIcon, SquareIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MAX_QUESTION_LENGTH, type AssistantAction, type AssistantTurn } from "@/domain/assistant";

type Result = { ok: true; reply: { answer: string; action: AssistantAction | null }; left: number } | { ok: false; error: string };

/** What the panel calls: the question, and the two actions it may offer to run (the same server actions the pages use). */
export type AskAiActions = {
  ask: (question: string, page: string, history: AssistantTurn[]) => Promise<Result>;
  createAgreement: (siteId: string) => Promise<{ status: string }>;
  generateLines: (agreementId: string) => Promise<{ status: string; added?: number }>;
};

type Entry = AssistantTurn & { action?: AssistantAction | null; error?: boolean };

const STORAGE_KEY = "sp-ask-ai";
const SUGGESTIONS = ["What needs follow-up?", "Which agreements end in the next 60 days?", "Explain this page"];

/**
 * The "Ask AI" button and its docked panel (assistant door 4). The panel sits on the right like a side assistant: a greeting and
 * suggested questions when empty, then the chat. The member asks about their agreements, sites or the page they are on; the answer
 * may come with one button (open a page, start a draft, build its service lines) that does nothing until pressed. The chat is kept in
 * this tab only (sessionStorage), can be stopped, and can be started again.
 */
export function AskAi({ actions, canAct }: { actions: AskAiActions; canAct: boolean }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  /** Bumped by Stop and New chat: an answer that arrives for an older number is dropped. */
  const askId = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading sessionStorage must wait until the browser, after hydration
      if (Array.isArray(saved)) setEntries(saved.slice(-30));
    } catch {
      /* a blocked or corrupt store starts an empty chat */
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-30)));
    } catch {
      /* private mode: the chat just is not kept */
    }
  }, [entries, isLoaded]);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries, isPending, notice]);

  function handleAsk(question: string) {
    const text = question.trim();
    if (!text || isPending) return;
    const history = entries.filter((entry) => !entry.error).map(({ role, text: said }) => ({ role, text: said }));
    const id = ++askId.current;
    setEntries((current) => [...current, { role: "user", text }]);
    setNotice(null);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(async () => {
      const result = await actions.ask(text, pathname, history).catch(() => ({ ok: false, error: "Ask AI could not answer right now. Try again in a moment." }) as Result);
      if (id !== askId.current) return;
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
    handleAsk(inputRef.current?.value ?? "");
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleAsk(event.currentTarget.value);
    }
  }

  /** Drops the pending answer: the server call still finishes, but its reply is ignored. */
  function handleStop() {
    askId.current += 1;
    setEntries((current) => [...current, { role: "assistant", text: "Stopped.", error: true }]);
  }

  function handleReset() {
    askId.current += 1;
    setEntries([]);
    setNotice(null);
    setLeft(null);
  }

  function handleAction(action: AssistantAction) {
    setNotice(null);
    if (action.kind === "open") {
      setIsOpen(false);
      router.push(action.path);
      return;
    }
    startTransition(async () => {
      if (action.kind === "create_agreement") {
        // On success the action redirects to the new draft; a refusal comes back as a status.
        const result = await actions.createAgreement(action.siteId).catch(() => null);
        if (result) setNotice(result.status === "open_exists" ? "That site already has a live agreement." : result.status === "plan_limit" ? "Your plan's live agreement limit is reached." : "The agreement could not be started.");
        else setIsOpen(false);
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
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="ask-ai-panel"
        className="mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3.5 text-[12px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 lg:min-h-9"
      >
        <SparklesIcon aria-hidden="true" className="size-3.5" />
        <span className="max-sm:sr-only">Ask AI</span>
      </button>

      {isOpen &&
        // A portal to <body>: the top bar's backdrop blur would otherwise become the containing block of this fixed panel and squash it into the bar.
        createPortal(
        <aside
          ref={panelRef}
          id="ask-ai-panel"
          role="dialog"
          aria-label="Ask AI"
          tabIndex={-1}
          data-slot="ask-ai"
          className="fixed inset-0 z-[55] flex flex-col overflow-hidden bg-surface outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 lg:inset-y-3 lg:right-3 lg:left-auto lg:w-[400px] lg:rounded-panel lg:shadow-float"
        >
          <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-ink">
              <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <SparklesIcon className="size-3.5" />
              </span>
              Ask AI
            </h2>
            <span className="flex items-center">
              {entries.length > 0 && (
                <button type="button" onClick={handleReset} aria-label="Start a new chat" className="flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board lg:size-9">
                  <RotateCcwIcon aria-hidden="true" className="size-4" />
                </button>
              )}
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close Ask AI" className="flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board lg:size-9">
                <XIcon aria-hidden="true" className="size-5" />
              </button>
            </span>
          </header>

          {entries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto bg-linear-to-b from-action-tint to-surface px-5 py-8 text-center">
              <span aria-hidden="true" className="flex size-24 items-center justify-center rounded-full bg-linear-to-br from-violet-100 via-action-tint to-surface ring-1 ring-violet-200">
                <SparklesIcon className="size-9 text-violet-600" />
              </span>
              <h3 className="text-[22px] leading-7 font-semibold tracking-tight text-ink">Let&apos;s chat!</h3>
              <p className="max-w-[300px] text-[13px] text-ink-nav">
                I can look through your agreements and sites, explain the page you&apos;re on, and offer to start a draft. I read only; anything I offer waits for your tap.
              </p>
              <div className="mt-2 flex w-full flex-col gap-2.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleAsk(suggestion)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-hairline bg-surface px-4 text-left text-[13px] font-medium text-ink transition-colors hover:border-action hover:bg-action-tint"
                  >
                    {suggestion}
                    <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-action" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto bg-ground px-4 py-4">
              {entries.map((entry, index) => (
                <li
                  key={index}
                  className={entry.role === "user" ? "max-w-[88%] self-end rounded-card rounded-br-sm bg-action px-3.5 py-2 text-[13px] text-white" : `flex max-w-[94%] flex-col items-start gap-2 self-start rounded-card rounded-tl-sm px-3.5 py-2 text-[13px] whitespace-pre-wrap ${entry.error ? "bg-danger-tint text-danger" : "bg-surface text-ink ring-1 ring-hairline"}`}
                >
                  {entry.text}
                  {entry.action && (canAct || entry.action.kind === "open") && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAction(entry.action as AssistantAction)}
                      className="inline-flex min-h-11 items-center rounded-full bg-action px-4 text-[13px] font-semibold text-white hover:bg-action-hover disabled:opacity-60 lg:min-h-9"
                    >
                      {entry.action.label}
                    </button>
                  )}
                </li>
              ))}
              {isPending && (
                <li role="status" className="self-start text-[13px] text-ink-2">
                  Thinking…
                </li>
              )}
              {notice && (
                <li role="status" className="self-start rounded-card bg-surface px-3.5 py-2 text-[13px] font-medium text-ink ring-1 ring-hairline">
                  {notice}
                </li>
              )}
            </ol>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-hairline bg-surface p-3">
            <label htmlFor="ask-ai-question" className="sr-only">
              Your question
            </label>
            <textarea
              ref={inputRef}
              id="ask-ai-question"
              name="question"
              rows={2}
              maxLength={MAX_QUESTION_LENGTH}
              autoComplete="off"
              onKeyDown={handleInputKeyDown}
              placeholder="Describe your task or ask a question…"
              className="max-h-32 min-h-[52px] min-w-0 flex-1 resize-none rounded-card border border-field bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-ink-2 focus:border-action focus:ring-3 focus:ring-action/15 focus:outline-none"
            />
            {isPending ? (
              <button type="button" onClick={handleStop} aria-label="Stop" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white hover:bg-ink-nav">
                <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
              </button>
            ) : (
              <button type="submit" aria-label="Send" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-white hover:bg-action-hover">
                <ArrowUpIcon aria-hidden="true" className="size-5" />
              </button>
            )}
          </form>
          <p className="bg-surface px-4 pb-2.5 text-[11px] text-ink-2">
            Your question and a short list of your agreements and sites go to Claude to answer it. The chat stays in this tab only.
            {left !== null && ` ${left} ${left === 1 ? "question" : "questions"} left for now.`}{" "}
            <Link href="/security" className="inline-flex min-h-11 items-center underline lg:min-h-0">
              Security
            </Link>
          </p>
        </aside>,
        document.body,
        )}
    </>
  );
}
