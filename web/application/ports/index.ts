import type {
  AgreementDocument,
  AgreementFilter,
  AgreementStatus,
  AgreementTerm,
  AgreementTerms,
  EquipmentChoice,
  ScopeType,
  ServiceLineValue,
  TimelineEntry,
} from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import type { OrgSettingsValue } from "@/domain/org-settings";
import type { ImportContentType, ImportFile, ImportFilter, ReadError, ReadOutcome } from "@/domain/imports";
import type { AssetValue, ContactValue, CustomerValue, SiteFilter, SiteValue } from "@/domain/records";
import type { PipelineStage } from "@/domain/pipeline";
import type { LibraryType, TaskLibraryValue } from "@/domain/task-library";
import type { DomainEvent } from "@/domain/transition";
import type { NotEmailedReason, RenewalReason, StaleAgreement, Tenant } from "@/domain/notifications";
import type { ExpiringAgreement } from "@/domain/pipeline";

/** Why a commit wrote nothing. Anything else is unexpected and thrown by the adapter. */
export type CommitFailure = "not_found" | "conflict" | "forbidden";

/** The status, the event and its outbox row were all written, or none of them was. */
export type CommitResult = { ok: true; eventId: string } | { ok: false; code: CommitFailure };

export type AgreementRecord = {
  status: AgreementStatus;
  /** Highest `agreement_versions.version_no`, or 0 when there is none. */
  versionNo: number;
};

export interface AgreementRepository {
  findById(id: string): Promise<AgreementRecord | null>;
  /** Writes only while the stored status still equals `expected`, otherwise `conflict`. */
  commitTransition(id: string, expected: AgreementStatus, event: DomainEvent<AgreementStatus>): Promise<CommitResult>;
}

export type ContractRecord = { status: ContractStatus };

export interface ContractRepository {
  findById(id: string): Promise<ContractRecord | null>;
  commitTransition(id: string, expected: ContractStatus, event: DomainEvent<ContractStatus>): Promise<CommitResult>;
}

export interface Clock {
  now(): Date;
}

/** An unknown email is `ok: true` too, so a caller cannot tell whether an account exists (door 2). */
export type MagicLinkResult = { ok: true } | { ok: false; code: "rate_limited" | "unavailable" };

export type EmailLinkResult = { ok: true } | { ok: false; code: "invalid_link" };

export interface AuthGateway {
  requestMagicLink(email: string): Promise<MagicLinkResult>;
  /** Exchanges the `token_hash` from the sign-in email for a session. */
  verifyEmailLink(tokenHash: string): Promise<EmailLinkResult>;
  /** Ends this browser's session only. */
  signOut(): Promise<void>;
}

export type MemberRole = "owner" | "admin" | "estimator" | "viewer";

/** Who is signed in, and the org they act for (door 2). */
export type CurrentMember =
  | { status: "signed_out" }
  | { status: "no_membership"; email: string }
  | { status: "member"; userId: string; email: string; orgId: string; orgName: string; role: MemberRole };

export interface MemberDirectory {
  currentMember(): Promise<CurrentMember>;
}

/** One card on the pipeline board (door 1). `attention` is the label of the pill the card needs, if any. */
export type PipelineCard = {
  id: string;
  stage: PipelineStage;
  /** The agreement's own status, which tells an expiry from a refusal in the Refused column (proposal-expiry AC 34). */
  status: AgreementStatus;
  /** The agreement's site, the card's heading. */
  site: string;
  customer: string;
  number: string | null;
  versionNo: number;
  /** Whole days since the last status change. */
  ageDays: number;
  attention?: string;
  visitsPerYear?: number;
  annualCents?: number;
  /** The agreement renews another one (renewal AC 34). */
  isRenewal: boolean;
};

export interface PipelineReader {
  board(): Promise<PipelineCard[]>;
  /** Accepted agreements whose term ends from `today` (`YYYY-MM-DD`) to 90 days on, earliest end first (renewal S6). */
  expiring(today: string): Promise<ExpiringAgreement[]>;
}

/** One row of the Agreements page: an agreement in any status (agreements-page door 2). */
export type AgreementListRow = {
  id: string;
  number: string | null;
  status: AgreementStatus;
  site: string;
  customer: string;
  versionNo: number;
  /** From the latest version's lines; null when it has none. */
  annualCents: number | null;
  updatedAt: string;
  /** The latest version's term end (`YYYY-MM-DD`), or null. */
  termEnd: string | null;
};

