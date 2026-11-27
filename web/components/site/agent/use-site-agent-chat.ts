"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SESSION_QUESTIONS, UNAVAILABLE_MESSAGE, type SiteAgentLink, type SiteAgentResult } from "@/domain/site-agent";

export type ChatEntry = { role: "user" | "assistant"; text: string; link?: SiteAgentLink | null; isError?: boolean };

const STORAGE_KEY = "sp-site-agent";
const LIMIT_TEXT = "That's a lot of questions for one chat. For anything else, write to us from the contact page and a person will reply.";

/**
 * The public chat's state (site agent door 4): the entries, one request at a time, a way to stop it, and a cap per open chat. The chat
 * is kept in this tab's sessionStorage only, so it survives a page change and is gone when the tab closes. Nothing is sent but the
 * question and the last few turns.
 */
export function useSiteAgentChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [isPending, setIsPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading sessionStorage must wait until the browser, after hydration
      if (Array.isArray(saved)) setEntries(saved.slice(-40));
    } catch {
      /* a blocked or corrupt store starts an empty chat */
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-40)));
    } catch {
      /* private mode: the chat just is not kept */
    }
  }, [entries, isLoaded]);

  const questionsAsked = entries.filter((entry) => entry.role === "user").length;
  const isAtLimit = questionsAsked >= MAX_SESSION_QUESTIONS;

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || isPending || isAtLimit) return;
      const history = entries.filter((entry) => !entry.isError).map(({ role, text: said }) => ({ role, text: said }));
      setEntries((current) => [...current, { role: "user", text }]);
      setIsPending(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch("/api/site-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text, history }), signal: controller.signal });
        const result = (await response.json().catch(() => null)) as SiteAgentResult | null;
        if (result?.ok) setEntries((current) => [...current, { role: "assistant", text: result.reply.answer, link: result.reply.link }]);
        else setEntries((current) => [...current, { role: "assistant", text: response.status === 429 ? "You have asked a lot of questions in a short time. Please wait a little, or write to us from the contact page." : (result && !result.ok ? result.error : UNAVAILABLE_MESSAGE), isError: true, link: { path: "/contact", label: "Contact us" } }]);
      } catch (cause) {
        if ((cause as Error)?.name !== "AbortError") setEntries((current) => [...current, { role: "assistant", text: UNAVAILABLE_MESSAGE, isError: true, link: { path: "/contact", label: "Contact us" } }]);
      } finally {
        abortRef.current = null;
        setIsPending(false);
      }
    },
    [entries, isAtLimit, isPending],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setEntries([]);
  }, []);

  return { entries, isPending, isAtLimit, limitText: LIMIT_TEXT, ask, stop, reset };
}
