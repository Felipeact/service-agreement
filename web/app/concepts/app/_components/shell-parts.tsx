import Link from "next/link";
import { ChevronsUpDownIcon, FileTextIcon, KanbanIcon, LayoutTemplateIcon, MapPinIcon, SearchIcon, SettingsIcon, TrendingUpIcon, UploadIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { ProductMark } from "@/components/ui/product-mark";
import { COMPANY } from "./data";
import { itemText } from "./kit";

export type NavKey = "pipeline" | "agreements" | "templates" | "customers" | "sites" | "imports" | "reports" | "settings" | "members";

export const NAV: { key: NavKey; label: string; slug: string; icon: LucideIcon; count?: number }[] = [
  { key: "pipeline", label: "Pipeline", slug: "pipeline", icon: KanbanIcon, count: 5 },
  { key: "agreements", label: "Agreements", slug: "agreements", icon: FileTextIcon, count: 7 },
  { key: "templates", label: "Templates", slug: "templates", icon: LayoutTemplateIcon },
  { key: "customers", label: "Customers", slug: "customers", icon: UsersIcon, count: 6 },
  { key: "sites", label: itemText("Sites & equipment"), slug: "sites", icon: MapPinIcon },
  { key: "imports", label: "Imports", slug: "imports", icon: UploadIcon },
  { key: "reports", label: "Reports", slug: "reports", icon: TrendingUpIcon },
];

/** Relative on purpose: from /concepts/app/<variant>/<screen> it stays inside the variant being looked at. */
export const screenHref = (slug: string) => `./${slug}`;

const ROW = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors lg:min-h-10";

export function NavList({ active }: { active: NavKey | null }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const current = item.key === active;
        return (
          <li key={item.key}>
            <Link href={screenHref(item.slug)} aria-current={current ? "page" : undefined} className={`${ROW} ${current ? "bg-action-tint font-semibold text-action-press ring-1 ring-blue-100" : "text-ink-nav hover:bg-board hover:text-ink"}`}>
              <item.icon aria-hidden="true" className={`size-[18px] ${current ? "text-action" : ""}`} strokeWidth={1.9} />
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] font-semibold ${current ? "bg-blue-100 text-action-press" : "bg-board text-ink-2"}`}>{item.count}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Quota() {
  return (
    <div className="rounded-xl bg-linear-to-br from-action to-action-press p-3.5 text-surface shadow-md shadow-action/25">
      <p className="text-[12px] font-medium text-blue-100">Active agreements</p>
      <p className="mt-0.5 text-[18px] font-bold tracking-tight">12 / 50</p>
      <div role="progressbar" aria-label="Active agreements used" aria-valuemin={0} aria-valuemax={50} aria-valuenow={12} className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface/25">
        <div className="h-full w-1/4 rounded-full bg-surface" />
      </div>
      <p className="mt-2 text-[12px] text-blue-100">{COMPANY.plan} plan</p>
    </div>
  );
}

export function Account() {
  return (
    <div className="flex items-center gap-3 border-t border-hairline pt-3">
      <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-action to-cyan-500 text-[12px] font-bold text-surface ring-2 ring-surface">{COMPANY.initials}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-tight">
        <span className="block truncate font-semibold">{COMPANY.member}</span>
        <span className="text-[11px] text-ink-2">{COMPANY.role}</span>
      </span>
      <Link href={screenHref("settings")} aria-label="Settings" className="inline-flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-board hover:text-ink lg:size-8">
        <SettingsIcon aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

export function Workspace() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-ground p-2.5">
      <ProductMark className="size-9 rounded-xl shadow-md shadow-action/20" />
      <span className="min-w-0 flex-1 text-[13px] leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold">Service Pacts</span>
          <span className="rounded-full border border-blue-100 bg-action-tint px-2 text-[10px] leading-4 font-semibold text-action-press">{COMPANY.plan}</span>
        </span>
        <span className="block truncate pt-0.5 text-[12px] text-ink-2">{COMPANY.name}</span>
      </span>
      <ChevronsUpDownIcon aria-hidden="true" className="size-4 text-ink-2" />
    </div>
  );
}

export function SearchField() {
  return (
    <form method="get" action={screenHref("search")} role="search" className="relative">
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-2" />
      <input type="search" name="q" aria-label="Search" placeholder="Search" className="h-11 w-full rounded-control border border-field bg-surface pr-3 pl-8 text-[13px] text-ink lg:h-[34px]" />
    </form>
  );
}

