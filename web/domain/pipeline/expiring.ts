import { formatTermDate } from "../agreement/term";

/** How far ahead "Expiring soon" looks (renewal AC 36). */
export const EXPIRING_WINDOW_DAYS = 90;

/** An accepted agreement whose term ends soon, with what W7 did or will do about it (renewal S6). */
export type ExpiringAgreement = {
  id: string;
  number: string;
  site: string;
  customer: string;
  /** Calendar dates `YYYY-MM-DD`. */
  termEnd: string;
  noticeDate: string;
  annualCents: number;
  renewal: { id: string; number: string; status: string } | null;
  /** The site's agreement in draft, sent or changes requested, which keeps W7 from renewing (renewal AC 21). */
  openAgreement: string | null;
};

// Days since 1970-01-01 for a proleptic Gregorian date and back (H. Hinnant's civil algorithms): plain arithmetic, so
// the domain reads no clock (C33).
function toDays(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDays(days: number): string {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` plus `days` (negative goes back), in calendar days. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return fromDays(toDays(year, month, day) + days);
}

/** The row's one state (renewal AC 37 to 40). `today` is `YYYY-MM-DD`. */
export function expiringLabel(row: Pick<ExpiringAgreement, "noticeDate" | "renewal" | "openAgreement">, today: string): string {
  const { renewal } = row;
  if (renewal?.status === "accepted") return `Auto-renewed as ${renewal.number}`;
  if (renewal?.status === "draft") return `Renewal draft ${renewal.number}`;
  if (renewal && renewal.status !== "withdrawn") return `Renewal ${renewal.number} in progress`;
  if (renewal) return `Renewal ${renewal.number} withdrawn`;
  if (row.noticeDate < today && row.openAgreement) return `Renewal blocked: ${row.openAgreement} is open`;
  return `Renews on ${formatTermDate(row.noticeDate)}: automatic or renegotiated by CPI`;
}
