import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { LIVE_STATUSES, type AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import { cents, lineAnnualCents, sumCents } from "@/domain/money";
import { addDays, EXPIRING_WINDOW_DAYS, pipelineStage, type ExpiringAgreement } from "@/domain/pipeline";
import type {
  AssetTypeCatalog,
  AssetView,
  Clock,
  CustomerAgreementView,
  CustomerDetail,
  CustomerDirectory,
  CustomerSummary,
  PipelineCard,
  PipelineReader,
  SiteRegister,
} from "@/application/ports";
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
        .select("id, name, contacts(id, name, email, phone, created_at), sites(assets(count))")
        .order("name")
        .limit(ROW_CAP);
      if (error) throw unexpected(error);

      const rows = data as unknown as { id: string; name: string; contacts: ContactRow[]; sites: { assets: { count: number }[] }[] }[];
      return rows
        .map<CustomerSummary>((row) => ({
          id: row.id,
          name: row.name,
          primaryContact: primaryContact(row.contacts),
          siteCount: row.sites.length,
          assetCount: row.sites.reduce((total, site) => total + (site.assets[0]?.count ?? 0), 0),
        }))
        .sort((a, b) => byName(a.name, b.name));
    },

    async detail(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("customers")
        .select(
          `id, name, contacts(id, name, email, phone, created_at),
           sites(id, name, address, site_contact_id, created_at, assets(count), agreements(${AGREEMENT_COLUMNS}))`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw unexpected(error);
      if (!data) return null;

      const row = data as unknown as {
        id: string;
        name: string;
        contacts: ContactRow[];
        sites: {
          id: string;
          name: string;
          address: string | null;
          site_contact_id: string | null;
          created_at: string;
          assets: { count: number }[];
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
        contacts: contacts.map(({ id: contactId, name, email, phone }) => ({ id: contactId, name, email, phone })),
        sites: sites.map((site) => ({
          id: site.id,
          name: site.name,
          address: site.address,
          contactName: contacts.find((contact) => contact.id === site.site_contact_id)?.name ?? null,
          assetCount: site.assets[0]?.count ?? 0,
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

export function supabaseSiteRegister(client: Client): SiteRegister {
  return {
    async get(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("sites")
        .select(
          `id, name, address, customer_id, site_contact_id,
           customers(name, contacts(id, name)),
           assets(id, unit_no, type_model, location, source, asset_types(code, name)),
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
        customers: { name: string; contacts: { id: string; name: string }[] };
        assets: {
          id: string;
          unit_no: string | null;
          type_model: string | null;
          location: string | null;
          source: string;
          asset_types: { code: string; name: string };
        }[];
        agreements?: { id: string; number: string | null; status: string }[];
      };
      const live = (row.agreements ?? []).find((agreement) => LIVE_STATUSES.includes(agreement.status as AgreementStatus));

      return {
        id: row.id,
        name: row.name,
        address: row.address,
        customerId: row.customer_id,
        customerName: row.customers.name,
        siteContactId: row.site_contact_id,
        contactName: row.customers.contacts.find((contact) => contact.id === row.site_contact_id)?.name ?? null,
        assets: row.assets.map<AssetView>((asset) => ({
          id: asset.id,
          typeCode: asset.asset_types.code,
          typeName: asset.asset_types.name,
          unitNo: asset.unit_no,
          typeModel: asset.type_model,
          location: asset.location,
          source: asset.source === "import" ? "import" : "manual",
        })),
        liveAgreement: live ? { id: live.id, number: live.number ?? "", status: live.status as AgreementStatus } : null,
      };
    },

    async asset(id) {
      if (!UUID.test(id)) return null;
      const { data, error } = await client
        .from("assets")
        .select("id, site_id, asset_type_id, unit_no, type_model, location")
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
      };
    },
  };
}

export function supabaseAssetTypeCatalog(client: Client): AssetTypeCatalog {
  return {
    async list() {
      const { data, error } = await client.from("asset_types").select("id, code, name").order("name").limit(ROW_CAP);
      if (error) throw unexpected(error);
      return data.map(({ id, code, name }) => ({ id, code, name }));
    },
  };
}
