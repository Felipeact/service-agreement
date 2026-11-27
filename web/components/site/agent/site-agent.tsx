"use client";

import { MessageCircleIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

/** The panel is loaded on the first tap, so a visitor who never opens the chat never downloads it. */
const SiteAgentPanel = dynamic(() => import("./site-agent-panel"), { ssr: false });

/** The public pages that carry the chat. The sign-in, sign-up, customer review and signing pages never do. */
export const SITE_AGENT_PATHS: readonly string[] = ["/", "/product", "/demo", "/trades", "/pricing", "/about", "/faq", "/contact", "/security", "/terms", "/privacy"];

export const showsSiteAgent = (pathname: string | null): boolean => pathname !== null && SITE_AGENT_PATHS.includes(pathname);

/**
 * The chat launcher on the public site (site agent door 4): a round button in the corner that opens the chat panel. Mounted once in
 * the root layout; it renders nothing off the public pages, so the staff app and the customer's pages never carry it.
 */
export function SiteAgent() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);
  if (!showsSiteAgent(pathname)) return null;
  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Chat with us"
          data-slot="site-agent-launcher"
          className="fixed right-4 bottom-4 z-50 flex min-h-14 items-center gap-2 rounded-full bg-action px-5 text-[14px] font-semibold text-white shadow-panel transition-colors hover:bg-action-hover active:bg-action-press sm:right-5 sm:bottom-5"
        >
          <MessageCircleIcon aria-hidden="true" className="size-5" />
          <span className="max-sm:sr-only">Ask us anything</span>
        </button>
      )}
      {isOpen && <SiteAgentPanel onClose={handleClose} />}
    </>
  );
}
