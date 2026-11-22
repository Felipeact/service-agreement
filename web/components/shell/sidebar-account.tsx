import { LogOutIcon } from "lucide-react";
import { initialsOf } from "@/lib/initials";
import { ITEM_CLASSES } from "./sidebar-nav";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", estimator: "Estimator", viewer: "Viewer" };

/** "Admin / Owner" style line under the email: the member's role, or nothing when it is unknown. */
export const roleLabel = (role?: string): string | undefined => (role ? (ROLE_LABELS[role] ?? role) : undefined);

/** Who is signed in (avatar, email, role) and the way out. Sits under Settings and Members in the sidebar and the drawer, on the Night shell. */
export function SidebarAccount({ email, role, signOut }: { email: string; role?: string; signOut: () => Promise<void> }) {
  const label = roleLabel(role);
  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-surface/10 pt-3">
      <div className="flex min-w-0 items-center gap-2.5 px-2.5 pb-1">
        <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-action text-[12px] font-semibold text-surface">
          {initialsOf(email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-surface" title={email}>
            {email}
          </p>
          {label && <p className="text-[11px] text-night-ink">{label}</p>}
        </div>
      </div>
      <form action={signOut}>
        <button type="submit" className={`${ITEM_CLASSES} w-full text-left text-night-ink hover:bg-surface/10 hover:text-surface`}>
          <LogOutIcon className="size-[18px]" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
