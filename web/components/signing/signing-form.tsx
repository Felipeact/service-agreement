"use client";

import { DocusealForm } from "@docuseal/react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

const BOX = "block min-h-[560px] w-full overflow-hidden rounded-panel border border-hairline bg-surface";

const subscribe = () => () => {};

/** `false` in server HTML and while hydrating, `true` once the browser owns the tree. */
function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/**
 * The provider's form, mounted. Completing it only refreshes the route: the status of the contract is moved by the
 * provider's webhook (item 3), never by anything the browser says (signature-provider AC 23).
 */
export function SigningFormEmbed({ src, email }: { src: string; email?: string }) {
  const router = useRouter();
  return <DocusealForm src={src} email={email} onComplete={() => router.refresh()} className={BOX} />;
}

/**
 * The provider's signing form, embedded (signature-provider door 6), created only in the browser. DocuSeal's element attaches
 * a shadow root when it connects; React's streaming reveal moves server-rendered nodes, which connects it a second time and
 * throws `attachShadow`, leaving the signer a blank box (found in the live run). A client-created element connects once.
 */
export function SigningForm(props: { src: string; email?: string }) {
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div role="status" aria-busy="true" className={`${BOX} flex items-center justify-center text-[13px] text-ink-2`}>
        Loading the signing form…
      </div>
    );
  }
  return <SigningFormEmbed {...props} />;
}
