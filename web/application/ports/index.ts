import type { AgreementDocument, AgreementStatus, AgreementTerms, ScopeType, ServiceLineValue } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import type { OrgSettingsValue } from "@/domain/org-settings";
import type { ImportContentType, ImportFile, ReadError, ReadOutcome } from "@/domain/imports";
import type { AssetValue, ContactValue, CustomerValue, SiteValue } from "@/domain/records";
import type { PipelineStage } from "@/domain/pipeline";
import type { DomainEvent } from "@/domain/transition";

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
  customer: string;
  number: string | null;
  versionNo: number;
  /** Whole days since the last status change. */
  ageDays: number;
  attention?: string;
  visitsPerYear?: number;
  annualCents?: number;
};

export interface PipelineReader {
  board(): Promise<PipelineCard[]>;
}

export type CustomerSummary = {
  id: string;
  name: string;
  /** The contact created first; null when the customer has none. */
  primaryContact: string | null;
  siteCount: number;
  assetCount: number;
};

export type ContactView = { id: string; name: string; email: string | null; phone: string | null };

export type CustomerSiteView = { id: string; name: string; address: string | null; contactName: string | null; assetCount: number };

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
};

export type SiteView = {
  id: string;
  name: string;
  address: string | null;
  customerId: string;
  customerName: string;
  siteContactId: string | null;
  contactName: string | null;
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

export interface CustomerStore {
  create(orgId: string, value: CustomerValue): Promise<CreateResult>;
  update(id: string, value: CustomerValue): Promise<WriteResult>;
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
}

export interface AssetStore {
  /** Writes `source = 'manual'`. */
  create(orgId: string, siteId: string, value: AssetValue): Promise<CreateResult>;
  /** Leaves `source` as it is. */
  update(id: string, value: AssetValue): Promise<WriteResult>;
  delete(id: string): Promise<DeleteResult>;
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
};

/** An agreement as its page shows it: the version asked for, or the current one. */
export type AgreementDetail = {
  id: string;
  number: string;
  status: AgreementStatus;
  /** `null` when the agreement is off the board: withdrawn, or its contract voided. */
  stage: PipelineStage | null;
  site: { id: string; name: string };
  customer: { id: string; name: string };
  /** Every version, newest first. */
  versions: { versionNo: number; createdAt: Date }[];
  shown: { versionNo: number; current: boolean; lines: ServiceLineView[]; annualCents: number };
  /** The agreement is `draft` and the shown version is the current one. */
  editable: boolean;
  /**
   * What the shown version covers: live from the site while it is editable, else what the version recorded when the
   * agreement left draft (service-included door 4).
   */
  serviceScope: AgreementServiceScope;
  /** The terms the shown version was sent with; `null` while it is editable or when it recorded none (customer-portal door 3). */
  terms: AgreementTerms | null;
  /**
   * The live customer link of the shown version, when the agreement is `sent` and the version is the current one:
   * when the customer first opened it, or `null` for not yet. `null` too when there is no live link. The link itself
   * is never readable (customer-portal door 1).
   */
  portalLink: { firstViewedAt: Date | null } | null;
};

export type AgreementServiceScope = { source: "live" | "frozen"; takenAt: Date | null; types: ScopeType[] } | { source: "not_recorded" };

export interface AgreementReader {
  /** `null` for a malformed id, a missing row, or a row of another org. An unknown `versionNo` shows the current version. */
  get(id: string, versionNo?: number): Promise<AgreementDetail | null>;
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

/** Turns the content of one agreement into a PDF (agreement-pdf door 2). Rejects when it cannot render. */
export interface DocumentRenderer {
  renderAgreement(document: AgreementDocument): Promise<Uint8Array>;
}

/** Why a send or a new link wrote nothing. Anything else is unexpected and thrown by the adapter. */
export type PortalWriteFailure = "conflict" | "forbidden" | "not_found";

export type SendAgreementResult = { ok: true } | { ok: false; code: PortalWriteFailure | "no_lines" };
export type ReissueLinkResult = { ok: true } | { ok: false; code: PortalWriteFailure };

/** Moves a draft to sent, freezes it and creates its customer link in one transaction (customer-portal door 2). */
export interface AgreementSender {
  send(agreementId: string, tokenHash: string, event: DomainEvent<AgreementStatus>): Promise<SendAgreementResult>;
}

/** Replaces the live link of a sent agreement's current version (customer-portal door 2). */
export interface PortalLinkStore {
  reissue(agreementId: string, tokenHash: string): Promise<ReissueLinkResult>;
}

/** A new link's secret and the SHA-256 hex the database keeps instead of it (customer-portal door 1). */
export interface PortalTokens {
  create(): { token: string; hash: string };
  hash(token: string): string;
}

/** Everything the review page and PDF read about one link, as `public.portal_view` returns it (door 2). `null` for an unknown link. */
export type PortalView = {
  link: { versionNo: number; current: boolean; revoked: boolean; revokedAt: Date | null; firstViewedAt: Date | null };
  agreement: { number: string; status: AgreementStatus };
  tenant: { name: string; address: string | null; phone: string | null; accent: string | null } | null;
  customer: { name: string };
  site: { name: string };
  lines: { description: string; visitsPerYear: number; costPerVisitCents: number; annualCents: number }[];
  annualCents: number;
  scope: unknown;
  terms: AgreementTerms | null;
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
