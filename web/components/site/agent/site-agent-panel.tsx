"use client";

import { ArrowRightIcon, ArrowUpIcon, CircleHelpIcon, HouseIcon, MessageSquareIcon, RotateCcwIcon, SparklesIcon, SquareIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { MAX_QUESTION_LENGTH, MAX_SESSION_QUESTIONS } from "@/domain/site-agent";
import { FAQS, SITE } from "../content";
import { useSiteAgentChat, type ChatEntry } from "./use-site-agent-chat";

type Tab = "home" | "chat" | "help";

const STARTERS = ["What does Service Pacts do?", "How much does it cost?", "Which trades does it fit?", "Can my customer sign without an account?"];
const QUICK_LINKS = [
  { href: "/register", label: "Get started" },
  { href: "/demo", label: "See the demo" },
  { href: "/contact", label: "Contact us" },
] as const;

const TABS: { key: Tab; label: string; icon: typeof HouseIcon }[] = [
  { key: "home", label: "Home", icon: HouseIcon },
  { key: "chat", label: "Messages", icon: MessageSquareIcon },
  { key: "help", label: "Help", icon: CircleHelpIcon },
];

/** The assistant's round mark: the action blue on a small tile, the same on every message. */
function Avatar({ className = "size-8" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-action to-action-press text-white ${className}`}>
      <SparklesIcon className="size-1/2" />
    </span>
  );
}

function Bubble({ entry, onNavigate }: { entry: ChatEntry; onNavigate: () => void }) {
  if (entry.role === "user") {
    return <li className="max-w-[85%] self-end rounded-card rounded-br-sm bg-action px-3.5 py-2 text-[14px] text-white">{entry.text}</li>;
  }
  return (
    <li className="flex max-w-[92%] items-start gap-2 self-start">
      <Avatar className="mt-0.5 size-7" />
      <div className="flex flex-col items-start gap-2">
        <p className={`rounded-card rounded-tl-sm px-3.5 py-2 text-[14px] whitespace-pre-wrap ${entry.isError ? "bg-danger-tint text-danger" : "bg-board text-ink"}`}>{entry.text}</p>
        {entry.link && (
          <Link href={entry.link.path} onClick={onNavigate} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-action/30 bg-action-tint px-4 text-[13px] font-semibold text-action-press transition-colors hover:bg-action hover:text-white lg:min-h-9">
            {entry.link.label}
            <ArrowRightIcon aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * The public chat's panel (site agent door 5): Home with a greeting, starter questions and quick links; Messages, the chat with the
 * assistant; Help, the site's own FAQ and contact addresses. Opens as a sheet on a phone and a floating panel from the corner on a
 * larger screen. The assistant only answers from the site's own words and offers links; it cannot see any account.
 */
export default function SiteAgentPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("home");
  const chat = useSiteAgentChat();
  const listRef = useRef<HTMLOListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.entries, chat.isPending, tab]);

  function handleAsk(question: string) {
    setTab("chat");
    void chat.ask(question);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const question = String(new FormData(form).get("question") ?? "");
    form.reset();
    handleAsk(question);
  }

  const questionsLeft = MAX_SESSION_QUESTIONS - chat.entries.filter((entry) => entry.role === "user").length;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chat with Service Pacts"
      tabIndex={-1}
      data-slot="site-agent"
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-surface outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[392px] sm:rounded-panel sm:shadow-panel sm:ring-1 sm:ring-hairline"
    >
      {tab === "home" ? (
        <div className="relative flex-1 overflow-y-auto">
          <div className="bg-linear-to-b from-action via-action to-action-press px-5 pt-5 pb-14 text-white">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <Avatar className="size-8 bg-white/20 from-white/25 to-white/10" />
                {SITE.name}
              </span>
              <button type="button" onClick={onClose} aria-label="Close chat" className="flex size-11 items-center justify-center rounded-full hover:bg-white/15">
                <XIcon aria-hidden="true" className="size-5" />
              </button>
            </div>
            <h2 className="mt-8 text-[28px] leading-9 font-bold tracking-tight">
              Hi there.
              <br />
              How can we help?
            </h2>
          </div>
          <div className="-mt-9 flex flex-col gap-3 px-4 pb-4">
            <button type="button" onClick={() => setTab("chat")} className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3 text-left shadow-lift transition-colors hover:bg-ground">
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold text-ink">Ask a question</span>
                <span className="text-[12px] text-ink-2">Our AI answers from what is on this site</span>
              </span>
              <ArrowRightIcon aria-hidden="true" className="size-5 shrink-0 text-action" />
            </button>
            <div className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-3">
              <p className="text-[11px] font-semibold tracking-[0.05em] text-ink-2 uppercase">Try asking</p>
              {STARTERS.map((starter) => (
                <button key={starter} type="button" onClick={() => handleAsk(starter)} className="flex min-h-11 items-center justify-between gap-2 rounded-control px-2 text-left text-[13px] font-medium text-ink hover:bg-board">
                  {starter}
                  <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={onClose} className="inline-flex min-h-11 items-center rounded-full border border-hairline bg-surface px-4 text-[13px] font-semibold text-ink-nav hover:bg-board">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
            <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
              <Avatar />
              {tab === "chat" ? "Ask Service Pacts" : "Help"}
            </span>
            <span className="flex items-center">
              {tab === "chat" && chat.entries.length > 0 && (
                <button type="button" onClick={chat.reset} aria-label="Start a new chat" className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-board">
                  <RotateCcwIcon aria-hidden="true" className="size-4" />
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close chat" className="flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-board">
                <XIcon aria-hidden="true" className="size-5" />
              </button>
            </span>
          </header>

          {tab === "chat" ? (
            <>
              <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto bg-ground px-4 py-4">
                <li className="flex max-w-[92%] items-start gap-2 self-start">
                  <Avatar className="mt-0.5 size-7" />
                  <p className="rounded-card rounded-tl-sm bg-board px-3.5 py-2 text-[14px] text-ink">Hi! Ask me about plans, trades, how an agreement goes from import to signature, or anything on this site. I can&apos;t see anyone&apos;s account.</p>
                </li>
                {chat.entries.map((entry, index) => (
                  <Bubble key={index} entry={entry} onNavigate={onClose} />
                ))}
                {chat.isPending && (
                  <li className="flex items-center gap-2 self-start text-[13px] text-ink-2" role="status">
                    <Avatar className="size-7" />
                    Thinking…
                  </li>
                )}
                {chat.isAtLimit && <li className="rounded-card bg-attention-bg px-3.5 py-2 text-[13px] text-attention-fg">{chat.limitText}</li>}
              </ol>
              <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-hairline bg-surface p-3">
                <label htmlFor="site-agent-question" className="sr-only">
                  Your question
                </label>
                <input
                  id="site-agent-question"
                  name="question"
                  maxLength={MAX_QUESTION_LENGTH}
                  autoComplete="off"
                  disabled={chat.isAtLimit}
                  placeholder={chat.isAtLimit ? "Chat limit reached" : "Ask a question…"}
                  className="min-h-11 min-w-0 flex-1 rounded-full border border-field bg-surface px-4 text-[14px] text-ink placeholder:text-ink-2 focus:border-action focus:ring-3 focus:ring-action/15 focus:outline-none disabled:bg-board"
                />
                {chat.isPending ? (
                  <button type="button" onClick={chat.stop} aria-label="Stop answering" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white hover:bg-ink-nav">
                    <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={chat.isAtLimit} aria-label="Send" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-white hover:bg-action-hover active:bg-action-press disabled:opacity-50">
                    <ArrowUpIcon aria-hidden="true" className="size-5" />
                  </button>
                )}
              </form>
              <p className="bg-surface px-4 pb-1 text-center text-[11px] text-ink-2">
                AI answers can be wrong; check the details with us. {questionsLeft > 0 && questionsLeft <= 4 ? `${questionsLeft} left in this chat. ` : ""}
                <Link href="/privacy" onClick={onClose} className="inline-flex min-h-11 items-center px-1 underline">
                  Privacy
                </Link>
              </p>
            </>
          ) : (
            <HelpTab onNavigate={onClose} />
          )}
        </>
      )}

      <nav aria-label="Chat sections" className="grid shrink-0 grid-cols-3 border-t border-hairline bg-surface">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors ${tab === key ? "text-action" : "text-ink-2 hover:text-ink"}`}>
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Help: the FAQ as native disclosures, then the three mailboxes. Static text from the public site's own constants. */
function HelpTab({ onNavigate }: { onNavigate: () => void }): ReactNode {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-ground p-4">
      <div className="flex flex-col divide-y divide-hairline rounded-card border border-hairline bg-surface">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2 text-[13px] font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
              {faq.q}
              <span aria-hidden="true" className="text-ink-2 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-3.5 pb-3 text-[13px] text-ink-nav">{faq.a}</p>
          </details>
        ))}
      </div>
      <div className="rounded-card border border-hairline bg-surface p-3.5 text-[13px] text-ink-nav">
        <p className="font-semibold text-ink">Talk to a person</p>
        <p className="mt-1">
          <span className="block">Buying:</span>
          <a className="inline-flex min-h-11 items-center font-medium text-action underline" href={`mailto:${SITE.salesEmail}`}>{SITE.salesEmail}</a>
          <span className="block">Members:</span>
          <a className="inline-flex min-h-11 items-center font-medium text-action underline" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </p>
        <Link href="/contact" onClick={onNavigate} className="mt-2 inline-flex min-h-11 items-center font-semibold text-action underline">
          Contact page
        </Link>
      </div>
    </div>
  );
}
