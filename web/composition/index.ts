import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { BillingGateway, CheckoutStarter, WorkspaceEmailCheck } from "@/application/ports";
import type { OrgSettingsValue } from "@/domain/org-settings";
import type { SetupProfileValue } from "@/domain/org-settings/setup";
import {
  makeDecidePortal,
  makeDuplicateAgreementTemplate,
  makeInviteMember,
  makeListAgreementTemplates,
  makeContractDocuments,
  makeExtractImport,
  makeNotify,
  makeReadImport,
  makeReceiveSignatureEvent,
  makeReceiveStripeEvent,
  makeRecordPortalView,
  makeReissueLink,
  makeRequestSignInLink,
  makeSendAgreement,
  makeSendForSignature,
  makeStartTrial,
  makeBilling,
  makeBillingEntry,
  makeTransitionAgreement,
  makeTransitionContract,
  makeViewPortal,
  makeViewSigning,
  type NotifyResult,
} from "@/application/use-cases";
import { systemClock } from "@/infrastructure/clock";
import { stripeCheckoutStarter } from "@/infrastructure/stripe/checkout";
import { stripeBillingGateway } from "@/infrastructure/stripe/billing-gateway";
import { supabaseImportAllowance } from "@/infrastructure/supabase/import-allowance";
import { supabaseOrgBilling } from "@/infrastructure/supabase/org-billing";
import { supabaseOrgUsage } from "@/infrastructure/supabase/org-usage";
import { supabaseOrgPlanRecorder } from "@/infrastructure/supabase/org-plan";
import { claudeAssetExtractor } from "@/infrastructure/claude";
import { claudeCatalogDrafter } from "@/infrastructure/claude/catalog-drafter";
import { supabaseCatalogWriter } from "@/infrastructure/supabase/catalog-writer";
import { makeAcceptCatalogDraft, makeDraftCatalog } from "@/application/use-cases/draft-catalog";
import { docusealSignatureProvider } from "@/infrastructure/docuseal";
import { docusealSignedDocuments } from "@/infrastructure/docuseal/signed-documents";
import { reactPdfContractRenderer, reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { importParser } from "@/infrastructure/import-parsers";
import { makePortalTokens } from "@/infrastructure/portal-tokens";
import { resendEmailSender } from "@/infrastructure/email";
import { supabaseAutomationCallbacks } from "@/infrastructure/supabase/automation";
import type { Database } from "@/infrastructure/supabase/database.types";
import { supabaseAgreementRepository, supabaseContractRepository } from "@/infrastructure/supabase";
import {
  supabaseAgreementReader,
  supabaseAgreementStore,
  supabaseAgreementTermStore,
  supabaseVersionNoteStore,
  supabaseServiceLineStore,
} from "@/infrastructure/supabase/agreements";
import { supabaseAuthGateway, supabaseMemberDirectory } from "@/infrastructure/supabase/auth";
import { supabaseContractReader, supabaseContractStore } from "@/infrastructure/supabase/contracts";
import { supabaseAgreementTemplateReader, supabaseAgreementTemplateStore } from "@/infrastructure/supabase/templates";
import { supabaseSignatureWebhooks } from "@/infrastructure/supabase/signature-webhook";
import { supabaseStripeEvents } from "@/infrastructure/supabase/stripe-events";
import { supabaseSignedCopyReader } from "@/infrastructure/supabase/signed-copy";
import { supabaseImportReviewReader, supabaseImportRowStore } from "@/infrastructure/supabase/import-review";
import { supabaseTaskLibraryReader, supabaseTaskLibraryStore } from "@/infrastructure/supabase/task-library";
import { supabaseInvitationAcceptor, supabaseInvitationLinkSender, supabaseMemberAdmin, supabaseMemberRoster } from "@/infrastructure/supabase/members";
import { supabaseImportHistory, supabaseImportJobReader, supabaseImportJobStore } from "@/infrastructure/supabase/imports";
import {
  supabaseAgreementSender,
  supabasePortalDecider,
  supabasePortalLinkStore,
  supabasePortalReader,
  supabasePortalViewRecorder,
} from "@/infrastructure/supabase/portal";
import {
  supabaseAgreementLister,
  supabaseAssetTypeCatalog,
  supabaseCustomerDirectory,
  supabasePipelineReader,
  supabaseRecordSearch,
  supabaseSiteDirectory,
  supabaseSiteLister,
  supabaseSiteRegister,
} from "@/infrastructure/supabase/readers";
import { supabaseAssetStore, supabaseContactStore, supabaseCustomerStore, supabaseSiteStore } from "@/infrastructure/supabase/records";
import { supabaseSignatureStore, supabaseSigningReader, supabaseSigningSecrets } from "@/infrastructure/supabase/signing";
import { itemWordsReader } from "@/application/use-cases/item-words";
import { supabaseOrgSettingsStore } from "@/infrastructure/supabase/settings";
import { makeTenantLogo } from "@/application/use-cases/tenant-logo";
import { supabaseOrgLogo } from "@/infrastructure/supabase/org-logo";
import { supabaseOrgSetup } from "@/infrastructure/supabase/setup";
import { supabaseMemberWorkspace, supabaseWorkspaceStatus } from "@/infrastructure/supabase/workspace-state";
import { supabaseWorkspaceEmailCheck } from "@/infrastructure/supabase/workspace-email";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * Wires the use cases for one request. Build it per request: the Supabase client carries the
 * signed-in user's cookies, so RLS sees that user.
 */
export async function getContainer() {
  // Literal process.env reads, so Next inlines the NEXT_PUBLIC_ values.
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  // Request time only: the Supabase client reads the clock (token expiry), which a prerender or a runtime
  // prefetch must not do (blocking-prerender-current-time).
  await connection();
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies; the proxy refreshes the session.
        }
      },
    },
  });

  const auth = supabaseAuthGateway(supabase);
  // Inviting must not touch the inviter's session: this client keeps no cookies and no token (members-page Flow hop 4).
  const invitationSender = supabaseInvitationLinkSender(createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  const memberAdmin = supabaseMemberAdmin(supabase);
  const memberRoster = supabaseMemberRoster(supabase);
  const members = supabaseMemberDirectory(supabase);
  const pipeline = supabasePipelineReader(supabase, systemClock);
  const customers = supabaseCustomerDirectory(supabase);
  const agreementLister = supabaseAgreementLister(supabase);
  const siteLister = supabaseSiteLister(supabase);
  const siteDirectory = supabaseSiteDirectory(supabase);
  const sites = supabaseSiteRegister(supabase);
  const settings = supabaseOrgSettingsStore(supabase);
  const setup = supabaseOrgSetup(supabase);
  // The org's logo: the stored path, a signed upload, and the bytes a document draws (tenant-logo). The bucket is public, so reading needs no session.
  const logo = supabaseOrgLogo(supabase, { baseUrl: url });
  const tenantLogo = makeTenantLogo(logo);
  // The billing page needs both values (billing-page AC 8); `STRIPE_SECRET_KEY` is read only in this file. Without them the page
  // says billing is not available and every action answers `not_configured` with no request. The publishable key is safe for the
  // browser: it is read here at request time and handed to the card field as a prop, so no rebuild is needed per environment.
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeBase = process.env.APP_BASE_URL;
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;
  const orgBilling = supabaseOrgBilling(supabase);
  const notConfigured = { ok: false, code: "not_configured" } as const;
  const billingGateway: BillingGateway =
    stripeKey && stripeBase
      ? stripeBillingGateway({ secretKey: stripeKey })
      : {
          overview: async () => notConfigured,
          startCardUpdate: async () => notConfigured,
          finishCardUpdate: async () => notConfigured,
          cancel: async () => notConfigured,
          resume: async () => notConfigured,
          changePlan: async () => notConfigured,
        };
  const billing = makeBilling(orgBilling, billingGateway, supabaseOrgPlanRecorder(supabase), supabaseOrgUsage(supabase));
  const customerStore = supabaseCustomerStore(supabase);
  const contactStore = supabaseContactStore(supabase);
  const siteStore = supabaseSiteStore(supabase);
  const assetStore = supabaseAssetStore(supabase);
  const importJobs = supabaseImportJobStore(supabase, systemClock);
  const importRows = supabaseImportRowStore(supabase);
  const agreementRepository = supabaseAgreementRepository(supabase);
  const portalReader = supabasePortalReader(supabase);
  // Sealing needs PORTAL_LINK_KEY: without it a send or a new link throws and answers unavailable (outbox-dispatch door 5).
  const portalTokens = makePortalTokens(process.env.PORTAL_LINK_KEY);
  // The signing links and the provider's embed links are sealed with their own key, so a leak of one key opens one family
  // of links (signature-provider door 4). Without it a send answers unavailable before anything is begun.
  const signingTokens = makePortalTokens(process.env.SIGNING_LINK_KEY);

  return {
    requestSignInLink: makeRequestSignInLink(auth),
    verifyEmailLink: auth.verifyEmailLink,
    signOut: auth.signOut,
    currentMember: members.currentMember,
    // What a signed-in person with no membership is told about their own paid checkout (workspace-pending-state door 3).
    workspaceState: supabaseMemberWorkspace(supabase).mine,
    transitionAgreement: makeTransitionAgreement(agreementRepository),
    transitionContract: makeTransitionContract(supabaseContractRepository(supabase)),
    pipelineBoard: pipeline.board,
    pipelineExpiring: pipeline.expiring,
    listAgreements: agreementLister.list,
    listActiveSites: siteLister.listActive,
    listSites: siteDirectory.list,
    searchRecords: supabaseRecordSearch(supabase).search,
    listCustomers: customers.list,
    customerDetail: customers.detail,
    siteRegister: sites.get,
    getOrgSettings: settings.get,
    logo,
    tenantLogo,
    getItemWords: itemWordsReader(settings.get),
    billingLink: makeBillingEntry(orgBilling),
    loadBilling: billing.load,
    loadBillingUsage: billing.usage,
    startCardUpdate: billing.startCardUpdate,
    finishCardUpdate: billing.finishCardUpdate,
    cancelSubscription: billing.cancel,
    resumeSubscription: billing.resume,
    changePlan: billing.changePlan,
    stripePublishableKey,
    setupPending: setup.isPending,
    setupCatalog: setup.catalog,
    // The "Other" trade's catalog draft (other-trade-draft): the Claude call and the one atomic write, both behind the setup screen.
    draftCatalog: makeDraftCatalog(async () => (await setup.catalog()).length, importParser, claudeCatalogDrafter({ apiKey: process.env.ANTHROPIC_API_KEY })),
    acceptCatalogDraft: makeAcceptCatalogDraft(supabaseCatalogWriter(supabase)),
    saveSetupProfile: (orgId: string, value: SetupProfileValue) => setup.saveProfile(orgId, value, systemClock.now()),
    skipSetup: (orgId: string) => setup.skip(orgId, systemClock.now()),
    saveOrgSettings: (orgId: string, value: OrgSettingsValue) => settings.save(orgId, value, systemClock.now()),
    contactForEdit: customers.contact,
    assetForEdit: sites.asset,
    listAssetTypes: supabaseAssetTypeCatalog(supabase).list,
    listTaskLibrary: supabaseTaskLibraryReader(supabase).list,
    saveTaskLibraryType: supabaseTaskLibraryStore(supabase).save,
    createLibraryType: supabaseTaskLibraryStore(supabase).createType,
    renameLibraryType: supabaseTaskLibraryStore(supabase).renameType,
    removeLibraryType: supabaseTaskLibraryStore(supabase).removeType,
    resetLibraryType: supabaseTaskLibraryStore(supabase).resetType,
    listMembers: memberRoster.members,
    listInvitations: memberRoster.invitations,
    inviteMember: makeInviteMember(memberAdmin, invitationSender),
    revokeInvitation: memberAdmin.revoke,
    setMemberRole: memberAdmin.setRole,
    removeMember: memberAdmin.remove,
    acceptInvitations: supabaseInvitationAcceptor(supabase).acceptInvitations,
    createCustomer: customerStore.create,
    updateCustomer: customerStore.update,
    createContact: contactStore.create,
    updateContact: contactStore.update,
    deleteContact: contactStore.delete,
    createSite: siteStore.create,
    updateSite: siteStore.update,
    createAsset: assetStore.create,
    updateAsset: assetStore.update,
    setCustomerActive: customerStore.setActive,
    setSiteActive: siteStore.setActive,
    setAssetActive: assetStore.setActive,
    listImportJobs: supabaseImportJobReader(supabase).forSite,
    listImportHistory: supabaseImportHistory(supabase).list,
    startImport: importJobs.start,
    confirmImportUpload: importJobs.confirmUploaded,
    discardImport: importJobs.discard,
    // The same member-scoped store: the file is downloaded under RLS, never with a service-role key.
    readImport: makeReadImport(importJobs, importParser),
    extractImport: makeExtractImport(importJobs, importParser, claudeAssetExtractor({ apiKey: process.env.ANTHROPIC_API_KEY }), supabaseAssetTypeCatalog(supabase), supabaseImportAllowance(supabase)),
    reviewImport: supabaseImportReviewReader(supabase).forJob,
    updateImportRow: importRows.update,
    skipImportRow: importRows.setSkipped,
    mapImportType: importRows.mapType,
    commitImport: importJobs.commit,
    // Agreements and their lines are read and written as the member, from the same client (AC 29).
    agreementReader: supabaseAgreementReader(supabase),
    agreementStore: supabaseAgreementStore(supabase),
    // Agreement templates are read and written as the member: the definer functions check owner or admin themselves.
    listAgreementTemplates: makeListAgreementTemplates(supabaseAgreementTemplateReader(supabase)),
    saveAgreementTemplate: supabaseAgreementTemplateStore(supabase).save,
    archiveAgreementTemplate: supabaseAgreementTemplateStore(supabase).archive,
    duplicateAgreementTemplate: makeDuplicateAgreementTemplate(supabaseAgreementTemplateReader(supabase), supabaseAgreementTemplateStore(supabase)),
    serviceLineStore: supabaseServiceLineStore(supabase),
    agreementTermStore: supabaseAgreementTermStore(supabase),
    versionNoteStore: supabaseVersionNoteStore(supabase),
    // Sending and re-linking run as the member too: the token is made here and only its hash reaches the database.
    sendAgreement: makeSendAgreement(agreementRepository, supabaseAgreementSender(supabase), portalTokens),
    reissueLink: makeReissueLink(supabasePortalLinkStore(supabase), portalTokens),
    // The customer side reads and writes through the same cookie client: `anon` for a customer, `authenticated` for a
    // member who opens a link, with identical answers; nothing here asks who the visitor is (customer-portal AC 36).
    viewPortal: makeViewPortal(portalReader, portalTokens),
    decidePortal: makeDecidePortal(portalReader, supabasePortalDecider(supabase), portalTokens),
    recordPortalView: makeRecordPortalView(supabasePortalViewRecorder(supabase), portalTokens),
    documentRenderer: reactPdfDocumentRenderer,
    contractRenderer: reactPdfContractRenderer,
    contractReader: supabaseContractReader(supabase),
    contractStore: supabaseContractStore(supabase),
    // Sending a contract for signature (signature-provider): the member's client claims and stores, the provider gets the PDF.
    sendForSignature: makeSendForSignature({
      // The same stateless readers, built over the same member client.
      documents: makeContractDocuments(supabaseContractReader(supabase), supabaseAgreementReader(supabase), settings.get, tenantLogo),
      store: supabaseSignatureStore(supabase),
      renderer: reactPdfContractRenderer,
      provider: docusealSignatureProvider({ apiKey: process.env.DOCUSEAL_API_KEY, apiUrl: process.env.DOCUSEAL_API_URL }),
      tokens: signingTokens,
    }),
    // The stored signed contract and audit log, read as the member (signature-webhook door 6).
    signedCopyReader: supabaseSignedCopyReader(supabase),
    signingSecrets: supabaseSigningSecrets(supabase),
    signingTokens,
    viewSigning: makeViewSigning(supabaseSigningReader(supabase), signingTokens),
    clock: systemClock,
  };
}

