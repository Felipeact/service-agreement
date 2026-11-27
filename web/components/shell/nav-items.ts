import type { IconName } from "@/components/ui/icons";
import type { ItemWords } from "@/domain/org-settings";

export type NavItem = {
  label: string;
  /** Absent while the page does not exist yet; the item renders disabled. */
  href?: string;
  icon: IconName;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Pipeline", href: "/pipeline", icon: "pipeline" },
  { label: "Agreements", href: "/agreements", icon: "document" },
  { label: "Templates", href: "/templates", icon: "template" },
  { label: "Customers", href: "/customers", icon: "people" },
  { label: "Sites & equipment", href: "/sites", icon: "pin" },
  { label: "Imports", href: "/imports", icon: "upload" },
];

export const REPORTS_NAV: NavItem = { label: "Reports", href: "/reports", icon: "trend" };

/** The API reference (Swagger): shown to owners and admins whose plan includes the API. */
export const API_NAV: NavItem = { label: "API", href: "/api-docs", icon: "code" };

/** The main nav with the Sites link named after the org's item ("Sites & stations"). Reports follows Imports for a member who may read them (reporting). */
export const mainNav = (words: ItemWords, reports = false, api = false): NavItem[] => [
  ...MAIN_NAV.map((item) => (item.href === "/sites" ? { ...item, label: `Sites & ${words.plural}` } : item)),
  ...(reports ? [REPORTS_NAV] : []),
  ...(api ? [API_NAV] : []),
];

export const FOOTER_NAV: NavItem[] = [
  { label: "Settings", href: "/settings", icon: "gear" },
  { label: "Members", href: "/members", icon: "people" },
];