export interface AgreementLister {
  /** Newest change first; `today` (`YYYY-MM-DD`) anchors the `expiring` window. */
  list(filter: AgreementFilter, today: string): Promise<AgreementListRow[]>;
}

/** An active site the New agreement form offers, with the agreement already live on it (agreements-page door 2). */
export type SiteOption = {
  id: string;
  name: string;
  customer: string;
  liveAgreement: { id: string; number: string } | null;
};

export interface SiteLister {
  listActive(): Promise<SiteOption[]>;
}

/** One row of the Sites & equipment page: a site across customers (sites-page door 1). */
export type SiteListRow = {
  id: string;
  name: string;
  address: string | null;
  customerId: string;
  customer: string;
  /** False when the site or its customer is deactivated. */
  active: boolean;
  /** Active assets only. */
  assetCount: number;
  /** Active assets by equipment type code, most units first, then by code. */
  equipment: { code: string; count: number }[];
  liveAgreement: { id: string; number: string; status: AgreementStatus } | null;
};

export interface SiteDirectory {
  /** By customer name, then site name; inactive sites and sites of inactive customers only for `showInactive`. */
  list(filter: SiteFilter): Promise<SiteListRow[]>;
}

export type CustomerSummary = {
  id: string;
  name: string;
  /** The contact created first; null when the customer has none. */
  primaryContact: string | null;
  /** False once deactivated (deactivation door 1). */
  active: boolean;
  /** Active sites only. */
  siteCount: number;
  /** Active assets on active sites only. */
  assetCount: number;
};

/** What a contact is for: billing (the customer's), or approver / site contact of the named site (contact-roles door 1). */
export type ContactRole = { kind: "billing" } | { kind: "approver" | "site"; site: string };

/** `roles` is always set by the customer reader; absent only in hand-built fixtures. */
export type ContactView = { id: string; name: string; email: string | null; phone: string | null; roles?: ContactRole[] };

export type CustomerSiteView = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  /** Active assets only. */
  assetCount: number;
  active: boolean;
};

export type CustomerAgreementView = {
  id: string;
  siteName: string;
  number: string | null;
  versionNo: number;
  stage: PipelineStage;
  annualCents?: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  active: boolean;
  /** The customer's billing contact; null when none. */
  billingContactId?: string | null;
  contacts: ContactView[];
  sites: CustomerSiteView[];
  agreements: CustomerAgreementView[];
};

/** One contact as its edit form needs it. */
export type ContactRecord = { id: string; customerId: string; name: string; email: string | null; phone: string | null };

export interface CustomerDirectory {
  list(): Promise<CustomerSummary[]>;
  /** `null` for a malformed id, a missing row, or a row of another org. */
  detail(id: string): Promise<CustomerDetail | null>;
  /** `null` for a malformed id, a missing row, or a row of another org. */
  contact(id: string): Promise<ContactRecord | null>;
}

export type AssetView = {
  id: string;
  typeCode: string;
  typeName: string;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  source: "manual" | "import";
  active: boolean;
  /** The unit that replaced this removed one: its unit no, else its type code; null when none (deactivation door 4). */
  replacedBy: string | null;
};

export type SiteView = {
  id: string;
  name: string;
  address: string | null;
  customerId: string;
  customerName: string;
  active: boolean;
  customerActive: boolean;
  siteContactId: string | null;
  contactName: string | null;
  /** The contact customer emails go to, before the site contact; null when none (contact-roles door 2). */
  approverContactId?: string | null;
  approverName?: string | null;
  assets: AssetView[];
  /** The site's agreement in `draft`, `sent` or `changes_requested`, if any (agreement-builder door 2). */
  liveAgreement: { id: string; number: string; status: AgreementStatus } | null;
};

/** One asset as its edit form needs it. */
export type AssetRecord = {
  id: string;
  siteId: string;
  assetTypeId: string;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  active: boolean;
};

export interface SiteRegister {
  /** `null` for a malformed id, a missing row, or a row of another org. */
  get(id: string): Promise<SiteView | null>;
  /** `null` for a malformed id, a missing row, or a row of another org. */
  asset(id: string): Promise<AssetRecord | null>;
}

