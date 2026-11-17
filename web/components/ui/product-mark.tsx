/**
 * The product mark: a rounded square holding two arrows that chase each other round a pact, the Service Pacts logo
 * (`public/brand/`). It is the product's own, so it appears on the app's screens and the sign-in page and never on
 * what the customer sees, which wears the tenant's logo (DESIGN.md, The Tenant Wears the Accent Rule). The blue tile
 * reads on both the light site header and the Night shell.
 */
export function ProductMark({ className = "size-6" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static SVG; next/image adds nothing for it
  return <img src="/brand/mark-blue.svg" alt="" aria-hidden="true" className={`shrink-0 ${className}`} />;
}
