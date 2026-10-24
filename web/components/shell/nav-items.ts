export type NavItem = {
  label: string;
  /** Absent while the page does not exist yet; the item renders disabled. */
  href?: string;
};

export const MAIN_NAV: NavItem[] = [
  { label: "Pipeline", href: "/pipeline" },
  { label: "Agreements" },
  { label: "Customers", href: "/customers" },
  { label: "Sites & equipment" },
  { label: "Imports" },
  { label: "Task library" },
];

export const FOOTER_NAV: NavItem[] = [{ label: "Settings", href: "/settings" }];
