"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/** How often an open, visible board re-reads the server. */
const INTERVAL_MS = 20_000;
/** How often the caption re-words itself and re-checks whether a card is in use. */
const CAPTION_MS = 15_000;

/** "just now", "1 min ago", "5 min ago": what the caption says about how old the board's data is. */
export function updatedLabel(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "Updated just now";
  return `Updated ${minutes} min ago`;
}

/** A card under the pointer or holding focus stays put, so nothing moves under a click. */
function boardInUse(): boolean {
  const board = document.querySelector("[data-board]");
  return Boolean(board && (board.matches(":hover") || board.matches(":focus-within")));
}

/**
 * Keeps the board current without a manual reload: it re-reads the server when the tab regains focus and on a slow
 * interval while visible, so a customer's answer or a colleague's change shows up on its own. It pauses while a card is
 * in use and says so, says when the browser is offline, and offers a retry once the data has gone stale.
 */
export function LiveRefresh({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  // When a card was last in use: time spent paused on purpose is not time the refresh failed.
  const [lastUsedAt, setLastUsedAt] = useState(0);
  const pausedRef = useRef(false);

  const refresh = useCallback(
    (force: boolean) => {
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      if (!force && boardInUse()) return;
      startTransition(() => {
        router.refresh();
        // Inside the transition, so the stamp moves only once the new board has rendered.
        setRefreshedAt(Date.now());
      });
      setOffline(false);
      setNow(Date.now());
    },
    [router],
  );

  useEffect(() => {
    const syncPaused = () => {
      const next = boardInUse();
      // The moment a card goes from in use to free is when the clock for "stale" restarts.
      if (pausedRef.current && !next) setLastUsedAt(Date.now());
      pausedRef.current = next;
      setPaused(next);
    };
    const timer = window.setInterval(() => refresh(false), INTERVAL_MS);
    const caption = window.setInterval(() => {
      setNow(Date.now());
      syncPaused();
    }, CAPTION_MS);
    const onVisible = () => refresh(true);
    const goOffline = () => setOffline(true);
    const goOnline = () => refresh(true);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerover", syncPaused);
    document.addEventListener("pointerout", syncPaused);
    document.addEventListener("focusin", syncPaused);
    document.addEventListener("focusout", syncPaused);
    window.addEventListener("focus", onVisible);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(caption);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerover", syncPaused);
      document.removeEventListener("pointerout", syncPaused);
      document.removeEventListener("focusin", syncPaused);
      document.removeEventListener("focusout", syncPaused);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [refresh]);

  // Three missed intervals with no new data means the refresh is not landing, whatever the browser says about the network.
  const stale = offline || (!paused && now - Math.max(refreshedAt, lastUsedAt) > INTERVAL_MS * 3 + CAPTION_MS);

  return (
    <span data-live-refresh className={`flex items-center gap-1.5 text-[12px] text-ink-2 ${className}`}>
      {offline ? "Offline. Showing the last data." : stale ? `Couldn't refresh. ${updatedLabel(now - refreshedAt)}.` : paused ? "Paused while you use a card" : updatedLabel(now - refreshedAt)}
      {stale && (
        <button type="button" onClick={() => refresh(true)} className="min-h-11 font-medium text-action lg:min-h-0">
          Retry
        </button>
      )}
    </span>
  );
}
