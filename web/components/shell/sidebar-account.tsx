import { ITEM_CLASSES } from "./sidebar-nav";

/** Who is signed in, and the way out. Sits under Settings and Members in the sidebar and the drawer, on the Night shell. */
export function SidebarAccount({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  return (
    <div className="mt-2 flex flex-col gap-0.5 border-t border-surface/10 pt-3">
      <p className="truncate px-2.5 pb-1 text-[12px] text-night-ink" title={email}>
        {email}
      </p>
      <form action={signOut}>
        <button type="submit" className={`${ITEM_CLASSES} w-full text-left text-night-ink hover:bg-surface/10 hover:text-surface`}>
          Sign out
        </button>
      </form>
    </div>
  );
}