export type Container = Awaited<ReturnType<typeof getContainer>>;

/**
 * Wires n8n's signed callback (outbox-dispatch doors 3, 6, 7). No user session: the client is `anon` with the
 * publishable key, and the database verifies the signature itself, so no service-role key and no shared secret here.
 * Without `RESEND_API_KEY` or `EMAIL_FROM` every callback answers unavailable and nothing is claimed.
 */
export async function getAutomationContainer(requestOrigin: string) {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      notify: async (): Promise<NotifyResult> => {
        console.error("Automation callback refused: email not configured (RESEND_API_KEY, EMAIL_FROM)");
        return { ok: false, code: "unavailable" };
      },
    };
  }

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    notify: makeNotify(
      supabaseAutomationCallbacks(supabase),
      resendEmailSender({ apiKey, from }),
      makePortalTokens(process.env.PORTAL_LINK_KEY),
      process.env.APP_BASE_URL || requestOrigin,
      makePortalTokens(process.env.SIGNING_LINK_KEY),
    ),
  };
}

export type AutomationContainer = Awaited<ReturnType<typeof getAutomationContainer>>;

/**
 * Wires DocuSeal's signed webhook (signature-webhook doors 1, 4, 5). No user session: the client is `anon` with the
 * publishable key, and the database verifies the signature with its own Vault secret, so no service-role key and no
 * DocuSeal key are read here; the signed files are downloaded from DocuSeal's file host with no credentials. The same client asks
 * Supabase Auth for the owner's sign-in link after a Stripe checkout creates a workspace (workspace-provisioning door 3).
 */
