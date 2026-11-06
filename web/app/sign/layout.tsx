import type { Metadata } from "next";

// The signer's tab and any link preview name no product; the root layout's title template and description would.
export const metadata: Metadata = {
  title: { absolute: "Contract" },
  description: "Sign a contract.",
  robots: { index: false, follow: false },
};

export default function SignLayout({ children }: LayoutProps<"/sign">) {
  return children;
}
