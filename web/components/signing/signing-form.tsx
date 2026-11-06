"use client";

import { DocusealForm } from "@docuseal/react";
import { useRouter } from "next/navigation";

/**
 * The provider's signing form, embedded (signature-provider door 6). Completing it only refreshes the route: the status of
 * the contract is moved by the provider's webhook (item 3), never by anything the browser says (AC 23).
 */
export function SigningForm({ src, email }: { src: string; email?: string }) {
  const router = useRouter();
  return (
    <DocusealForm
      src={src}
      email={email}
      onComplete={() => router.refresh()}
      className="block min-h-[560px] w-full overflow-hidden rounded-panel border border-hairline bg-surface"
    />
  );
}
