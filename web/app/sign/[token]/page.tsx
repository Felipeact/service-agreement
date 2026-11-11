import { notFound } from "next/navigation";
import { SigningView } from "@/components/signing/signing-view";
import { getContainer } from "@/composition";

/** Reads the link at request time. A page render writes nothing, and neither does anything on it (signature-provider AC 22, AC 23). */
export async function SigningForRequest({ token }: { token: string }) {
  const { viewSigning, logo } = await getContainer();
  const result = await viewSigning(token);
  if (!result) notFound();
  return <SigningView result={result} logoUrl={logo.url(result.state === "unavailable" ? null : (result.tenant?.logoPath ?? null))} />;
}

export default async function SignPage({ params }: PageProps<"/sign/[token]">) {
  const { token } = await params;
  return <SigningForRequest token={token} />;
}
