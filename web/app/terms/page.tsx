import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

/** Starter terms. A lawyer has not reviewed them (QA report 2026-11-16, P0 item 4); the notice on the page says so. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="These terms cover your use of Service Pacts, the software you use to build, send and track recurring service agreements."
      updated="2026-11-16"
      sections={[
        { heading: "Who these terms are between", body: ["They are between you, the business that creates the workspace, and Felipe Viana, who operates Service Pacts. By creating a workspace or signing in you agree to them on behalf of that business."] },
        { heading: "What the service does", body: ["Service Pacts helps you turn a customer's list of units into a priced agreement, send it to the customer, collect an electronic signature and keep the record. It does not give legal, tax or engineering advice, and it does not perform any service work."] },
        { heading: "Your agreements are yours", body: ["The wording, prices and scope of every agreement are your decision. You are responsible for checking that each agreement is accurate and is what you intend to offer before you send it. Starter wording in the product is a starting point, not legal advice."] },
        { heading: "Your account", body: ["Keep your sign-in link private and tell us if it is misused. You are responsible for what the people you invite do in your workspace."] },
        { heading: "Plans and payment", body: ["Plans are billed monthly in Canadian dollars through our payment provider, Stripe. The price you see when you choose a plan is the price you are charged. You can cancel from the billing page; a cancelled workspace becomes read-only and your records stay readable."] },
        { heading: "Acceptable use", body: ["Do not use the service to send misleading agreements, to attack or overload it, or to store data you have no right to hold."] },
        { heading: "Availability", body: ["We work to keep the service running, but we do not promise it will be uninterrupted or error free."] },
        { heading: "Ending the service", body: ["You can stop using the service at any time. We may suspend a workspace that breaks these terms. Contact us to ask for your data."] },
        { heading: "Changes and contact", body: ["We may update these terms and will change the date at the top when we do. Questions go through the contact page."] },
      ]}
    />
  );
}
