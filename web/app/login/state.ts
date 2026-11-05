/** What the sign-in form shows after each submit. Errors keep the typed email so the field is not cleared. */
export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "invalid_email" | "rate_limited" | "unavailable"; email: string };

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };
