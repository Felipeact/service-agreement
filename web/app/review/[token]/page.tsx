import { notFound } from "next/navigation";
import { ReviewView } from "@/components/review/review-view";
import { getContainer } from "@/composition";
import { portalViewState } from "@/application/use-cases";
import { decideAction, recordViewAction } from "./actions";

/** Reads the link at request time. A page render writes nothing (customer-portal AC 25): the view is recorded from the browser. */
export async function ReviewForRequest({ token }: { token: string }) {
  const { viewPortal } = await getContainer();
  const view = await viewPortal(token);
  if (!view) notFound();
  const state = portalViewState(view);
  if (state === "unknown") notFound();
  return (
    <ReviewView
      token={token}
      view={view}
      state={state}
      actions={{ decide: decideAction.bind(null, token), record: recordViewAction.bind(null, token) }}
    />
  );
}

export default async function ReviewPage({ params }: PageProps<"/review/[token]">) {
  const { token } = await params;
  return <ReviewForRequest token={token} />;
}
