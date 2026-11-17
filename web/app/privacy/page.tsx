import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

/** Starter policy. A lawyer has not reviewed it; the notice on the page says so. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This explains what personal information Service Pacts collects, why, and who else handles it."
      updated="2026-11-16"
      sections={[
        {
          heading: "What we collect",
          body: [
            "From you: your name, work email, phone and company details, and your payment details, which our payment provider holds and we never see in full.",
            "From your work in the product: customers, sites, lists of units, agreements and signatures that you or your customers enter, including your customers' names, emails and the time and network address of each signature.",
          ],
        },
        { heading: "Why we collect it", body: ["To run your workspace, send the agreements you ask us to send, record signatures, bill you, and keep the service secure. We do not sell personal information."] },
        { heading: "Who else handles it", body: ["We use service providers to run the product: a database and sign-in provider, a hosting provider, a payment provider (Stripe), an e-signature provider (DocuSeal), an email delivery provider, and an AI provider that reads the lists of units you upload when you use the import. They handle data only to provide those services."] },
        { heading: "Where it is stored", body: ["See the security page for what we can state about where data is kept."] },
        { heading: "How long we keep it", body: ["We keep your records while your workspace exists so your agreements and signed contracts stay available. Ask us to delete your workspace and we will. Signed contracts and their audit logs are records of an agreement between you and your customer."] },
        { heading: "Your choices", body: ["You can ask to see, correct or delete the personal information we hold about you through the contact page. Your customers can ask you, and you can pass the request to us."] },
        { heading: "Changes and contact", body: ["We will change the date at the top when this policy changes. Questions go through the contact page."] },
      ]}
    />
  );
}
