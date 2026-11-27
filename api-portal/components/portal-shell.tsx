import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/actions";
import { PortalTabs } from "./portal-tabs";

/**
 * The portal's frame: a slim top bar (the product mark, "API & MCP", a way back to the app, who is signed in and Sign out), the page
 * title and the tabs. It is its own site: no sidebar, no customer data, only the developer tools.
 */
export function PortalShell({ email, orgName, appUrl, children }: { email: string; orgName: string; appUrl: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6 lg:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
            <img src="/brand/mark-blue.svg" alt="" aria-hidden="true" className="size-8 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight text-ink">Service Pacts</span>
              <span className="text-[12px] font-medium text-action">API &amp; MCP</span>
            </span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-x-1 gap-y-0">
            <a href={`${appUrl}/pipeline`} className="inline-flex min-h-11 items-center rounded-control px-3 text-[14px] font-medium text-ink-nav hover:bg-board hover:text-ink">
              Back to the app
            </a>
            <span className="hidden max-w-[16rem] truncate px-2 text-[13px] text-ink-2 sm:inline" title={`${email} at ${orgName}`}>
              {email}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-control px-3 text-[14px] font-medium text-ink-nav hover:bg-board hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] leading-9 font-extrabold tracking-[-0.02em] lg:text-[34px] lg:leading-10">API and MCP</h1>
          <p className="text-[14px] text-ink-nav">Connect your own software or an AI client such as Claude to your Service Pacts data, and watch every call.</p>
        </div>
        <PortalTabs />
        {children}
      </main>
    </div>
  );
}
