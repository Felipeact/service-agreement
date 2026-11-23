import type { ReactNode } from "react";
import { AgreementScreen, AgreementsScreen, ContractScreen } from "../_screens/agreements";
import { BillingScreen, MembersScreen, SettingsScreen } from "../_screens/account";
import { ContactFormScreen, CustomerFormScreen, CustomerScreen, CustomersScreen } from "../_screens/customers";
import { ImportJobScreen, ImportsScreen } from "../_screens/imports";
import { ReportsScreen, SearchScreen } from "../_screens/insights";
import { ExpiringScreen, PipelineScreen } from "../_screens/pipeline";
import { AssetFormScreen, SiteFormScreen, SiteImportScreen, SiteScreen, SitesScreen } from "../_screens/sites";
import { TemplateEditorScreen, TemplatesScreen } from "../_screens/templates";
import type { NavKey } from "./shell-parts";

export type ScreenDef = { slug: string; /** The real page to open beside this screen; a list page where the real one needs a record. */ real: string; title: string; group: string; note: string; nav: NavKey | null; bare?: boolean; render: (query: Record<string, string | undefined>) => ReactNode };

/** Every screen of the product in the chosen design, in the order a person meets them. `bare` screens have no staff shell. */
export const SCREENS: ScreenDef[] = [
  { slug: "pipeline", real: "/pipeline", title: "Pipeline", group: "Pipeline", note: "Summary, filters, five stages and Expiring soon", nav: "pipeline", render: (q) => <PipelineScreen initialFollowUps={q.followups === "1"} /> },
  { slug: "expiring", real: "/pipeline?view=expiring", title: "Expiring soon", group: "Pipeline", note: "Accepted agreements ending in 90 days", nav: "pipeline", render: () => <ExpiringScreen /> },
  { slug: "agreements", real: "/agreements", title: "Agreements", group: "Agreements", note: "Every agreement, tabs, search, export", nav: "agreements", render: () => <AgreementsScreen /> },
  { slug: "agreement", real: "/agreements", title: "Agreement detail", group: "Agreements", note: "Lines, schedule, scope, link, versions, activity", nav: "agreements", render: () => <AgreementScreen /> },
  { slug: "contract", real: "/agreements", title: "Contract", group: "Agreements", note: "Signed wording and signatures", nav: "agreements", render: () => <ContractScreen /> },
  { slug: "customers", real: "/customers", title: "Customers", group: "Customers", note: "Cards, search, details sheet", nav: "customers", render: () => <CustomersScreen /> },
  { slug: "customer", real: "/customers", title: "Customer detail", group: "Customers", note: "Agreements, sites, contacts", nav: "customers", render: () => <CustomerScreen /> },
  { slug: "customer-form", real: "/customers/new", title: "New or edit customer", group: "Customers", note: "Form with field errors", nav: "customers", render: () => <CustomerFormScreen /> },
  { slug: "contact-form", real: "/customers", title: "New or edit contact", group: "Customers", note: "Form with field errors", nav: "customers", render: () => <ContactFormScreen /> },
  { slug: "sites", real: "/sites", title: "Sites and units", group: "Sites", note: "Filters, types on site, live agreement", nav: "sites", render: () => <SitesScreen /> },
  { slug: "site", real: "/sites", title: "Site register", group: "Sites", note: "Every unit on one site", nav: "sites", render: () => <SiteScreen /> },
  { slug: "site-form", real: "/sites", title: "New or edit site", group: "Sites", note: "Form", nav: "sites", render: () => <SiteFormScreen /> },
  { slug: "asset-form", real: "/sites", title: "Add or edit a unit", group: "Sites", note: "Form", nav: "sites", render: () => <AssetFormScreen /> },
  { slug: "site-import", real: "/sites", title: "Import a list", group: "Sites", note: "Pick a file, reading, done", nav: "sites", render: () => <SiteImportScreen /> },
  { slug: "imports", real: "/imports", title: "Imports", group: "Imports", note: "History with a recognition bar", nav: "imports", render: () => <ImportsScreen /> },
  { slug: "import-job", real: "/imports", title: "Review an import", group: "Imports", note: "Match each row to a type", nav: "imports", render: () => <ImportJobScreen /> },
  { slug: "templates", real: "/templates", title: "Templates", group: "Templates", note: "Library, use, duplicate, archive", nav: "templates", render: () => <TemplatesScreen /> },
  { slug: "template-editor", real: "/templates", title: "Template editor", group: "Templates", note: "Add, move, edit and remove blocks", nav: "templates", render: () => <TemplateEditorScreen /> },
  { slug: "contract-wording", real: "/templates/contract", title: "Contract wording", group: "Templates", note: "The wording editor", nav: "templates", render: () => <TemplateEditorScreen contract /> },
  { slug: "reports", real: "/reports", title: "Reports", group: "Insights", note: "Range, funnel, stuck deals, revenue", nav: "reports", render: () => <ReportsScreen /> },
  { slug: "search", real: "/search?q=a", title: "Search", group: "Insights", note: "Grouped results as you type", nav: null, render: (q) => <SearchScreen q={q.q ?? ""} /> },
  { slug: "settings", real: "/settings", title: "Settings", group: "Account", note: "Company, default terms, renewal", nav: null, render: () => <SettingsScreen /> },
  { slug: "billing", real: "/settings/billing", title: "Billing", group: "Account", note: "Plans, usage, invoices, cancel", nav: null, render: () => <BillingScreen /> },
  { slug: "members", real: "/members", title: "Members", group: "Account", note: "Invite, roles, remove", nav: null, render: () => <MembersScreen /> },
];