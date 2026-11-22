import { LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { initialsOf } from "@/lib/initials";

const ROLE_LABELS: Record<string, string> = { owner: "Owner", admin: "Admin", estimator: "Estimator", viewer: "Viewer" };

/** "Admin / Owner" style line under the email: the member's role, or nothing when it is unknown. */
export const roleLabel = (role?: string): string | undefined => (role ? (ROLE_LABELS[role] ?? role) : undefined);

const ICON_BUTTON = "inline-flex size-11 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink lg:size-7";

/** Who is signed in (avatar, role) and, as small icon buttons, Settings, Members and the way out, as the mockup's account row draws it. */
export function SidebarAccount({ email, role, signOut }: { email: string; role?: string; signOut: () => Promise<void> }) {
  const label = roleLabel(role);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-action to-cyan-500 text-[12px] font-bold text-surface ring-2 ring-surface">
          {initialsOf(email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[12px] leading-tight font-semibold text-ink" title={email}>
            {email.split("@")[0]}
          </p>
          {label && <p className="truncate text-[11px] text-ink-2">{label}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Link href="/settings" aria-label="Settings" title="Settings" className={ICON_BUTTON}>
          <SettingsIcon className="size-3.5" aria-hidden="true" />
        </Link>
        <Link href="/members" aria-label="Members" title="Members" className={ICON_BUTTON}>
          <UsersIcon className="size-3.5" aria-hidden="true" />
        </Link>
        <form action={signOut}>
          <button type="submit" aria-label="Sign out" title="Sign out" className={ICON_BUTTON}>
            <LogOutIcon className="size-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
