/** What a successful transition records; the ports item writes it to `events` and `outbox`. */
export type DomainEvent<S extends string = string> = {
  /** `<entity>.<to-status>`, for example `agreement.sent`. n8n binds to these names. */
  type: string;
  entityType: "agreement" | "contract";
  from: S;
  to: S;
  data: { reason?: string; versionNo?: number };
};

export type TransitionErrorCode = "invalid_transition" | "reason_required" | "reason_too_long";

/** A refused move is a value, never a throw: the portal shows it to the customer. */
export type TransitionResult<S extends string> =
  | { ok: true; status: S; event: DomainEvent<S> }
  | { ok: false; error: { code: TransitionErrorCode; from: S; command: string } };
