import { decideAction, recordViewAction } from "./actions";
import { ReviewView } from "./_components/content";
import { loadReview } from "./_data-access/review";

/** Reads the link at request time. A page render writes nothing (customer-portal AC 25): the view is recorded from the browser. */
export async function ReviewForRequest({ token }: { token: string }) {
  const { view, state, logoUrl, imageUrls } = await loadReview(token);
  return <ReviewView token={token} view={view} state={state} logoUrl={logoUrl} imageUrls={imageUrls} actions={{ decide: decideAction.bind(null, token), record: recordViewAction.bind(null, token) }} />;
}

export default async function ReviewPage({ params }: PageProps<"/review/[token]">) {
  const { token } = await params;
  return <ReviewForRequest token={token} />;
}
