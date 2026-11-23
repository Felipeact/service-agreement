import { SigningView } from "@/components/signing/signing-view";
import { loadSigning } from "./_data-access/signing";

/** Reads the link at request time. A page render writes nothing, and neither does anything on it (signature-provider AC 22, AC 23). */
export async function SigningForRequest({ token }: { token: string }) {
  const { result, logoUrl } = await loadSigning(token);
  return <SigningView result={result} logoUrl={logoUrl} />;
}

export default async function SignPage({ params }: PageProps<"/sign/[token]">) {
  const { token } = await params;
  return <SigningForRequest token={token} />;
}
