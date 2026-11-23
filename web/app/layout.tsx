import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "@/components/motion/motion-root";
import { MATERIAL_SYMBOLS_HREF } from "@/lib/material-icons";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const description = "Recurring service agreements for trade contractors, from the customer's list to signature.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL?.trim() || "http://localhost:3000"),
  openGraph: { siteName: "Service Pacts", type: "website", locale: "en_CA", title: "Service Pacts", description },
  twitter: { card: "summary_large_image", title: "Service Pacts", description },
  title: {
    template: "%s · Service Pacts",
    default: "Service Pacts",
  },
  description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* The mockup pages' icon font, subset to the icons they use (lib/material-icons.ts). */}
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
      </head>
      <body className="min-h-dvh">
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
