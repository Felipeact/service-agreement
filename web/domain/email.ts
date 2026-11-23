/** The longest address SMTP delivers (RFC 5321 path limit). */
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether `input`, trimmed and lowercased as a sign-in stores it, looks like an address someone could receive mail at. */
export function isEmailAddress(input: string): boolean {
  const email = input.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email);
}
