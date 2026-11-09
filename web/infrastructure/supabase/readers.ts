import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { LIVE_STATUSES, matchesStatusFilter, type AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import { cents, lineAnnualCents, sumCents } from "@/domain/money";
import { addDays, EXPIRING_WINDOW_DAYS, pipelineStage, type ExpiringAgreement } from "@/domain/pipeline";
import type {
  AgreementLister,
  AgreementListRow,
  AssetTypeCatalog,
  AssetView,
  Clock,
  CustomerAgreementView,
  CustomerDetail,
  CustomerDirectory,
  CustomerSummary,
  PipelineCard,
  PipelineReader,
  RecordSearch,
  SearchResults,
  SiteDirectory,
  SiteListRow,
  SiteLister,
  SiteOption,
  SiteRegister,
} from "@/application/ports";
import { SEARCH_GROUP_LIMIT, type SiteFilter } from "@/domain/records";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

/** The most rows one list reads (door 1). */
const ROW_CAP = 500;

const DAY_MS = 86_400_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unexpected(error: Pick<PostgrestError, "code" | "message">): Error {
  return new Error(`Supabase error ${error.code}: ${error.message}`);
}

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

type VersionRow = {
  version_no: number;
  contracts: { status: string }[];
  service_lines: { visits_per_year: number; cost_per_visit_cents: number }[];
};

type AgreementRow = {
  id: string;
  number: string | null;
  status: string;
  updated_at: string;
  agreement_versions: VersionRow[];
};

function latestVersion(row: AgreementRow): VersionRow | undefined {
  return row.agreement_versions.reduce<VersionRow | undefined>(
    (latest, version) => (!latest || version.version_no > latest.version_no ? version : latest),
    undefined,
  );
}

/** Visits and annual amount from the latest version's lines, or nothing when it has none. */
function amounts(version: VersionRow | undefined): { visitsPerYear?: number; annualCents?: number } {
  const lines = version?.service_lines ?? [];
  if (lines.length === 0) return {};
  return {
    visitsPerYear: Math.max(...lines.map((line) => line.visits_per_year)),
    annualCents: sumCents(lines.map((line) => lineAnnualCents(line.visits_per_year, cents(line.cost_per_visit_cents)))),
  };
}

function stageOf(row: AgreementRow) {
  const contract = latestVersion(row)?.contracts[0]?.status as ContractStatus | undefined;
  return { contract, stage: pipelineStage(row.status as AgreementStatus, contract) };
}

const AGREEMENT_COLUMNS =
  "id, number, status, updated_at, agreement_versions(version_no, contracts(status), service_lines(visits_per_year, cost_per_visit_cents))";

export function supabasePipelineReader(client: Client, clock: Clock): PipelineReader {
  return {
    async board() {
      const { data, error } = await client
        .from("agreements")
        .select(`${AGREEMENT_COLUMNS}, renews_agreement_id, sites(name, customers(name))`)
        .order("updated_at", { ascending: false })
        .limit(ROW_CAP);
      if (error) throw unexpected(error);

      const now = clock.now().getTime();
      const rows = data as unknown as (AgreementRow & { renews_agreement_id: string | null; sites: { name: string; customers: { name: string } } })[];
      // A renewal is created after the agreement it renews, so it is in this newest-first read whenever that one is.
      const renewed = new Set(rows.filter((row) => row.renews_agreement_id && row.status !== "withdrawn").map((row) => row.renews_agreement_id));
      const cards: PipelineCard[] = [];
      for (const row of rows) {
        const { contract, stage } = stageOf(row);
        if (!stage) continue;
        // An accepted agreement with a live renewal leaves the board; the renewal stands for it (renewal door 7).
        if (row.status === "accepted" && renewed.has(row.id)) continue;
        const version = latestVersion(row);
        const attention =
          row.status === "changes_requested"
            ? "Changes requested"
            : contract === "client_signed"
              ? "Awaiting countersignature"
              : undefined;
        cards.push({
          id: row.id,
          stage,
          status: row.status as AgreementStatus,
          site: row.sites.name,
          customer: row.sites.customers.name,
          number: row.number,
          versionNo: version?.version_no ?? 1,
          ageDays: Math.max(0, Math.floor((now - new Date(row.updated_at).getTime()) / DAY_MS)),
          ...(attention && { attention }),
          ...amounts(version),
          isRenewal: Boolean(row.renews_agreement_id),
        });
      }
      return cards;
    },

    async expiring(today) {
      const last = addDays(today, EXPIRING_WINDOW_DAYS);
      const { data, error } = await client
        .from("agreements")
        .select("id, number, site_id, sites(name, customers(name)), agreement_versions(version_no, term_end, snapshot, service_lines(visits_per_year, cost_per_visit_cents))")
        .eq("status", "accepted")
        .limit(ROW_CAP);
      if (error) throw unexpected(error);
      type Row = {
        id: string;
        number: string | null;
        site_id: string;
        sites: { name: string; customers: { name: string } };
        agreement_versions: { version_no: number; term_end: string | null; snapshot: unknown; service_lines: VersionRow["service_lines"] }[];
      };
      const due = (data as unknown as Row[]).flatMap((row) => {
        const [version] = [...row.agreement_versions].sort((a, b) => b.version_no - a.version_no);
        return version?.term_end && version.term_end >= today && version.term_end <= last ? [{ row, version, termEnd: version.term_end }] : [];
      });
      if (due.length === 0) return [];

      // The notice the version froze, else the org's current one (renewal door 3).
      const { data: settings, error: settingsError } = await client.from("org_settings").select("renewal_notice_days").maybeSingle();
      if (settingsError) throw unexpected(settingsError);
      const orgNotice = (settings as { renewal_notice_days: number } | null)?.renewal_notice_days ?? 30;

      const { data: renewals, error: renewalsError } = await client
        .from("agreements")
        .select("id, number, status, renews_agreement_id")
        .in("renews_agreement_id", due.map(({ row }) => row.id));
      if (renewalsError) throw unexpected(renewalsError);
      const { data: open, error: openError } = await client
        .from("agreements")
        .select("number, site_id, status")
        .in("site_id", due.map(({ row }) => row.site_id))
        .in("status", [...LIVE_STATUSES]);
      if (openError) throw unexpected(openError);

      const renewalOf = new Map(
        ((renewals ?? []) as { id: string; number: string | null; status: string; renews_agreement_id: string | null }[]).map((r) => [
          r.renews_agreement_id,
          { id: r.id, number: r.number ?? "", status: r.status },
        ]),
      );
      const openOn = new Map(
        ((open ?? []) as { number: string | null; site_id: string; status: string }[])
          .filter((r) => (LIVE_STATUSES as readonly string[]).includes(r.status))
          .map((r) => [r.site_id, r.number ?? ""]),
      );

      return due
        .map(({ row, version, termEnd }): ExpiringAgreement => {
          const terms = (version.snapshot as { terms?: { renewalNoticeDays?: unknown } } | null)?.terms;
          const notice = typeof terms?.renewalNoticeDays === "number" ? terms.renewalNoticeDays : orgNotice;
          return {
            id: row.id,
            number: row.number ?? "",
            site: row.sites.name,
            customer: row.sites.customers.name,
            termEnd,
            noticeDate: addDays(termEnd, -notice),
            annualCents: sumCents(version.service_lines.map((line) => lineAnnualCents(line.visits_per_year, cents(line.cost_per_visit_cents)))),
            renewal: renewalOf.get(row.id) ?? null,
            openAgreement: openOn.get(row.site_id) ?? null,
          };
        })
        .sort((a, b) => a.termEnd.localeCompare(b.termEnd) || a.number.localeCompare(b.number));
    },
  };
}

type Inactive = { deactivated_at?: string | null };
const isActive = (row: Inactive) => !row.deactivated_at;

type ContactRow = { id: string; name: string; email: string | null; phone: string | null; created_at: string };

function primaryContact(contacts: ContactRow[]): string | null {
  const [first] = [...contacts].sort((a, b) => a.created_at.localeCompare(b.created_at) || byName(a.name, b.name));
  return first?.name ?? null;
}

export function supabaseCustomerDirectory(client: Client): CustomerDirectory {
  return {
    async list() {
      const { data, error } = await client
        .from("customers")
        .select("id, name, deactivated_at, contacts!contacts_customer_id_org_id_fkey(id, name, email, phone, created_at), sites(deactivated_at, assets(deactivated_at))")
        .order("name")
        .limit(ROW_CAP);
      if (error) throw unexpected(error);

      const rows = data as unknown as {
        id: string;
        name: string;
        deactivated_at: string | null;
        contacts: ContactRow[];
        sites: { deactivated_at: string | null; assets: Inactive[] }[];
      }[];
      return rows
        .map<CustomerSummary>((row) => {
          const sites = row.sites.filter(isActive);
          return {
            id: row.id,
            name: row.name,
            primaryContact: primaryContact(row.contacts),
            active: isActive(row),
            siteCount: sites.length,
            assetCount: sites.reduce((total, site) => total + site.assets.filter(isActive).length, 0),
          };
        })
        .sort((a, b) => byName(a.name, b.name));
    },

    async detail(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("customers")
        .select(
          `id, name, deactivated_at, billing_contact_id, contacts!contacts_customer_id_org_id_fkey(id, name, email, phone, created_at),
           sites(id, name, address, site_contact_id, approver_contact_id, created_at, deactivated_at, assets(deactivated_at), agreements(${AGREEMENT_COLUMNS}))`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;

      const row = data as unknown as {
        id: string;
        name: string;
        deactivated_at: string | null;
        billing_contact_id?: string | null;
        contacts: ContactRow[];
        sites: {
          id: string;
          name: string;
          address: string | null;
          site_contact_id: string | null;
          approver_contact_id?: string | null;
          created_at: string;
          deactivated_at: string | null;
          assets: Inactive[];
          agreements: AgreementRow[];
        }[];
      };

      const contacts = [...row.contacts].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const sites = [...row.sites].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const agreementRows = sites.flatMap((site) => site.agreements.map((agreement) => ({ site, agreement })));
      agreementRows.sort((a, b) => b.agreement.updated_at.localeCompare(a.agreement.updated_at));

      const agreements = agreementRows.flatMap<CustomerAgreementView>(({ site, agreement }) => {
        const { stage } = stageOf(agreement);
        if (!stage) return [];
        const version = latestVersion(agreement);
        return [
          {
            id: agreement.id,
            siteName: site.name,
            number: agreement.number,
            versionNo: version?.version_no ?? 1,
            stage,
            ...amounts(version),
          },
        ];
      });

      const detail: CustomerDetail = {
        id: row.id,
        name: row.name,
        active: isActive(row),
        billingContactId: row.billing_contact_id ?? null,
        contacts: contacts.map(({ id: contactId, name, email, phone }) => ({
          id: contactId,
          name,
          email,
          phone,
          roles: [
            ...(row.billing_contact_id === contactId ? [{ kind: "billing" as const }] : []),
            ...sites.filter(isActive).flatMap((site) => [
              ...(site.approver_contact_id === contactId ? [{ kind: "approver" as const, site: site.name }] : []),
              ...(site.site_contact_id === contactId ? [{ kind: "site" as const, site: site.name }] : []),
            ]),
          ],
        })),
        sites: sites.map((site) => ({
          id: site.id,
          name: site.name,
          address: site.address,
          contactName: contacts.find((contact) => contact.id === site.site_contact_id)?.name ?? null,
          assetCount: site.assets.filter(isActive).length,
          active: isActive(site),
        })),
        agreements,
      };
      return detail;
    },

    async contact(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client.from("contacts").select("id, customer_id, name, email, phone").eq("id", id).maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;
      return { id: data.id, customerId: data.customer_id, name: data.name, email: data.email, phone: data.phone };
    },
  };
}

/** A replacement is named by its unit no, else its type code (deactivation AC 3). */
function replacementLabel(asset: { unit_no: string | null; asset_types: { code: string } } | undefined): string | null {
  return asset ? (asset.unit_no ?? asset.asset_types.code) : null;
}

export function supabaseSiteRegister(client: Client): SiteRegister {
  return {
    async get(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("sites")
        .select(
          `id, name, address, customer_id, site_contact_id, approver_contact_id, deactivated_at,
           customers(name, deactivated_at, contacts!contacts_customer_id_org_id_fkey(id, name)),
           assets(id, unit_no, type_model, location, source, deactivated_at, replaced_by_asset_id, asset_types(code, name)),
           agreements(id, number, status)`,
        )
        .eq("id", id)
        .limit(ROW_CAP, { foreignTable: "assets" })
        .maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;

      const row = data as unknown as {
        id: string;
        name: string;
        address: string | null;
        customer_id: string;
        site_contact_id: string | null;
        approver_contact_id?: string | null;
        deactivated_at: string | null;
        customers: { name: string; deactivated_at: string | null; contacts: { id: string; name: string }[] };
        assets: {
          id: string;
          unit_no: string | null;
          type_model: string | null;
          location: string | null;
          source: string;
          deactivated_at: string | null;
          replaced_by_asset_id: string | null;
          asset_types: { code: string; name: string };
        }[];
        agreements?: { id: string; number: string | null; status: string }[];
      };
      const byId = new Map(row.assets.map((asset) => [asset.id, asset]));
      const live = (row.agreements ?? []).find((agreement) => LIVE_STATUSES.includes(agreement.status as AgreementStatus));

      return {
        id: row.id,
        name: row.name,
        address: row.address,
        customerId: row.customer_id,
        customerName: row.customers.name,
        active: isActive(row),
        customerActive: isActive(row.customers),
        siteContactId: row.site_contact_id,
        contactName: row.customers.contacts.find((contact) => contact.id === row.site_contact_id)?.name ?? null,
        approverContactId: row.approver_contact_id ?? null,
        approverName: row.customers.contacts.find((contact) => contact.id === row.approver_contact_id)?.name ?? null,
        assets: row.assets.map<AssetView>((asset) => ({
          id: asset.id,
          typeCode: asset.asset_types.code,
          typeName: asset.asset_types.name,
          unitNo: asset.unit_no,
          typeModel: asset.type_model,
          location: asset.location,
          source: asset.source === "import" ? "import" : "manual",
          active: isActive(asset),
          replacedBy: replacementLabel(asset.replaced_by_asset_id ? byId.get(asset.replaced_by_asset_id) : undefined),
        })),
        liveAgreement: live ? { id: live.id, number: live.number ?? "", status: live.status as AgreementStatus } : null,
      };
    },

    async asset(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("assets")
        .select("id, site_id, asset_type_id, unit_no, type_model, location, deactivated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;
      return {
        id: data.id,
        siteId: data.site_id,
        assetTypeId: data.asset_type_id,
        unitNo: data.unit_no,
        typeModel: data.type_model,
        location: data.location,
        active: !data.deactivated_at,
      };
    },
  };
}

export function supabaseAssetTypeCatalog(client: Client): AssetTypeCatalog {
  return {
    async list() {
      const { data, error } = await client.from("asset_types").select("id, code, name, synonyms").order("name").limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map(({ id, code, name, synonyms }) => ({ id, code, name, synonyms }));
    },
    async tradeContext() {
      // RLS leaves the member's own org; the app has no org switcher (decision 9), so there is one row.
      const { data, error } = await client.from("org_settings").select("trade_context").limit(1).maybeSingle();
      if (error) throw unexpected(error);
      return data?.trade_context ?? null;
    },
  };
}

type ListRow = AgreementRow & {
  site_id: string;
  sites: { name: string; customers: { name: string } };
  agreement_versions: (VersionRow & { term_end: string | null })[];
};

/** Every agreement of the org in any status, narrowed by the filter (agreements-page S1). The site is asked of the database; status and window need the latest version, so they apply to the rows read. */
export function supabaseAgreementLister(client: Client): AgreementLister {
  return {
    async list(filter, today) {
      let query = client
        .from("agreements")
        .select(
          "id, number, status, updated_at, site_id, sites(name, customers(name)), agreement_versions(version_no, term_end, contracts(status), service_lines(visits_per_year, cost_per_visit_cents))",
        );
      if (filter.siteId) query = query.eq("site_id", filter.siteId);
      const { data, error } = await query.order("updated_at", { ascending: false }).limit(ROW_CAP);
      if (error) throw unexpected(error);

      const last = addDays(today, EXPIRING_WINDOW_DAYS);
      const rows: AgreementListRow[] = [];
      for (const row of data as unknown as ListRow[]) {
        const version = latestVersion(row) as (VersionRow & { term_end: string | null }) | undefined;
        const termEnd = version?.term_end ?? null;
        const status = row.status as AgreementStatus;
        if (filter.siteId && row.site_id !== filter.siteId) continue;
        if (filter.status && !matchesStatusFilter(filter.status, status, version?.contracts[0]?.status as ContractStatus | undefined)) continue;
        if (filter.expiring && !(status === "accepted" && termEnd && termEnd >= today && termEnd <= last)) continue;
        rows.push({
          id: row.id,
          number: row.number,
          status,
          site: row.sites.name,
          customer: row.sites.customers.name,
          versionNo: version?.version_no ?? 1,
          annualCents: amounts(version).annualCents ?? null,
          updatedAt: row.updated_at,
          termEnd,
        });
      }
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}

/** The active sites, each with the live agreement it already has (agreements-page S2). */
export function supabaseSiteLister(client: Client): SiteLister {
  return {
    async listActive() {
      const { data, error } = await client
        .from("sites")
        .select("id, name, deactivated_at, customers(id, name, deactivated_at), agreements(id, number, status)")
        .is("deactivated_at", null)
        .limit(ROW_CAP);
      if (error) throw unexpected(error);
      type Row = {
        id: string;
        name: string;
        deactivated_at: string | null;
        customers: { id: string; name: string; deactivated_at: string | null };
        agreements: { id: string; number: string | null; status: string }[];
      };
      return (data as unknown as Row[])
        .filter((row) => isActive(row) && isActive(row.customers))
        .map((row): SiteOption => {
          const live = row.agreements.find((agreement) => (LIVE_STATUSES as readonly string[]).includes(agreement.status));
          return {
            id: row.id,
            name: row.name,
            customerId: row.customers.id,
            customer: row.customers.name,
            liveAgreement: live ? { id: live.id, number: live.number ?? "" } : null,
          };
        })
        .sort((a, b) => byName(a.customer, b.customer) || byName(a.name, b.name));
    },
  };
}

type DirectoryRow = {
  id: string;
  name: string;
  address: string | null;
  customer_id: string;
  deactivated_at: string | null;
  customers: { id: string; name: string; deactivated_at: string | null };
  assets: { deactivated_at: string | null; asset_types: { code: string } }[];
  agreements: { id: string; number: string | null; status: string }[];
};

function equipmentOf(assets: DirectoryRow["assets"]): SiteListRow["equipment"] {
  const counts = new Map<string, number>();
  for (const asset of assets.filter(isActive)) counts.set(asset.asset_types.code, (counts.get(asset.asset_types.code) ?? 0) + 1);
  return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/** Every site across customers with its equipment and live agreement, narrowed by the filter (sites-page S1, S2). The customer is asked of the database; text and inactive apply to the rows read. */
export function supabaseSiteDirectory(client: Client): SiteDirectory {
  return {
    async list(filter: SiteFilter) {
      let query = client
        .from("sites")
        .select(
          "id, name, address, customer_id, deactivated_at, customers(id, name, deactivated_at), assets(deactivated_at, asset_types(code)), agreements(id, number, status)",
        );
      if (filter.customerId) query = query.eq("customer_id", filter.customerId);
      const { data, error } = await query.limit(ROW_CAP);
      if (error) throw unexpected(error);

      const text = filter.q?.toLowerCase();
      return (data as unknown as DirectoryRow[])
        .filter((row) => !filter.customerId || row.customer_id === filter.customerId)
        .map((row): SiteListRow => {
          const live = row.agreements.find((agreement) => (LIVE_STATUSES as readonly string[]).includes(agreement.status));
          const equipment = equipmentOf(row.assets);
          return {
            id: row.id,
            name: row.name,
            address: row.address,
            customerId: row.customers.id,
            customer: row.customers.name,
            active: isActive(row) && isActive(row.customers),
            assetCount: equipment.reduce((total, type) => total + type.count, 0),
            equipment,
            liveAgreement: live ? { id: live.id, number: live.number ?? "", status: live.status as AgreementStatus } : null,
          };
        })
        .filter((row) => filter.showInactive || row.active)
        .filter((row) => !text || [row.name, row.address ?? "", row.customer].some((field) => field.toLowerCase().includes(text)))
        .sort((a, b) => byName(a.customer, b.customer) || byName(a.name, b.name));
    },
  };
}

/** Customers, sites and units that match a typed text, through `public.search_records` (global-search door 1). */
export function supabaseRecordSearch(client: Client): RecordSearch {
  return {
    async search(query: string) {
      const { data, error } = await client.rpc("search_records", { p_query: query, p_limit: SEARCH_GROUP_LIMIT + 1 });
      if (error) throw unexpected(error);
      const results: SearchResults = {
        customers: { hits: [], more: false },
        sites: { hits: [], more: false },
        equipment: { hits: [], more: false },
      };
      for (const row of data ?? []) {
        const group = row.kind === "customer" ? results.customers : row.kind === "site" ? results.sites : row.kind === "asset" ? results.equipment : null;
        if (!group) continue;
        if (group.hits.length === SEARCH_GROUP_LIMIT) {
          group.more = true;
          continue;
        }
        if (row.kind === "customer") results.customers.hits.push({ id: row.id, name: row.title });
        else if (row.kind === "site") results.sites.hits.push({ id: row.id, name: row.title, customerName: row.customer_name, address: row.address });
        else results.equipment.hits.push({ id: row.id, siteId: row.site_id, unitNo: row.title, typeName: row.type_name, siteName: row.site_name, customerName: row.customer_name });
      }
      return results;
    },
  };
}