export async function getWebhookContainer() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    receive: makeReceiveSignatureEvent(supabaseSignatureWebhooks(supabase), docusealSignedDocuments()),
    receiveStripe: makeReceiveStripeEvent(supabaseStripeEvents(supabase), supabaseInvitationLinkSender(supabase)),
  };
}

export type WebhookContainer = Awaited<ReturnType<typeof getWebhookContainer>>;

/**
 * Wires the success page's workspace status (workspace-pending-state door 2). No user session: the client is `anon` with the
 * publishable key and keeps no cookie, and the database answers from the stored Checkout event by session id.
 */
export async function getWorkspaceStatusContainer() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { workspaceStatus: supabaseWorkspaceStatus(supabase) };
}

export type WorkspaceStatusContainer = Awaited<ReturnType<typeof getWorkspaceStatusContainer>>;

/**
 * Wires the register page's start-trial (pricing-page door 3, billing-checkout door 1). It reads no cookie; with Stripe configured it asks the database (anon) whether the email is taken.
 * With `STRIPE_SECRET_KEY` and `APP_BASE_URL` both set it starts a Stripe Checkout session; with either missing every
 * selection answers `not_configured` and no request is made. `STRIPE_SECRET_KEY` is read only here.
 */
export async function getBillingContainer() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const appBaseUrl = process.env.APP_BASE_URL;
  const checkout: CheckoutStarter =
    secretKey && appBaseUrl ? stripeCheckoutStarter({ secretKey, appBaseUrl }) : { start: async () => ({ ok: false, code: "not_configured" }) };
  // Only a configured Stripe asks the database; with none, every selection is `not_configured` and no client is made. The anon
  // client is built on the first question, so missing Supabase variables are an `unavailable` answer, not a failed page.
  const emailCheck: WorkspaceEmailCheck | undefined =
    secretKey && appBaseUrl
      ? {
          inUse: (email) => {
            const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
            const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
            return supabaseWorkspaceEmailCheck(createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })).inUse(email);
          },
        }
      : undefined;
  return { startTrial: makeStartTrial(checkout, emailCheck) };
}

export type BillingContainer = Awaited<ReturnType<typeof getBillingContainer>>;
