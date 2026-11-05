import { LinkNotWorking } from "@/components/review/link-not-working";

/** Reached when the link goes away between the proxy's check and the page's read. */
export default function ReviewNotFound() {
  return <LinkNotWorking />;
}