export type AssetTypeOption = { id: string; code: string; name: string };

export interface AssetTypeCatalog {
  /** The org's asset types, ordered by name. */
  list(): Promise<AssetTypeOption[]>;
}

export type OrgSettings = OrgSettingsValue;

export type SaveSettingsResult = { ok: true } | { ok: false; code: "forbidden" | "unavailable" };

export interface OrgSettingsStore {
  get(orgId: string): Promise<OrgSettings | null>;
  /** Overwrites the org's row. Nothing updated means RLS refused: `forbidden`. */
  save(orgId: string, value: OrgSettingsValue, at: Date): Promise<SaveSettingsResult>;
}

/**
 * Why a record write wrote nothing (door 2). `not_found`: the row or its parent is gone or in another org;
 * `in_use`: a delete another row still references; `unavailable`: anything unexpected, already logged.
 */
export type WriteFailure = "forbidden" | "not_found" | "unavailable";

export type CreateResult = { ok: true; id: string } | { ok: false; code: WriteFailure };
export type WriteResult = { ok: true } | { ok: false; code: WriteFailure };
export type DeleteResult = { ok: true } | { ok: false; code: WriteFailure | "in_use" };

/**
 * Why a deactivation or reactivation changed nothing (deactivation door 5). `in_term` and `changes_requested` name the
 * site and agreement that block it; `parent_inactive` names the customer or site to reactivate first.
 */
export type ActiveRefusal =
  | { code: WriteFailure }
  | { code: "in_term"; site: string; number: string; termEnd: string | null }
  | { code: "changes_requested"; site: string; number: string }
  | { code: "parent_inactive"; parent: string }
  | { code: "invalid_replacement" };

export type SetActiveResult = { ok: true } | ({ ok: false } & ActiveRefusal);

export interface CustomerStore {
  create(orgId: string, value: CustomerValue): Promise<CreateResult>;
  update(id: string, value: CustomerValue): Promise<WriteResult>;
  /** Deactivating also deactivates the customer's active sites; reactivating brings back the customer only. */
  setActive(id: string, active: boolean): Promise<SetActiveResult>;
}

export interface ContactStore {
  create(orgId: string, customerId: string, value: ContactValue): Promise<CreateResult>;
  update(id: string, value: ContactValue): Promise<WriteResult>;
  delete(id: string): Promise<DeleteResult>;
}

export interface SiteStore {
  create(orgId: string, customerId: string, value: SiteValue): Promise<CreateResult>;
  /** The site's customer never changes. */
  update(id: string, value: SiteValue): Promise<WriteResult>;
  /** Deactivating withdraws the site's draft or sent agreement in the same transaction. */
  setActive(id: string, active: boolean): Promise<SetActiveResult>;
}

export interface AssetStore {
  /** Writes `source = 'manual'`. */
  create(orgId: string, siteId: string, value: AssetValue): Promise<CreateResult>;
  /** Leaves `source` as it is. */
  update(id: string, value: AssetValue): Promise<WriteResult>;
  /** Assets are never deleted (deactivation door 2); a removed one may name the active unit on its site that replaced it. */
  setActive(id: string, active: boolean, replacedBy?: string | null): Promise<SetActiveResult>;
}

/**
 * `uploaded`: stored, not read yet; `parsed` / `unreadable`: read, with the outcome recorded (import-parse door 1);
 * `extracting` / `extracted`: rows are being, or have been, taken from a read file (import-extract door 2);
 * `committed`: the included rows were added to the site as assets (import-review door 2).
 */
export type ImportJobStatus = "uploading" | "uploaded" | "parsed" | "unreadable" | "extracting" | "extracted" | "committed";

/** What a commit added: assets created and rows skipped. */
export type CommitView = { added: number; skipped: number };

/** Where extraction stands on a job: chunks recorded of the total, or the rows it produced. */
export type ExtractionView = { status: "extracting"; cursor: number; total: number } | { status: "extracted"; rows: number; unmatched: number };

export type ImportJobView = {
  id: string;
  originalName: string;
  sizeBytes: number;
  status: ImportJobStatus;
  /** `null` when no email was recorded: shown as "Former member". */
  uploadedBy: string | null;
  createdAt: Date;
  /** The recorded read, or `null` until the job is read. */
  outcome: ReadOutcome | null;
  /** `null` until extraction starts. */
  extraction: ExtractionView | null;
  /** Set only on a `committed` job. */
  committed?: CommitView | null;
};

