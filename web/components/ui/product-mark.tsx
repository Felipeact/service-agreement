/**
 * The product mark: a rounded square holding a service cycle with a tick inside it, an agreement that comes round
 * again and is signed. It is the product's own, so it appears on the app's screens and the sign-in page and never
 * on what the customer sees, which wears the tenant's logo (DESIGN.md, The Tenant Wears the Accent Rule).
 */
export function ProductMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <rect width="24" height="24" rx="6" className="fill-action" />
      <path d="M12 5.75A6.25 6.25 0 1 1 5.75 12" fill="none" className="stroke-surface" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m9.25 12.1 2 2 3.6-3.9" fill="none" className="stroke-surface" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
