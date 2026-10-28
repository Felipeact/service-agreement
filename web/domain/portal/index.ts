import type { AgreementStatus } from "../agreement";

/** A link's token as it appears in the address: 32 random bytes as 43 base64url characters (customer-portal door 1). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isPortalToken(value: string): boolean {
  return TOKEN.test(value);
}

/** What an address that works for nobody says; it names no tenant and no agreement (AC 9). */
export const LINK_NOT_WORKING = "This link doesn't work. Ask the company that sent it for a new one.";

/** The address a customer opens: `<base>/review/<token>`, whatever trailing slashes the base carries. */
export function portalLinkUrl(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/review/${token}`;
}

/** What a link shows its customer; derived from the link and the agreement, never stored (customer-portal Impact). */
export type PortalState = "open" | "decided" | "superseded" | "replaced" | "withdrawn" | "expired" | "unknown";

export type PortalStateInput = {
  /** `null` for a hash no link has. `current` is whether the link's version is the agreement's latest. */
  link: { revoked: boolean; current: boolean } | null;
  status: AgreementStatus;
};

/** One of seven states. A revoked link is `replaced` whatever the agreement did since (AC 13 to 17). */
export function portalState({ link, status }: PortalStateInput): PortalState {
  if (!link) return "unknown";
  if (link.revoked) return "replaced";
  if (status === "withdrawn") return "withdrawn";
  if (status === "expired") return "expired";
  if (!link.current) return "superseded";
  if (status === "sent") return "open";
  if (status === "accepted" || status === "refused" || status === "changes_requested") return "decided";
  return "unknown";
}

const DARK_TEXT = "#050505";
const LIGHT_TEXT = "#ffffff";

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** A tenant accent as the settings store it: `#` and six hex digits. */
export function isAccent(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** White or near-black, whichever reads better on `accent`; either way at least 4.5:1 (AC 12). */
export function contrastText(accent: string): string {
  const light = luminance(accent) + 0.05;
  return 1.05 / light >= light / (luminance(DARK_TEXT) + 0.05) ? LIGHT_TEXT : DARK_TEXT;
}
