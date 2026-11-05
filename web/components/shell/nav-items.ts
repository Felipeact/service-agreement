export type NavItem = {
  label: string;
  /** Absent while the page does not exist yet; the item renders disabled. */
  href?: string;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Pipeline", href: "/pipeline" },
  { label: "Agreements", href: "/agreements" },
  { label: "Customers", href: "/customers" },
  { label: "Sites & equipment", href: "/sites" },
  { label: "Imports", href: "/imports" },
  { label: "Task library", href: "/task-library" },
];

export const FOOTER_NAV: NavItem[] = [
  { label: "Settings", href: "/settings" },
  { label: "Members", href: "/members" },
];
