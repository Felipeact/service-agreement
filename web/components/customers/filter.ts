import type { CustomerSummary } from "@/application/ports";

/** Keeps the customers whose name or primary contact contains `query`, ignoring case and outer spaces. */
export function filterCustomers(customers: CustomerSummary[], query: string): CustomerSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return customers;
  return customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(needle) || (customer.primaryContact ?? "").toLowerCase().includes(needle),
  );
}
