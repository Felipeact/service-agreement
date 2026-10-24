import type { AgreementStatus } from "@/domain/agreement";
import type { ContractStatus } from "@/domain/contract";
import type { OrgSettingsValue } from "@/domain/org-settings";
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

export interface CustomerDirectory {
  list(): Promise<CustomerSummary[]>;
  /** `null` for a malformed id, a missing row, or a row of another org. */
  detail(id: string): Promise<CustomerDetail | null>;
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
  contactName: string | null;
  assets: AssetView[];
};

export interface SiteRegister {
  /** `null` for a malformed id, a missing row, or a row of another org. */
  get(id: string): Promise<SiteView | null>;
}

export type OrgSettings = OrgSettingsValue;

export type SaveSettingsResult = { ok: true } | { ok: false; code: "forbidden" | "unavailable" };

export interface OrgSettingsStore {
  get(orgId: string): Promise<OrgSettings | null>;
  /** Overwrites the org's row. Nothing updated means RLS refused: `forbidden`. */
  save(orgId: string, value: OrgSettingsValue, at: Date): Promise<SaveSettingsResult>;
}
