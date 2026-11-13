import { Button, buttonClass } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

const PRODUCT_NAME = "Service Agreement";

/** What a signed-in person with no membership is told about their own paid checkout (workspace-pending-state S2). */
export type NoWorkspaceState = "none" | "pending" | "refused";

const COPY: Record<NoWorkspaceState, { title: string; text: string }> = {
  none: { title: "No workspace yet", text: "Your account isn't part of a company workspace. Ask your company's owner to invite you." },
  pending: { title: "Setting up your workspace", text: "Your payment went through and your workspace is being built. This usually takes a few seconds." },
  refused: { title: "We couldn't set up your workspace", text: "Your payment was received, but something stopped us from building your workspace. Write to us and we will put it right." },
};

/** Shown instead of the app to a signed-in user who belongs to no org. */
export function NoWorkspace({ email, signOut, state = "none" }: { email: string; signOut: () => Promise<void>; state?: NoWorkspaceState }) {
  const { title, text } = COPY[state];
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[12vh] pb-10">
      <div className="w-full max-w-[400px]">
        <p className="pb-4 text-[15px] font-bold">{PRODUCT_NAME}</p>
        <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-6 py-7 sm:px-8">
          <h1 className="text-[22px] leading-tight font-bold">{title}</h1>
          <p className="text-ink-2">{text}</p>
          <p className="text-ink-2">
            Signed in as <span className="font-semibold text-ink">{email}</span>
          </p>
          {state === "pending" && (
            // An empty href reloads this same page, wherever the gate stopped the visitor.
            <a href="" className={buttonClass("primary")}>
              Refresh
            </a>
          )}
          {state === "refused" && (
            <LinkButton href="/contact" variant="primary">
              Contact us
            </LinkButton>
          )}
          <form action={signOut} className="mt-2">
            <Button type="submit">Sign out</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
