"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHero } from "@/components/site/sections";
import { LinkButton } from "@/components/ui/link-button";
import { WORKSPACE_MAX_POLLS, WORKSPACE_POLL_MS, panelFor, type WorkspaceAnswer } from "@/domain/billing/workspace-state";

type Props = {
  /** The Checkout session Stripe returned the visitor with; null when the page was opened without one. */
  sessionId: string | null;
  /** Asks whether that session's workspace is built. A rejection counts as `unavailable`. */
  check: (sessionId: string) => Promise<WorkspaceAnswer>;
  /** What the page shows when there is no session id: the copy it had before this panel existed. */
  fallback: ReactNode;
};

/**
 * The success page's body (workspace-pending-state S1). With a session id it says whether the workspace is being built, is
 * ready or could not be built, asking again every 3 seconds, at most 20 times; without one it shows the static copy.
 */
export function WorkspaceStatus({ sessionId, check, fallback }: Props) {
  const [answers, setAnswers] = useState<WorkspaceAnswer[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async (asked: number) => {
      let answer: WorkspaceAnswer;
      try {
        answer = await check(sessionId);
      } catch {
        answer = "unavailable";
      }
      if (stopped) return;
      setAnswers((previous) => [...previous, answer]);
      if (answer === "pending" && asked + 1 < WORKSPACE_MAX_POLLS) timer = setTimeout(() => void ask(asked + 1), WORKSPACE_POLL_MS);
    };
    void ask(0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sessionId, check]);

  if (!sessionId) return <>{fallback}</>;

  const panel = panelFor(answers);
  if (panel === "ready") {
    return (
      <PageHero title="Your workspace is ready." text="We emailed a sign-in link to the address you gave at checkout. Open it, or sign in from here.">
        <div>
          <LinkButton href="/login" variant="primary">
            Sign in
          </LinkButton>
        </div>
      </PageHero>
    );
  }
  if (panel === "refused") {
    return (
      <PageHero title="We could not set up your workspace." text="Your payment went through, but something stopped us from building your workspace. Write to us and we will put it right.">
        <div>
          <LinkButton href="/contact" variant="primary">
            Contact us
          </LinkButton>
        </div>
      </PageHero>
    );
  }
  if (panel === "slow") {
    return (
      <PageHero title="This is taking longer than usual." text="Your subscription is registered and your workspace is still being set up. Look for a sign-in link in your email, or try signing in. If nothing arrives, write to us.">
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/login" variant="primary">
            Sign in
          </LinkButton>
          <LinkButton href="/contact" variant="secondary">
            Contact us
          </LinkButton>
        </div>
      </PageHero>
    );
  }
  return (
    <div role="status" aria-live="polite">
      <PageHero title="Setting up your workspace" text="This usually takes a few seconds. Keep this page open." />
    </div>
  );
}