export interface ImportJobReader {
  /** The site's jobs, newest first, at most 500. */
  forSite(siteId: string): Promise<ImportJobView[]>;
}

/** One job in the Imports history: the job with the site it belongs to and that site's customer. */
export type ImportHistoryRow = ImportJobView & { site: { id: string; name: string }; customer: { id: string; name: string } };

export interface ImportHistory {
  /** The org's jobs, newest first, at most 500; `attention` is `uploading` and `unreadable` (imports-page door 1). */
  list(filter: ImportFilter): Promise<ImportHistoryRow[]>;
}

export type StartImportResult = { ok: true; jobId: string; signedUrl: string; contentType: ImportContentType } | { ok: false; code: WriteFailure };
export type ConfirmImportResult = { ok: true } | { ok: false; code: WriteFailure | "upload_missing" };

/** Import jobs and their files in the `imports` bucket, keyed `<orgId>/<jobId>` (doors 3 and 4). */
export interface ImportJobStore {
  /** Inserts the job as `uploading`, then signs an upload URL for its key. */
  start(orgId: string, siteId: string, file: ImportFile): Promise<StartImportResult>;
  /** `uploading` -> `uploaded` once the stored object exists with the declared size; an already uploaded job is ok. */
  confirmUploaded(jobId: string): Promise<ConfirmImportResult>;
  /** Deletes the row, then the object; a failed object delete is logged and still ok. A `committed` job is `locked`. */
  discard(jobId: string): Promise<DiscardImportResult>;
  /** The job's status, type and stored outcome; the file's bytes are downloaded as the member only while it is `uploaded`. */
  fileOf(jobId: string): Promise<ImportFileResult>;
  /** `uploaded` -> the outcome, compare-and-set; a job read meanwhile returns the outcome already stored. */
  recordRead(jobId: string, outcome: ReadOutcome): Promise<RecordReadResult>;
  /** Status, progress and result of extraction; the file's bytes are downloaded as the member only while `parsed` or `extracting` (import-extract door 6). */
  sourceOf(jobId: string): Promise<SourceOfResult>;
  /** Records one chunk's rows and moves the cursor in one transaction; a stale cursor answers with the stored progress. */
  recordExtraction(jobId: string, expectedCursor: number | null, total: number, rows: ImportRowInput[]): Promise<RecordExtractionResult>;
  /** Adds every included row to the job's site as an asset, once (import-review door 3); a repeat answers with the stored result. */
  commit(jobId: string): Promise<CommitImportResult>;
}

export type DiscardImportResult = { ok: true } | { ok: false; code: WriteFailure | "locked" };

export type CommitImportResult = ({ ok: true } & CommitView) | { ok: false; code: WriteFailure | "not_ready" | "incomplete" };

/** One extracted row as the review grid shows it (import-review door 6). */
export type ImportRowView = {
  id: string;
  position: number;
  assetTypeRaw: string | null;
  assetTypeId: string | null;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  confidence: ExtractConfidence;
  sourceRef: string | null;
  skipped: boolean;
  /** The asset the row became, once committed; `null` again if that asset is deleted. */
  assetId: string | null;
};

export type ImportReview = {
  job: {
    id: string;
    siteId: string;
    siteName: string;
    originalName: string;
    status: ImportJobStatus;
    committed: (CommitView & { at: Date }) | null;
  };
  /** Every row of the job in `position` order, however many. */
  rows: ImportRowView[];
};

export interface ImportReviewReader {
  /** `null` for a malformed id, a missing job, another org's, or a job neither `extracted` nor `committed`. */
  forJob(jobId: string): Promise<ImportReview | null>;
}

export type RowWriteResult = { ok: true } | { ok: false; code: WriteFailure | "locked" };

/** Writes to the rows of a job under review; a job no longer `extracted` answers `locked` (import-review door 4). */
export interface ImportRowStore {
  /** Sets the row's type, unit #, type/model and location only. */
  update(rowId: string, value: AssetValue): Promise<RowWriteResult>;
  setSkipped(rowId: string, skipped: boolean): Promise<RowWriteResult>;
  /** Types every untyped row of the job whose `normalized` `asset_type_raw` is `rawNormalized`; typed rows are never changed. */
  mapType(jobId: string, rawNormalized: string, assetTypeId: string): Promise<{ ok: true; rows: number } | { ok: false; code: WriteFailure | "locked" }>;
}

