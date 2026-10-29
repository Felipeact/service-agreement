import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { OrgSettingsValue } from "@/domain/org-settings";
import {
  makeDecidePortal,
  makeExtractImport,
  makeNotify,
  makeReadImport,
  makeRecordPortalView,
  makeReissueLink,
  makeRequestSignInLink,
  makeSendAgreement,
  makeTransitionAgreement,
  makeTransitionContract,
  makeViewPortal,
  type NotifyResult,
} from "@/application/use-cases";
import { systemClock } from "@/infrastructure/clock";
import { claudeAssetExtractor } from "@/infrastructure/claude";
import { reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { importParser } from "@/infrastructure/import-parsers";
import { makePortalTokens } from "@/infrastructure/portal-tokens";
import { resendEmailSender } from "@/infrastructure/email";
import { supabaseAutomationCallbacks } from "@/infrastructure/supabase/automation";
import type { Database } from "@/infrastructure/supabase/database.types";
import { supabaseAgreementRepository, supabaseContractRepository } from "@/infrastructure/supabase";
import { supabaseAgreementReader, supabaseAgreementStore, supabaseServiceLineStore } from "@/infrastructure/supabase/agreements";
import { supabaseAuthGateway, supabaseMemberDirectory } from "@/infrastructure/supabase/auth";
import { supabaseImportReviewReader, supabaseImportRowStore } from "@/infrastructure/supabase/import-review";
import { supabaseImportJobReader, supabaseImportJobStore } from "@/infrastructure/supabase/imports";
import {
  supabaseAgreementSender,
  supabasePortalDecider,
  supabasePortalLinkStore,
  supabasePortalReader,
  supabasePortalViewRecorder,
} from "@/infrastructure/supabase/portal";
import {
  supabaseAssetTypeCatalog,
  supabaseCustomerDirectory,
  supabasePipelineReader,
  supabaseSiteRegister,
} from "@/infrastructure/supabase/readers";
import { supabaseAssetStore, supabaseContactStore, supabaseCustomerStore, supabaseSiteStore } from "@/infrastructure/supabase/records";
import { supabaseOrgSettingsStore } from "@/infrastructure/supabase/settings";

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
  const members = supabaseMemberDirectory(supabase);
  const pipeline = supabasePipelineReader(supabase, systemClock);
  const customers = supabaseCustomerDirectory(supabase);
  const sites = supabaseSiteRegister(supabase);
  const settings = supabaseOrgSettingsStore(supabase);
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

  return {
    requestSignInLink: makeRequestSignInLink(auth),
    verifyEmailLink: auth.verifyEmailLink,
    signOut: auth.signOut,
    currentMember: members.currentMember,
    transitionAgreement: makeTransitionAgreement(agreementRepository),
    transitionContract: makeTransitionContract(supabaseContractRepository(supabase)),
    pipelineBoard: pipeline.board,
    listCustomers: customers.list,
    customerDetail: customers.detail,
    siteRegister: sites.get,
    getOrgSettings: settings.get,
    saveOrgSettings: (orgId: string, value: OrgSettingsValue) => settings.save(orgId, value, systemClock.now()),
    contactForEdit: customers.contact,
    assetForEdit: sites.asset,
    listAssetTypes: supabaseAssetTypeCatalog(supabase).list,
    createCustomer: customerStore.create,
    updateCustomer: customerStore.update,
    createContact: contactStore.create,
    updateContact: contactStore.update,
    deleteContact: contactStore.delete,
    createSite: siteStore.create,
    updateSite: siteStore.update,
    createAsset: assetStore.create,
    updateAsset: assetStore.update,
    deleteAsset: assetStore.delete,
    listImportJobs: supabaseImportJobReader(supabase).forSite,
    startImport: importJobs.start,
    confirmImportUpload: importJobs.confirmUploaded,
    discardImport: importJobs.discard,
    // The same member-scoped store: the file is downloaded under RLS, never with a service-role key.
    readImport: makeReadImport(importJobs, importParser),
    extractImport: makeExtractImport(importJobs, importParser, claudeAssetExtractor({ apiKey: process.env.ANTHROPIC_API_KEY }), supabaseAssetTypeCatalog(supabase)),
    reviewImport: supabaseImportReviewReader(supabase).forJob,
    updateImportRow: importRows.update,
    skipImportRow: importRows.setSkipped,
    mapImportType: importRows.mapType,
    commitImport: importJobs.commit,
    // Agreements and their lines are read and written as the member, from the same client (AC 29).
    agreementReader: supabaseAgreementReader(supabase),
    agreementStore: supabaseAgreementStore(supabase),
    serviceLineStore: supabaseServiceLineStore(supabase),
    // Sending and re-linking run as the member too: the token is made here and only its hash reaches the database.
    sendAgreement: makeSendAgreement(agreementRepository, supabaseAgreementSender(supabase), portalTokens),
    reissueLink: makeReissueLink(supabasePortalLinkStore(supabase), portalTokens),
    // The customer side reads and writes through the same cookie client: `anon` for a customer, `authenticated` for a
    // member who opens a link, with identical answers; nothing here asks who the visitor is (customer-portal AC 36).
    viewPortal: makeViewPortal(portalReader, portalTokens),
    decidePortal: makeDecidePortal(portalReader, supabasePortalDecider(supabase), portalTokens),
    recordPortalView: makeRecordPortalView(supabasePortalViewRecorder(supabase), portalTokens),
    documentRenderer: reactPdfDocumentRenderer,
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
    ),
  };
}

export type AutomationContainer = Awaited<ReturnType<typeof getAutomationContainer>>;
