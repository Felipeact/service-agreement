/**
 * Invented demonstration data for the staff-app previews (/concepts/app). A fictitious contractor, fictitious customers
 * and sites. Nothing here is read from, or written to, the database.
 */

export type StageKey = "in_progress" | "sent" | "accepted" | "completed" | "refused";

export const COMPANY = { name: "Blue Heron Mechanical", plan: "Team", member: "Dana Whitfield", role: "Owner", email: "dana@blueheron.example", initials: "DW" };

export const STAGES: Record<StageKey, { label: string; dot: string; tint: string; pill: string }> = {
  in_progress: { label: "In progress", dot: "bg-stage-in-progress", tint: "bg-tint-in-progress", pill: "border-pill-in-progress-border bg-pill-in-progress text-pill-in-progress-ink" },
  sent: { label: "Sent to customer", dot: "bg-stage-sent", tint: "bg-tint-sent", pill: "border-pill-sent-border bg-pill-sent text-pill-sent-ink" },
  accepted: { label: "Accepted", dot: "bg-stage-accepted", tint: "bg-tint-accepted", pill: "border-pill-accepted-border bg-pill-accepted text-pill-accepted-ink" },
  completed: { label: "Completed", dot: "bg-stage-completed", tint: "bg-tint-completed", pill: "border-pill-completed-border bg-pill-completed text-pill-completed-ink" },
  refused: { label: "Refused", dot: "bg-stage-refused", tint: "bg-tint-refused", pill: "border-pill-refused-border bg-pill-refused text-pill-refused-ink" },
};
export const STAGE_ORDER: StageKey[] = ["in_progress", "sent", "accepted", "completed", "refused"];

export type Deal = { id: string; number: string; site: string; customer: string; stage: StageKey; annual: number; visits: number; days: number; updated: string; attention?: string; renewal?: boolean };

export const DEALS: Deal[] = [
  { id: "d1", number: "AG-1042", site: "Harbour Point Tower", customer: "Northgate Properties", stage: "in_progress", annual: 14280, visits: 7, days: 2, updated: "2 days ago" },
  { id: "d2", number: "AG-1041", site: "Elm Street School", customer: "Westside District", stage: "in_progress", annual: 7120, visits: 4, days: 16, updated: "16 days ago", attention: "Follow up after 14 days" },
  { id: "d3", number: "AG-1038", site: "Maple Court Plaza", customer: "Ridgeline Realty", stage: "sent", annual: 18900, visits: 9, days: 9, updated: "9 days ago", attention: "No reply in 9 days" },
  { id: "d4", number: "AG-1036", site: "Cedar Medical Centre", customer: "Cedar Health Group", stage: "accepted", annual: 9640, visits: 5, days: 0, updated: "Today" },
  { id: "d5", number: "AG-1031", site: "Pine Ridge Offices", customer: "Pine Ridge Holdings", stage: "completed", annual: 18800, visits: 8, days: 6, updated: "Last week" },
  { id: "d6", number: "AG-1029", site: "Granville Lofts", customer: "Northgate Properties", stage: "completed", annual: 6400, visits: 4, days: 21, updated: "3 weeks ago" },
  { id: "d7", number: "AG-1024", site: "Lakeshore Arena", customer: "City Recreation", stage: "refused", annual: 22400, visits: 10, days: 12, updated: "12 days ago" },
];

export type Expiring = { id: string; number: string; site: string; customer: string; ends: string; left: number; annual: number; note: string };
export const EXPIRING: Expiring[] = [
  { id: "e1", number: "AG-0961", site: "Birchwood Library", customer: "Westside District", ends: "Dec 14, 2026", left: 22, annual: 8900, note: "Renews on Nov 14: automatic" },
  { id: "e2", number: "AG-0948", site: "Quay Street Offices", customer: "Ridgeline Realty", ends: "Jan 31, 2027", left: 70, annual: 12600, note: "Renewal draft AG-1047" },
];

export const money = (value: number) => `$${value.toLocaleString("en-CA")}`;

export type Customer = { id: string; name: string; contact: string; email: string; phone: string; agreements: number; sites: number; value: number; active: boolean };
export const CUSTOMERS: Customer[] = [
  { id: "c1", name: "Northgate Properties", contact: "Priya Anand", email: "priya@northgate.example", phone: "604 555 0142", agreements: 3, sites: 2, value: 20680, active: true },
  { id: "c2", name: "Westside District", contact: "Marcus Lee", email: "marcus@westside.example", phone: "604 555 0188", agreements: 2, sites: 2, value: 16020, active: true },
  { id: "c3", name: "Ridgeline Realty", contact: "Hannah Brooks", email: "hannah@ridgeline.example", phone: "778 555 0107", agreements: 2, sites: 1, value: 31500, active: true },
  { id: "c4", name: "Cedar Health Group", contact: "Dr. Omar Haddad", email: "omar@cedarhealth.example", phone: "604 555 0166", agreements: 1, sites: 1, value: 9640, active: true },
  { id: "c5", name: "Pine Ridge Holdings", contact: "Joan Whitaker", email: "joan@pineridge.example", phone: "250 555 0129", agreements: 1, sites: 1, value: 18800, active: true },
  { id: "c6", name: "City Recreation", contact: "Tomas Reyes", email: "tomas@cityrec.example", phone: "604 555 0191", agreements: 1, sites: 1, value: 0, active: false },
];

