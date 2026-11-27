"use client";

import { ArrowRightIcon, ArrowUpIcon, PaperclipIcon, RotateCcwIcon, SparklesIcon, SquareIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ATTACH_ACCEPT, MAX_QUESTION_LENGTH, validateAttachment, type AssistantLink, type AssistantReply } from "@/domain/assistant";
import { formatFileSize } from "@/domain/imports";
import { itemText } from "@/domain/org-settings";
import { useItemWords } from "./item-words";

type Result = { ok: true; reply: AssistantReply; left: number } | { ok: false; error: string };

/** What the panel calls: the question (and an attached list) as form data, answered by the server action. */
export type AskAiActions = {
  ask: (formData: FormData) => Promise<Result>;
};

type Entry = { role: "user" | "assistant"; text: string; links?: AssistantLink[]; memo?: string; fileName?: string; error?: boolean };

const STORAGE_KEY = "sp-ask-ai";
const OTHER_SUGGESTIONS = ["What needs follow-up?", "Which agreements end in the next 60 days?", "Explain this page"];

/**
 * The "Ask AI" button and its docked panel (assistant door 4). The panel sits on the right like a side assistant: a greeting and
 * suggested questions when empty, then the chat. The member asks about their agreements, or asks it to set things up: it creates
 * customers, sites, equipment and draft agreements itself (for a member who may write records) and says what it did, with buttons
 * to open what it made. A list (csv, Excel, Word or PDF) can be attached; it stays attached until removed, so a follow-up can still
 * use it. The chat is kept in this tab only (sessionStorage), can be stopped, and can be started again.
 */
export function AskAi({ actions }: { actions: AskAiActions }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const words = useItemWords();
  /** The first suggestion starts a set-up from a list in the org's own word for equipment; the model then asks for what it needs. */
  const startFromList = itemText("Create an agreement from an equipment list", words);
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  }, [entries, isPending]);

  function handleAsk(question: string) {
    const text = question.trim();
    if (!text || isPending) return;
    // What the model sees of earlier turns: the words, plus (for its own answers) the note of which records it touched.
    const history = entries.filter((entry) => !entry.error).map((entry) => ({ role: entry.role, text: entry.memo ? `${entry.text}\n${entry.memo}` : entry.text }));
    const id = ++askId.current;
    const sent = file;
    setEntries((current) => [...current, { role: "user", text, ...(sent && { fileName: sent.name }) }]);
    if (inputRef.current) inputRef.current.value = "";
    const body = new FormData();
    body.set("question", text);
    body.set("page", pathname);
    body.set("history", JSON.stringify(history));
    if (sent) body.set("file", sent);
    startTransition(async () => {
      const result = await actions.ask(body).catch(() => ({ ok: false, error: "Ask AI could not answer right now. Try again in a moment." }) as Result);
      if (id !== askId.current) return;
      if (result.ok) {
        setLeft(result.left);
        setEntries((current) => [...current, { role: "assistant", text: result.reply.answer, links: result.reply.links, memo: result.reply.memo }]);
        // Records were made or changed: refresh what the page shows.
        if (result.reply.links.length > 0) router.refresh();
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!chosen) return;
    const checked = validateAttachment({ name: chosen.name, size: chosen.size });
    if (!checked.ok) {
      setFile(null);
      setFileError(checked.message);
      return;
    }
    setFileError(null);
    setFile(chosen);
    inputRef.current?.focus();
  }

  function handleRemoveFile() {
    setFile(null);
    setFileError(null);
  }

  /** Drops the pending answer: the server call still finishes (and may have created records), but its reply is ignored. */
  function handleStop() {
    askId.current += 1;
    setEntries((current) => [...current, { role: "assistant", text: "Stopped. Anything already created is still there.", error: true }]);
  }

  function handleReset() {
    askId.current += 1;
    setEntries([]);
    setLeft(null);
    setFile(null);
    setFileError(null);
  }

  function handleLink(link: AssistantLink) {
    setIsOpen(false);
    router.push(link.path);
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
            className="fixed inset-0 z-[55] flex flex-col overflow-hidden bg-surface outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 lg:inset-y-3 lg:right-3 lg:left-auto lg:w-[420px] lg:rounded-panel lg:shadow-float"
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
                <p className="max-w-[320px] text-[13px] text-ink-nav">
                  {itemText("I can look through your agreements, and set things up for you: create a customer, a site and its equipment, and start the agreement. Attach an equipment list (Excel, CSV, Word or PDF) with the paperclip and tell me which customer and site it is for.", words)}
                </p>
                <div className="mt-2 flex w-full flex-col gap-2.5">
                  {[startFromList, ...OTHER_SUGGESTIONS].map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAsk(index === 0 ? `I want to ${startFromList.charAt(0).toLowerCase()}${startFromList.slice(1)}. Ask me whatever you need, and tell me when to attach the list.` : suggestion)}
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
                    className={entry.role === "user" ? "flex max-w-[88%] flex-col items-end gap-1.5 self-end rounded-card rounded-br-sm bg-action px-3.5 py-2 text-[13px] whitespace-pre-wrap text-white" : `flex max-w-[94%] flex-col items-start gap-2 self-start rounded-card rounded-tl-sm px-3.5 py-2 text-[13px] whitespace-pre-wrap ${entry.error ? "bg-danger-tint text-danger" : "bg-surface text-ink ring-1 ring-hairline"}`}
                  >
                    {entry.fileName && (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[12px]">
                        <PaperclipIcon aria-hidden="true" className="size-3 shrink-0" />
                        <span className="truncate">{entry.fileName}</span>
                      </span>
                    )}
                    {entry.text}
                    {entry.links && entry.links.length > 0 && (
                      <span className="flex flex-wrap gap-2">
                        {entry.links.map((link) => (
                          <button
                            key={link.path}
                            type="button"
                            onClick={() => handleLink(link)}
                            className="inline-flex min-h-11 items-center rounded-full bg-action px-4 text-[13px] font-semibold text-white hover:bg-action-hover lg:min-h-9"
                          >
                            {link.label}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
                {isPending && (
                  <li role="status" className="self-start text-[13px] text-ink-2">
                    {file ? "Reading the list and working on it…" : "Working on it…"}
                  </li>
                )}
              </ol>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-hairline bg-surface p-3">
              {(file || fileError) && (
                <div className="flex items-center gap-2">
                  {file && (
                    <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-hairline bg-board pr-1 pl-3 text-[12px] text-ink">
                      <PaperclipIcon aria-hidden="true" className="size-3.5 shrink-0 text-ink-2" />
                      <span className="truncate">
                        {file.name} · {formatFileSize(file.size)}
                      </span>
                      <button type="button" onClick={handleRemoveFile} aria-label={`Remove ${file.name}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-hairline lg:size-9">
                        <XIcon aria-hidden="true" className="size-4" />
                      </button>
                    </span>
                  )}
                  {fileError && (
                    <p role="alert" className="text-[12px] text-danger">
                      {fileError}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} onChange={handleFileChange} className="sr-only" tabIndex={-1} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label={itemText("Attach an equipment list", words)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-2 hover:bg-board hover:text-ink"
                >
                  <PaperclipIcon aria-hidden="true" className="size-5" />
                </button>
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
                  placeholder="Ask, or tell me what to set up…"
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
              </div>
            </form>
            <p className="bg-surface px-4 pb-2.5 text-[11px] text-ink-2">
              {itemText("Your question, an attached list and the records it needs go to Claude. When you ask, I create customers, sites, equipment and draft agreements; I never send or sign anything. The chat stays in this tab.", words)}
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
