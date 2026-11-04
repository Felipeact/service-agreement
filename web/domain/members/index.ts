/** The four roles of a member, in the order the roster lists them (members-page). */
export const ROLES = ["owner", "admin", "estimator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", estimator: "Estimator", viewer: "Viewer" };

/** The role the invite form starts on: the least privilege (members-page Assumptions). */
export const DEFAULT_INVITE_ROLE: Role = "viewer";

/** The longest address SMTP delivers (RFC 5321 path limit); the database checks the same bound. */
export const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export type InvitationInput = { email: string; role: string };
export type InvitationValue = { email: string; role: Role };

/** The address trimmed and lowercased, as the table stores it, with a role from the four (AC 7, 8). */
export function validateInvitation(input: InvitationInput): { ok: true; value: InvitationValue } | { ok: false } {
  const email = input.email.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email) || !isRole(input.role)) return { ok: false };
  return { ok: true, value: { email, role: input.role } };
}

/** An invitation is expired from the moment its expiry is reached (AC 3). */
export function isExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
