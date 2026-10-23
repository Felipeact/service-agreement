import { Button } from "@/components/ui/button";

const PRODUCT_NAME = "Service Agreement";

/** Shown instead of the app to a signed-in user who belongs to no org. */
export function NoWorkspace({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[12vh] pb-10">
      <div className="w-full max-w-[400px]">
        <p className="pb-4 text-[15px] font-bold">{PRODUCT_NAME}</p>
        <div className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-6 py-7 sm:px-8">
          <h1 className="text-[22px] leading-tight font-bold">No workspace yet</h1>
          <p className="text-ink-2">
            Your account isn&apos;t part of a company workspace. Ask your company&apos;s owner to invite you.
          </p>
          <p className="text-ink-2">
            Signed in as <span className="font-semibold text-ink">{email}</span>
          </p>
          <form action={signOut} className="mt-2">
            <Button type="submit">Sign out</Button>
          </form>
        </div>
      </div>
    </main>
  );
}
