/** What "Before you send" reads about a draft. */
export type ReadinessInput = {
  /** The site's equipment types with how many units each has. */
  equipment: readonly { units: number }[];
  /** Types on the site that no service line covers, by name. */
  uncovered: readonly { name: string }[];
  /** The service lines' prices per visit, in cents. */
  linePrices: readonly number[];
  termStart: string | null;
  company: { ready: boolean; name: string | null };
  hourlyRateCents: number;
};

/** The section of the agreement page where an item is fixed. */
export type ReadinessTarget = "site" | "lines" | "term" | "company";

/** One thing that must be true before an agreement can be sent, and where on the page it is fixed. */
export type ReadinessItem = { key: "equipment" | "coverage" | "prices" | "term" | "company"; label: string; done: boolean; detail: string; target: ReadinessTarget };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;

/**
 * "Before you send": the five things a draft needs before it goes to the customer, each done or open with a short detail, in the
 * order the page's sections follow. The send action still checks the ones the database can prove (company, coverage, start).
 */
export function sendReadiness(input: ReadinessInput): ReadinessItem[] {
  const units = input.equipment.reduce((sum, type) => sum + type.units, 0);
  const unpriced = input.linePrices.filter((price) => price <= 0).length;
  const lines = input.linePrices.length;
  return [
    {
      key: "equipment",
      label: "Equipment on site",
      done: units > 0,
      detail: units > 0 ? `${plural(input.equipment.length, "kind", "kinds")}, ${plural(units, "unit", "units")}` : "None yet. Add equipment or upload a list.",
      target: "site",
    },
    {
      key: "coverage",
      label: "Every type has a service line",
      done: lines > 0 && input.uncovered.length === 0,
      detail: lines === 0 ? "No service lines yet" : input.uncovered.length === 0 ? plural(lines, "visit plan", "visit plans") : `${input.uncovered.map((type) => type.name).join(", ")} not covered`,
      target: "lines",
    },
    {
      key: "prices",
      label: "Every line has a price",
      done: lines > 0 && unpriced === 0,
      detail: lines === 0 ? "No service lines yet" : unpriced === 0 ? `Labour at ${dollars(input.hourlyRateCents)} an hour` : `${unpriced} at $0`,
      target: "lines",
    },
    {
      key: "term",
      label: "Term start date",
      done: input.termStart !== null,
      detail: input.termStart === null ? "Not set. Needed before sending." : `Starts ${input.termStart}`,
      target: "term",
    },
    {
      key: "company",
      label: "Company details confirmed",
      done: input.company.ready,
      detail: input.company.ready ? (input.company.name ?? "Confirmed") : "Check them in Settings",
      target: "company",
    },
  ];
}

/** Whether every item is done. */
export const isReadyToSend = (items: readonly ReadinessItem[]): boolean => items.every((item) => item.done);

/** Whether every item a section fixes is done; a section no item names is done. */
export const isSectionDone = (items: readonly ReadinessItem[], target: ReadinessTarget): boolean => items.filter((item) => item.target === target).every((item) => item.done);
