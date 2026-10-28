import type { Metadata } from "next";

// The customer's tab and any link preview name no product; the root layout's title template and description would.
export const metadata: Metadata = {
  title: { absolute: "Agreement" },
  description: "Review an agreement.",
  robots: { index: false, follow: false },
};

export default function ReviewLayout({ children }: LayoutProps<"/review">) {
  return children;
}