export type ExtractionProgress = { cursor: number; total: number };

export type SourceOfResult =
  | {
      ok: true;
      status: ImportJobStatus;
      contentType: ImportContentType;
      progress: ExtractionProgress | null;
      result: { rows: number; unmatched: number } | null;
      bytes: Uint8Array | null;
    }
  | { ok: false; code: WriteFailure };

export type RecordExtractionResult = { ok: true; progress: ExtractionProgress; done: boolean } | { ok: false; code: WriteFailure };

export type ExtractConfidence = "low" | "medium" | "high";

/** One row as Claude read it (import-extract door 3). */
export type ExtractedRow = {
  assetTypeRaw: string | null;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  confidence: ExtractConfidence;
  sourceRef: string | null;
};

/** A stored row: what Claude read, plus the org's type it matched (`null` when none). */
export type ImportRowInput = ExtractedRow & { assetTypeId: string | null };

/** The unit of one Claude call: up to 100 data rows of one table, a text-only document, or a whole PDF. */
export type ExtractChunk =
  | { kind: "rows"; table: string; header: string[]; rows: { ref: string; cells: string[] }[] }
  | { kind: "text"; text: string }
  | { kind: "pdf"; bytes: Uint8Array };

export type ExtractResult = { ok: true; rows: ExtractedRow[] } | { ok: false; code: "unavailable" | "too_large" };

/** Turns a chunk of a read file into candidate rows. Knows nothing about orgs, sites or customers. */
export interface AssetExtractor {
  extract(chunk: ExtractChunk): Promise<ExtractResult>;
}

export type ImportFileResult =
  | { ok: true; status: ImportJobStatus; contentType: ImportContentType; outcome: ReadOutcome | null; bytes: Uint8Array | null }
  | { ok: false; code: WriteFailure };

export type RecordReadResult = { ok: true; outcome: ReadOutcome } | { ok: false; code: WriteFailure | "not_ready" };

/** One table found in a file: a sheet, a CSV, or a Word table. `ref` is what extraction copies into `source_ref`. */
export type ParsedTable = {
  /** The sheet name, `CSV`, or `Table <n>`. */
  source: string;
  header: string[];
  /** Data rows only; `ref` is `<sheet>!<row number>` or `Table <n>, row <m>`. */
  rows: { ref: string; cells: string[] }[];
};

/** A file's content in one of two shapes, whatever its format (import-parse door 3). */
export type ParsedImport = { format: "table"; tables: ParsedTable[]; text: string } | { format: "pdf"; bytes: Uint8Array };

export type ParseResult = { ok: true; parsed: ParsedImport } | { ok: false; reason: ReadError };

/** Opens a file by its content type; a file it cannot read is a `reason`, never a throw. */
export interface ImportParser {
  parse(contentType: ImportContentType, bytes: Uint8Array): Promise<ParseResult>;
}

/** One priced line of a version, with its annual amount (agreement-builder door 7). */
export type ServiceLineView = {
  id: string;
  position: number;
  description: string;
  visitsPerYear: number;
  costPerVisitCents: number;
  annualCents: number;
  /** Ascending, 1 = January; their number is `visitsPerYear` (cadence door 1). */
  visitMonths: number[];
  /** The equipment types the line covers, by name (cadence door 2). */
  equipment: { id: string; code: string; name: string }[];
};

/** What the history of a version records: who acted is a role, or the customer (versioning AC 6). */
export type VersionEventType = "sent" | "viewed" | "accepted" | "refused" | "changes_requested";
export type VersionEvent = { type: VersionEventType; at: Date; by: MemberRole | "customer" | null };

/** A version with the reason it exists (the customer's change request or a staff note), its author's role, and its events. */
export type VersionView = { versionNo: number; createdAt: Date; reason: string | null; author: MemberRole | null; events: VersionEvent[] };

