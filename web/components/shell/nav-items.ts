import type { IconName } from "@/components/ui/icons";

export type NavItem = {
  label: string;
  /** Absent while the page does not exist yet; the item renders disabled. */
  href?: string;
  icon: IconName;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Pipeline", href: "/pipeline", icon: "pipeline" },
  { label: "Agreements", href: "/agreements", icon: "document" },
  { label: "Customers", href: "/customers", icon: "people" },
  { label: "Sites & equipment", href: "/sites", icon: "pin" },
  { label: "Imports", href: "/imports", icon: "upload" },
];

export const FOOTER_NAV: NavItem[] = [
  { label: "Settings", href: "/settings", icon: "gear" },
  { label: "Members", href: "/members", icon: "people" },
];
