import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { HOSTING_APP, HOSTING_DATABASE, HOSTING_PROVIDERS } from "@/components/site/content";

export const metadata: Metadata = { title: "Security and data location" };

/**
 * Only what the repo shows. The hosting region is NOT stated until it is verified (p0-launch-fixes open question 1);
 * `legal-pages.test.ts` fails if a region name is added before then.
 */
export default function SecurityPage() {
  return (
    <LegalPage
      title="Security and data location"
      intro="A short, plain account of how your data is protected and where it lives."
      updated="2026-11-23"
      sections={[
        { heading: "Your data is separated by company", body: ["Every record belongs to one company workspace, and the database refuses to show one company's records to another, even if the app itself had a bug."] },
        { heading: "Sign-in", body: ["You sign in with a one-time link sent to your email. There are no passwords to leak. Roles decide who may change records: viewers can only read."] },
        { heading: "Customers and signing", body: ["Your customer opens a private link, with no account. Signatures are collected through DocuSeal, and each signer's time and network address are kept with the signed document and its audit log."] },
        { heading: "Payments", body: ["Card details go to Stripe. We never store a card number."] },
        { heading: "Where data is kept", body: [HOSTING_DATABASE, HOSTING_APP, HOSTING_PROVIDERS] },
        { heading: "Reporting a problem", body: ["If you find a security problem, write to us through the contact page and we will respond."] },
      ]}
    />
  );
}
