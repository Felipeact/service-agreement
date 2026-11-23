"use client";

import Link from "next/link";
import { ChevronDownIcon, CreditCardIcon, LogOutIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/initials";
import { roleLabel } from "./sidebar-account";

const ITEM = "flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-2 text-[13px] text-ink outline-none data-[highlighted]:bg-board";

/**
 * The signed-in member's chip at the right of the top bar, with the menu its arrow promises: who they are, Settings,
 * Members, Billing for a member who manages the plan, and Sign out.
 */
export function UserMenu({ email, role, orgName, canManageBilling, signOut }: { email: string; role?: string; orgName: string; canManageBilling: boolean; signOut: () => Promise<void> }) {
  const name = email.split("@")[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${email}`}
          className="group flex items-center gap-2.5 rounded-control border-l border-hairline py-1 pr-1 pl-3 text-left transition-colors duration-150 hover:bg-board"
        >
          <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-action text-[12px] font-semibold text-surface shadow-card">
            {initialsOf(email)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="max-w-[180px] truncate text-[12px] font-semibold text-ink group-hover:text-action">{name}</span>
            <span className="text-[11px] text-ink-2">{roleLabel(role) ?? "Workspace"}</span>
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-4 text-ink-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-panel border border-hairline bg-surface p-1 shadow-lift">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-2 font-normal">
          <span className="truncate text-[13px] font-semibold text-ink">{email}</span>
          <span className="truncate text-[12px] text-ink-2">{`${roleLabel(role) ?? "Member"} · ${orgName}`}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-hairline" />
        <DropdownMenuItem asChild className={ITEM}>
          <Link href="/settings">
            <SettingsIcon aria-hidden="true" className="size-4 text-ink-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={ITEM}>
          <Link href="/members">
            <UsersIcon aria-hidden="true" className="size-4 text-ink-2" />
            Members
          </Link>
        </DropdownMenuItem>
        {canManageBilling && (
          <DropdownMenuItem asChild className={ITEM}>
            <Link href="/settings/billing">
              <CreditCardIcon aria-hidden="true" className="size-4 text-ink-2" />
              Billing
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-hairline" />
        <form action={signOut}>
          <button type="submit" className={`${ITEM} w-full text-left`}>
            <LogOutIcon aria-hidden="true" className="size-4 text-ink-2" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
