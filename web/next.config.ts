import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The setup screen's catalog draft takes one proposal file of up to 4 MiB through a Server Action (other-trade-draft); the framework limit is app-wide.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // A review link is a secret address: nothing may cache it, send it on as a referrer, or index it (customer-portal door 4).
  async headers() {
    return [
      {
        source: "/review/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      // The same for the customer's signing address: its token is the credential (signature-provider door 7).
      {
        source: "/sign/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
