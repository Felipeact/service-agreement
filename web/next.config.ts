import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const supabaseSocket = supabaseOrigin.replace(/^http/, "ws");

/**
 * The site-wide Content-Security-Policy. It is static (no nonce) because a nonce forces every page to render per request and
 * would undo `cacheComponents`; `'unsafe-inline'` stays for the scripts and styles Next.js inlines. What it still stops:
 * scripts, frames, forms and connections to any origin not listed here, plus `<base>` and `<object>` injection.
 * Allowed origins: Supabase (API, storage, realtime), Stripe (js, frames, API), DocuSeal (signing embed), Supademo (/demo
 * walkthrough) and Google Fonts (Material Symbols). Add an origin here before using a new third-party service.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://*.docuseal.com https://*.docuseal.eu`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.stripe.com https://*.docuseal.com https://*.docuseal.eu`.replace(/\s+/g, " "),
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocket} https://api.stripe.com https://*.stripe.com https://*.docuseal.com https://*.docuseal.eu${isDev ? " ws://localhost:* http://localhost:*" : ""}`.replace(/\s+/g, " "),
  "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://*.docuseal.com https://*.docuseal.eu https://app.supademo.com",
  // The PDF preview is a blob: PDF in a frame, and the browser's own PDF viewer needs 'self' and blob: here; no other plugin content is allowed.
  "object-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // A self-contained server (server.js plus only the files it needs) for the Docker image and Kubernetes (web/Dockerfile, ../deploy/k8s).
  output: "standalone",
  cacheComponents: true,
  // The setup screen's catalog draft takes one proposal file of up to 4 MiB through a Server Action (other-trade-draft); the framework limit is app-wide.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // A review link is a secret address: nothing may cache it, send it on as a referrer, or index it (customer-portal door 4).
  async headers() {
    return [
      // Every page: no sniffing, no framing of our pages, HTTPS only, and a referrer that names only our origin. The two secret
      // addresses below come later in the list and keep their stricter `no-referrer` (qa-p1-p2 C7011). The Content-Security-Policy
      // is built above and lists Stripe, the signature provider's frame and the Supabase origin.
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://js.stripe.com\")" },
        ],
      },
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
