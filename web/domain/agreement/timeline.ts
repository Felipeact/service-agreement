import { formatTermDate } from "./term";

/** The `agreement.*` events the activity timeline lists, and what each is called there (activity-timeline AC 1, 2). */
const LABELS = {
  "agreement.sent": "Sent to customer",
  "agreement.viewed": "Viewed by customer",
  "agreement.accepted": "Accepted",
  "agreement.refused": "Refused",
  "agreement.changes_requested": "Changes requested",
  "agreement.revised": "New version created",
  "agreement.expired": "Expired",
  "agreement.withdrawn": "Withdrawn",
  "agreement.renewed": "Renewed",
  "agreement.renewal_drafted": "Renewal draft created",
} as const;

export const TIMELINE_EVENT_TYPES = Object.keys(LABELS);

export type TimelineType = "created" | "sent" | "viewed" | "accepted" | "refused" | "changes_requested" | "revised" | "expired" | "withdrawn" | "renewed" | "renewal_drafted";

/** One event as the reader hands it over: the version and the actor's role are already resolved. */
export type TimelineSource = {
  type: string;
  at: Date;
  versionNo: number | null;
  /** Whether the event names an actor; `actorRole` is `null` when that actor is no longer a member of the org. */
  hasActor: boolean;
  actorRole: string | null;
  payload: Record<string, unknown>;
};

export type TimelineEntry = {
  type: TimelineType;
  label: string;
  at: Date;
  versionNo: number | null;
  /** A role, `customer` or `automatic`; `null` when the actor is unknown. */
  by: string | null;
  reason: string | null;
  detail: string | null;
};

const REASON_TYPES = new Set(["agreement.refused", "agreement.changes_requested"]);
const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

/** The customer acts through the portal, and a `viewed` event has no actor (AD-069); a system event has none and no portal. */
function actorOf(event: TimelineSource): string | null {
  if (event.payload.via === "portal" || (event.type === "agreement.viewed" && !event.hasActor)) return "customer";
  return event.hasActor ? event.actorRole : "automatic";
}

function detailOf(event: TimelineSource, renews: { id: string; number: string } | null): string | null {
  if (event.type === "agreement.expired") {
    const until = text(event.payload.validUntil);
    return until ? `Valid until ${formatTermDate(until)}` : null;
  }
  if (event.type === "agreement.renewed" || event.type === "agreement.renewal_drafted") {
    return renews && event.payload.renewsAgreementId === renews.id ? `Renews ${renews.number}` : null;
  }
  return null;
}

/**
 * Everything that happened to an agreement, newest first: its events of the listed types plus a "Created" entry at
 * version 1. `events` come in the order they were written, so a tie in time keeps the later write first.
 */
export function buildTimeline(input: {
  events: readonly TimelineSource[];
  created: { at: Date; authorRole: string | null } | null;
  renews: { id: string; number: string } | null;
}): TimelineEntry[] {
  const oldestFirst: TimelineEntry[] = [];
  if (input.created) {
    oldestFirst.push({ type: "created", label: "Created", at: input.created.at, versionNo: 1, by: input.created.authorRole, reason: null, detail: null });
  }
  for (const event of input.events) {
    const label = (LABELS as Record<string, string>)[event.type];
    if (!label) continue;
    const deactivated = event.type === "agreement.withdrawn" && event.payload.via === "deactivation";
    oldestFirst.push({
      type: event.type.slice("agreement.".length) as TimelineType,
      label: deactivated ? `${label} · site deactivated` : label,
      at: event.at,
      versionNo: event.versionNo,
      by: actorOf(event),
      reason: REASON_TYPES.has(event.type) ? text(event.payload.reason) : null,
      detail: detailOf(event, input.renews),
    });
  }
  return oldestFirst
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.at.getTime() - b.entry.at.getTime() || a.index - b.index)
    .reverse()
    .map(({ entry }) => entry);
}