/** An agreement as its page shows it: the version asked for, or the current one. */
export type AgreementDetail = {
  id: string;
  number: string;
  status: AgreementStatus;
  /** `null` when the agreement is off the board: withdrawn, or its contract voided. */
  stage: PipelineStage | null;
  site: { id: string; name: string };
  customer: { id: string; name: string };
  /** Every version, newest first, with why it exists, who made it and what happened to it (versioning door 1). */
  versions: VersionView[];
  /** The version named by the latest `agreement.sent` event, and by the latest `agreement.accepted` one (versioning door 3). */
  sentVersion: number | null;
  acceptedVersion: number | null;
  /**
   * Everything that happened to the agreement across its versions, newest first (activity-timeline). Optional in the
   * type so older fixtures compile; the reader always sets it.
   */
  timeline?: TimelineEntry[];
  /** The version `?compare=` names, with its lines, or `null` when it names none other than the shown one. */
  compare: { versionNo: number; lines: ServiceLineView[]; annualCents: number } | null;
  shown: { versionNo: number; current: boolean; lines: ServiceLineView[]; annualCents: number };
  /** The agreement is `draft` and the shown version is the current one. */
  editable: boolean;
  /**
   * What a line of the editable version can cover: the site's types with an asset, plus any type a line already
   * covers, by name (cadence AC 8). Empty when the shown version is not editable.
   */
  equipmentChoices: EquipmentChoice[];
  /**
   * What the shown version covers: live from the site while it is editable, else what the version recorded when the
   * agreement left draft (service-included door 4).
   */
  serviceScope: AgreementServiceScope;
  /** The terms the shown version was sent with; `null` while it is editable or when it recorded none (customer-portal door 3). */
  terms: AgreementTerms | null;
  /** The shown version's start, months and end (term-dates door 1). */
  term: AgreementTerm;
  /** The last day the shown version can be decided, `YYYY-MM-DD`, or `null` when it was never sent (proposal-expiry door 1). */
  validUntil: string | null;
  /**
   * The live customer link of the shown version, when the agreement is `sent` and the version is the current one:
   * when the customer first opened it, or `null` for not yet. `null` too when there is no live link. The link itself
   * is never readable (customer-portal door 1).
   */
  portalLink: { firstViewedAt: Date | null } | null;
  /**
   * Whether the link email of the shown version went out, when the agreement is `sent` and the version is the current
   * one: the `customer_link` notification of its `agreement.sent` event, or `{ status: "pending" }` while there is none
   * (outbox-dispatch AC 30). `null` otherwise.
   */
  linkEmail: LinkEmailView | null;
  /** The agreement this one renews, and the one that renews it (renewal door 1), or `null`. */
  renews: { id: string; number: string } | null;
  renewedBy: { id: string; number: string } | null;
};

export type LinkEmailView =
  | { status: "sent"; to: string; sentAt: Date }
  | { status: "not_sent"; reason: NotEmailedReason }
  | { status: "pending" };

export type AgreementServiceScope = { source: "live" | "frozen"; takenAt: Date | null; types: ScopeType[] } | { source: "not_recorded" };

export interface AgreementReader {
  /**
   * `null` for a malformed id, a missing row, or a row of another org. An unknown `versionNo` shows the current version.
   * `compareNo` names a second version to read the lines of; it is ignored when it is the shown one or no version.
   */
  get(id: string, versionNo?: number, compareNo?: number): Promise<AgreementDetail | null>;
}

export type CreateAgreementResult =
  | { ok: true; id: string }
  | { ok: false; code: WriteFailure }
  | { ok: false; code: "open_exists"; agreementId: string; number: string };

export interface AgreementStore {
  /** Numbers the agreement and creates version 1 in one transaction (`create_agreement`, door 3). */
  create(siteId: string): Promise<CreateAgreementResult>;
}

export type AddServiceLineResult = { ok: true; id: string } | { ok: false; code: WriteFailure | "locked" | "too_many" };
export type ServiceLineWriteResult = { ok: true } | { ok: false; code: WriteFailure | "locked" };

/** Lines of the current version of a draft; anything else answers `locked` (door 4). */
export interface ServiceLineStore {
  /** Adds after the last line of the agreement's current version. */
  add(agreementId: string, value: ServiceLineValue): Promise<AddServiceLineResult>;
  update(lineId: string, value: ServiceLineValue): Promise<ServiceLineWriteResult>;
  remove(lineId: string): Promise<ServiceLineWriteResult>;
}

