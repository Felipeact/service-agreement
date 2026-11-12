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

/** The main nav with the Sites link named after the org's item ("Sites & stations"). */
export const mainNav = (words: ItemWords): NavItem[] =>
  MAIN_NAV.map((item) => (item.href === "/sites" ? { ...item, label: `Sites & ${words.plural}` } : item));

export const FOOTER_NAV: NavItem[] = [
  { label: "Settings", href: "/settings", icon: "gear" },
  { label: "Members", href: "/members", icon: "people" },
];
