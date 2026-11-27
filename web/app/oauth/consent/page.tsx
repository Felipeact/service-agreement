import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getContainer } from "@/composition";
import { Content } from "./_components/content";

export const metadata: Metadata = { title: "Connect an AI client", robots: { index: false } };

const ID = /^[A-Za-z0-9._-]{8,200}$/;

/** Reads the request at run time: a signed-in member sees the consent card; a signed-out visitor goes to sign-in; an unknown or expired request goes home. */
async function Consent({ searchParams }: Pick<PageProps<"/oauth/consent">, "searchParams">) {
  const { authorization_id: raw } = await searchParams;
  const authorizationId = typeof raw === "string" && ID.test(raw) ? raw : null;
  if (!authorizationId) redirect("/pipeline");
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  const request = await container.oauthConsent.details(authorizationId).catch(() => null);
  if (!request) redirect("/pipeline");
  if (request.kind === "redirect") redirect(request.url);
  return <Content authorizationId={authorizationId} clientName={request.clientName} email={request.email} companyName={member.orgName} />;
}

export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <Suspense fallback={null}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}