export type AgreementTermWriteResult = { ok: true } | { ok: false; code: WriteFailure | "locked" | "invalid" };

/** The term of the current version of a draft, through `save_agreement_term` (term-dates door 3); anything else is `locked`. */
export interface AgreementTermStore {
  save(agreementId: string, term: { start: string; months: number }): Promise<AgreementTermWriteResult>;
}

export type VersionNoteWriteResult = { ok: true } | { ok: false; code: WriteFailure | "locked" | "invalid" };

/** The staff note of the current version of a draft, through `save_version_note` (versioning door 1); anything else is `locked`. */
export interface VersionNoteStore {
  save(agreementId: string, note: string): Promise<VersionNoteWriteResult>;
}

/** Turns the content of one agreement into a PDF (agreement-pdf door 2). Rejects when it cannot render. */
export interface DocumentRenderer {
  renderAgreement(document: AgreementDocument): Promise<Uint8Array>;
}

/** Why a send or a new link wrote nothing. Anything else is unexpected and thrown by the adapter. */
export type PortalWriteFailure = "conflict" | "forbidden" | "not_found";

export type SendAgreementResult = { ok: true } | { ok: false; code: PortalWriteFailure | "no_lines" | "no_term_start" };
export type ReissueLinkResult = { ok: true } | { ok: false; code: PortalWriteFailure };

/** Moves a draft to sent, freezes it and creates its customer link in one transaction (customer-portal door 2). */
export interface AgreementSender {
  /** `tokenSealed` is the same token sealed with `PORTAL_LINK_KEY` (outbox-dispatch door 5); without it the link stores none. */
  send(agreementId: string, tokenHash: string, event: DomainEvent<AgreementStatus>, tokenSealed?: string): Promise<SendAgreementResult>;
}

/** Replaces the live link of a sent agreement's current version (customer-portal door 2). */
export interface PortalLinkStore {
  reissue(agreementId: string, tokenHash: string, tokenSealed?: string): Promise<ReissueLinkResult>;
}

/** A new link's secret and the SHA-256 hex the database keeps instead of it (customer-portal door 1). */
export interface PortalTokens {
  create(): { token: string; hash: string };
  hash(token: string): string;
  /** The token encrypted with the app-only `PORTAL_LINK_KEY`, `v1.<iv>.<ciphertext+tag>` (outbox-dispatch door 5). Throws without the key. */
  seal(token: string): string;
  /** The token back from `seal`; throws for another key or a changed value. */
  unseal(sealed: string): string;
}

/** Everything the review page and PDF read about one link, as `public.portal_view` returns it (door 2). `null` for an unknown link. */
export type PortalView = {
  link: { versionNo: number; current: boolean; revoked: boolean; revokedAt: Date | null; firstViewedAt: Date | null };
  agreement: { number: string; status: AgreementStatus };
  tenant: { name: string; address: string | null; phone: string | null; accent: string | null } | null;
  customer: { name: string };
  site: { name: string };
  lines: {
    description: string;
    visitsPerYear: number;
    costPerVisitCents: number;
    annualCents: number;
    visitMonths: number[];
    equipment: { code: string; name: string }[];
  }[];
  annualCents: number;
  scope: unknown;
  terms: AgreementTerms | null;
  /** The version's term (term-dates door 7). */
  term: AgreementTerm;
  /** The last day the version can be decided, `YYYY-MM-DD`, or `null` for no bound (proposal-expiry door 7). */
  validUntil: string | null;
  /** Today in America/Vancouver as the database read it, `YYYY-MM-DD`; `null` when the document carries none. */
  today: string | null;
  decision: { status: "accepted" | "refused" | "changes_requested"; decidedAt: Date; reason: string | null } | null;
};

/** Reads one link by the hash of its token and writes nothing. */
export interface PortalReader {
  view(tokenHash: string): Promise<PortalView | null>;
}

/** What `portal_decide` answered: done, or the link is no longer open for a decision (`40001`, `P0002`). */
export type PortalDecideResult = { ok: true } | { ok: false; code: "not_open" };

/** Records the customer's decision on a link (customer-portal door 2, 9). Rejects on anything unexpected. */
export interface PortalDecider {
  decide(tokenHash: string, event: DomainEvent<AgreementStatus>): Promise<PortalDecideResult>;
}

