import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { makeRequestSignInLink, makeTransitionAgreement, makeTransitionContract } from "@/application/use-cases";
import { systemClock } from "@/infrastructure/clock";
import type { Database } from "@/infrastructure/supabase/database.types";
import { supabaseAgreementRepository, supabaseContractRepository } from "@/infrastructure/supabase";
import { supabaseAuthGateway, supabaseMemberDirectory } from "@/infrastructure/supabase/auth";
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

  return {
    requestSignInLink: makeRequestSignInLink(auth),
    verifyEmailLink: auth.verifyEmailLink,
    signOut: auth.signOut,
    currentMember: members.currentMember,
    transitionAgreement: makeTransitionAgreement(supabaseAgreementRepository(supabase)),
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
    clock: systemClock,
  };
}

export type Container = Awaited<ReturnType<typeof getContainer>>;
