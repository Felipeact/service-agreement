/** What stops a company from sending: a missing or demo-shaped detail, or details nobody confirmed. */
export type CompanyProblem = "legalName" | "address" | "phone" | "unconfirmed";

export type CompanyDetails = {
  legalName: string | null;
  address: string | null;
  phone: string | null;
  /** When an owner or admin last saved real details; `null` when they never did. */
  confirmedAt: Date | null;
};

export type CompanyReadiness = { ready: true } | { ready: false; problems: CompanyProblem[] };

/**
 * Shapes the demo seed uses (supabase/seed.sql): the sample company, its street and postal code, and a 555-01xx number
 * (reserved for fiction). `supabase/migrations/20261116120000_p0_launch_fixes.sql` backfills with the same four patterns.
 */
const PLACEHOLDERS = {
  legalName: [/kettle ridge/i],
  address: [/sample street/i, /0a0\s*$/i],
  phone: [/555[-. ]?01\d\d/],
} as const;

const isPlaceholder = (field: keyof typeof PLACEHOLDERS, value: string) => PLACEHOLDERS[field].some((pattern) => pattern.test(value));

/**
 * Whether an agreement may be sent in this company's name. Each of the three details must be present and not
 * placeholder-shaped; then the details must also have been confirmed by a save (p0-launch-fixes, door 3).
 */
export function companyDetailsReady(details: CompanyDetails): CompanyReadiness {
  const problems: CompanyProblem[] = (["legalName", "address", "phone"] as const).filter((field) => {
    const value = (details[field] ?? "").trim();
    return value === "" || isPlaceholder(field, value);
  });
  if (problems.length === 0 && details.confirmedAt === null) problems.push("unconfirmed");
  return problems.length === 0 ? { ready: true } : { ready: false, problems };
}