/** Stamps the link's first view and writes `agreement.viewed`; a later call writes nothing (door 2, 9). */
export interface PortalViewRecorder {
  record(tokenHash: string): Promise<void>;
}

/** A callback from n8n as it arrived: the raw body and its two signature headers (outbox-dispatch door 2). */
export type SignedCallback = { body: string; timestamp: string; signature: string };

type MessageBase = { notificationId: string; to: string[]; tenant: Tenant };

/** One email `automation_claim` decided to send, with what it needs (outbox-dispatch Landing 11). */
export type NotificationMessage =
  | (MessageBase & {
      kind: "customer_link" | "customer_reminder";
      replyTo: string | null;
      agreement: { id: string; number: string };
      site: { name: string };
      annualCents: number;
      tokenSealed: string;
      reminder: "day3" | "day7" | null;
    })
  | (MessageBase & {
      kind: "staff_decision";
      agreement: { id: string; number: string };
      customer: { name: string };
      decision: "refused" | "changes_requested";
      reason: string | null;
    })
  | (MessageBase & { kind: "staff_stale"; orgId: string; agreements: StaleAgreement[] })
  /** W7's messages carry their own key, `w7:<renewalId>:customer` or `:staff` (renewal door 6). */
  | (MessageBase & {
      kind: "customer_renewal";
      idempotencyKey: string;
      agreement: { id: string; number: string };
      renews: { number: string };
      site: { name: string };
      oldAnnualCents: number;
      annualCents: number;
      appliedPct: number;
      term: { start: string; end: string; months: number };
    })
  | (MessageBase & {
      kind: "staff_renewal";
      idempotencyKey: string;
      agreement: { id: string; number: string };
      renews: { number: string; termEnd: string };
      site: { name: string };
      customer: { name: string };
      reason: RenewalReason;
      cpiPct: number | null;
    })
  /** W8's message carries its own key, `w8:<eventId>` (proposal-expiry door 6). */
  | (MessageBase & {
      kind: "staff_expired";
      idempotencyKey: string;
      agreement: { id: string; number: string };
      customer: { name: string };
      site: { name: string };
      validUntil: string;
    });

export type ClaimDecision =
  | { decision: "send"; messages: NotificationMessage[] }
  | { decision: "skip"; reason: string }
  | { decision: "duplicate" }
  | { decision: "in_flight" };

/** A refused callback: `42501` bad or stale signature, `22023` malformed body, `P0002` unknown event or agreement. */
export type CallbackFailure = "unauthorized" | "malformed" | "not_found";

export type ClaimResult = ({ ok: true } & ClaimDecision) | { ok: false; code: CallbackFailure };

export type NotificationOutcome =
  | { id: string; outcome: "sent"; providerMessageId: string }
  | { id: string; outcome: "failed"; error: string }
  | { id: string; outcome: "skipped"; reason: "reserved_domain" };

/** The signed callbacks the database verifies itself (`automation_claim`, `automation_complete`, door 3). */
export interface AutomationCallbacks {
  /** Throws on anything other than the three refusals. */
  claim(callback: SignedCallback): Promise<ClaimResult>;
  /** Records what happened to the claimed notifications; throws on any error. */
  complete(callback: SignedCallback, results: NotificationOutcome[]): Promise<void>;
}

/** One transactional email (outbox-dispatch door 7). `idempotencyKey` makes a resend after a crash a no-op. */
export type EmailMessage = {
  to: string[];
  fromName: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

/** `reserved_domain`: a recipient on a reserved domain, refused before any request (AC 22). */
export type EmailSendResult = { ok: true; providerMessageId: string } | { ok: false; code: "rejected" | "unavailable" | "reserved_domain" };

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface TaskLibraryReader {
  /** The org's equipment types by name, each with its default visit months and its tasks in position order, at most 500 (task-library-page door 1). */
  list(): Promise<LibraryType[]>;
}

export type SaveLibraryResult = { ok: true } | { ok: false; code: WriteFailure };

export interface TaskLibraryStore {
  /** Replaces the type's default months and its whole checklist in one transaction (task-library-page doors 2 and 3). */
  save(typeCode: string, value: TaskLibraryValue): Promise<SaveLibraryResult>;
}