export type Site = { id: string; name: string; address: string; customer: string; units: number; live: string | null; types: string };
export const SITES: Site[] = [
  { id: "s1", name: "Harbour Point Tower", address: "1200 Waterfront Rd, Vancouver", customer: "Northgate Properties", units: 14, live: "AG-1042", types: "RTU ×6, Boiler ×2, Exhaust fan ×6" },
  { id: "s2", name: "Elm Street School", address: "88 Elm St, Burnaby", customer: "Westside District", units: 9, live: "AG-1041", types: "RTU ×4, Boiler ×1, Split ×4" },
  { id: "s3", name: "Maple Court Plaza", address: "410 Maple Ct, Richmond", customer: "Ridgeline Realty", units: 18, live: "AG-1038", types: "RTU ×10, Backflow ×2, Fan ×6" },
  { id: "s4", name: "Cedar Medical Centre", address: "27 Cedar Ave, Surrey", customer: "Cedar Health Group", units: 8, live: "AG-1036", types: "RTU ×5, Boiler ×3" },
  { id: "s5", name: "Granville Lofts", address: "950 Granville St, Vancouver", customer: "Northgate Properties", units: 6, live: null, types: "Split ×6" },
];

export const UNITS = [
  { id: "u1", type: "Rooftop unit", unit: "RTU-1", model: "Carrier 48TC", location: "Roof, north", source: "Imported" },
  { id: "u2", type: "Rooftop unit", unit: "RTU-2", model: "Trane YHC", location: "Roof, north", source: "Imported" },
  { id: "u3", type: "Boiler", unit: "B-1", model: "Lochinvar 1000", location: "Mechanical room", source: "Imported" },
  { id: "u4", type: "Exhaust fan", unit: "EF-3", model: "Greenheck", location: "Level 4", source: "Added by hand" },
  { id: "u5", type: "Backflow preventer", unit: "BF-1", model: "Watts 909", location: "Lobby riser", source: "Imported" },
];

export const MEMBERS = [
  { id: "m1", name: "Dana Whitfield", email: "dana@blueheron.example", role: "Owner" },
  { id: "m2", name: "Jordan Pike", email: "jordan@blueheron.example", role: "Admin" },
  { id: "m3", name: "Sam Okafor", email: "sam@blueheron.example", role: "Estimator" },
  { id: "m4", name: "Riley Chen", email: "riley@blueheron.example", role: "Viewer" },
];

export const ACTIVITY = [
  { who: "Sam Okafor", what: "sent the agreement to Priya Anand", when: "Nov 20, 9:14" },
  { who: "Priya Anand", what: "opened the review link", when: "Nov 20, 11:02" },
  { who: "Sam Okafor", what: "edited the service lines", when: "Nov 19, 16:40" },
  { who: "Sam Okafor", what: "created version 1 from Standard agreement", when: "Nov 18, 10:05" },
];

export const SERVICE_LINES = [
  { name: "Heating and cooling preventive maintenance, quarterly", detail: "Mar, Jun, Sep, Dec · 4 visits/yr", types: "Rooftop unit, Split", visits: 4, per: 2400 },
  { name: "Boiler seasonal service", detail: "Apr, Oct · 2 visits/yr", types: "Boiler", visits: 2, per: 1600 },
  { name: "Exhaust fan inspection", detail: "Oct · 1 visit/yr", types: "Exhaust fan", visits: 1, per: 740 },
];

export const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export const SCHEDULE = [
  { name: "Heating and cooling units", months: [2, 5, 8, 11] },
  { name: "Boilers", months: [3, 9] },
  { name: "Exhaust fans", months: [9] },
  { name: "Backflow preventers", months: [4] },
];

export const PLANS = [
  { key: "starter", name: "Starter", price: 79, limit: 15, seats: 2, blurb: "For one estimator getting agreements out of spreadsheets." },
  { key: "team", name: "Team", price: 149, limit: 50, seats: 6, blurb: "For an office that sends agreements every week." },
  { key: "pro", name: "Pro", price: 299, limit: 200, seats: 15, blurb: "For several branches sharing templates." },
];

export const INVOICES = [
  { id: "in1", date: "Nov 1, 2026", amount: "$149.00", status: "Paid" },
  { id: "in2", date: "Oct 1, 2026", amount: "$149.00", status: "Paid" },
  { id: "in3", date: "Sep 1, 2026", amount: "$149.00", status: "Paid" },
];

export const TEMPLATES = [
  { id: "t1", name: "Standard agreement", kind: "Agreement", uses: 24, updated: "Nov 12", archived: false },
  { id: "t2", name: "Seasonal service visits", kind: "Agreement", uses: 11, updated: "Oct 30", archived: false },
  { id: "t3", name: "Backflow annual test", kind: "Agreement", uses: 6, updated: "Oct 2", archived: false },
  { id: "t4", name: "Contract wording", kind: "Contract wording", uses: 31, updated: "Sep 18", archived: false },
];

export const IMPORT_ROWS = [
  { id: "r1", raw: "RTU 1 - Carrier 48TC", type: "Rooftop unit", conf: 98 },
  { id: "r2", raw: "Boiler feed pump", type: "Boiler", conf: 61 },
  { id: "r3", raw: "EF3 exhaust", type: "Exhaust fan", conf: 92 },
  { id: "r4", raw: "Watts backflow 2in", type: "Backflow preventer", conf: 95 },
  { id: "r5", raw: "Misc roof item", type: "", conf: 0 },
];
