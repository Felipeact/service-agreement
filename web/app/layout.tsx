import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** The display voice: page titles, card and stage names, the product name. Money and body copy stay in Inter, which keeps figures tabular. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Service Agreement",
    default: "Service Agreement",
  },
  description: "Recurring service agreements for trade contractors, from the customer's list to signature.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
