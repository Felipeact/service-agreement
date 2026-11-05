import { describe, expect, test } from "vitest";
import { buildTimeline, type TimelineSource } from "./timeline";

const at = (hour: number, day = 21) => new Date(Date.UTC(2026, 9, day, hour));
const source = (type: string, over: Partial<TimelineSource> = {}): TimelineSource => ({
  type,
  at: at(9),
  versionNo: 1,
  hasActor: true,
  actorRole: "estimator",
  payload: {},
  ...over,
});
const build = (events: TimelineSource[], over: { renews?: { id: string; number: string } | null } = {}) =>
  buildTimeline({ events, created: { at: at(8, 20), authorRole: "estimator" }, renews: over.renews ?? null });

describe("buildTimeline", () => {
  test.each([
    ["agreement.sent", "Sent to customer"],
    ["agreement.viewed", "Viewed by customer"],
    ["agreement.accepted", "Accepted"],
    ["agreement.refused", "Refused"],
    ["agreement.changes_requested", "Changes requested"],
    ["agreement.revised", "New version created"],
    ["agreement.expired", "Expired"],
    ["agreement.withdrawn", "Withdrawn"],
    ["agreement.renewed", "Renewed"],
    ["agreement.renewal_drafted", "Renewal draft created"],
  ])("C1478: %s is labelled %s", (type, label) => {
    const entries = build([source(type)]);
    expect(entries.filter((e) => e.type !== "created").map((e) => e.label)).toEqual([label]);
  });

  test("C1479: Created is dated at version 1 with its author's role, or no actor", () => {
    const withAuthor = buildTimeline({ events: [], created: { at: at(8, 20), authorRole: "owner" }, renews: null });
    expect(withAuthor).toEqual([{ type: "created", label: "Created", at: at(8, 20), versionNo: 1, by: "owner", reason: null, detail: null }]);
    const none = buildTimeline({ events: [], created: { at: at(8, 20), authorRole: null }, renews: null });
    expect(none[0]?.by).toBeNull();
  });

  test("C1480: an entry carries the version its event names, or none", () => {
    const entries = build([source("agreement.sent", { versionNo: 2, at: at(9) }), source("agreement.sent", { versionNo: null, at: at(10) })]);
    expect(entries.map((e) => [e.label, e.versionNo])).toEqual([
      ["Sent to customer", null],
      ["Sent to customer", 2],
      ["Created", 1],
    ]);
  });

  test("C1481: newest first, a tie reverses the write order, and Created is last on a tie", () => {
    const first = source("agreement.sent", { at: at(8, 20) });
    const second = source("agreement.viewed", { at: at(8, 20), hasActor: false, actorRole: null });
    const later = source("agreement.accepted", { at: at(9, 22) });
    const entries = build([first, second, later]);
    expect(entries.map((e) => e.label)).toEqual(["Accepted", "Viewed by customer", "Sent to customer", "Created"]);
  });

  test("C1482: an event outside the ten makes no entry and no error", () => {
    const entries = build([source("contract.completed"), source("agreement.created"), source("agreement.sent")]);
    expect(entries.map((e) => e.label)).toEqual(["Sent to customer", "Created"]);
  });

  test.each([
    ["a member", source("agreement.sent", { hasActor: true, actorRole: "owner" }), "owner"],
    ["the portal", source("agreement.refused", { hasActor: false, actorRole: null, payload: { via: "portal" } }), "customer"],
    ["a viewed event with no actor", source("agreement.viewed", { hasActor: false, actorRole: null }), "customer"],
    ["an expiry with no actor", source("agreement.expired", { hasActor: false, actorRole: null }), "automatic"],
    ["a renewal with no actor", source("agreement.renewed", { hasActor: false, actorRole: null }), "automatic"],
    ["a renewal draft with no actor", source("agreement.renewal_drafted", { hasActor: false, actorRole: null }), "automatic"],
    ["a departed member", source("agreement.sent", { hasActor: true, actorRole: null }), null],
  ])("C1485: the actor of %s is %s", (_name, event, by) => {
    expect(build([event])[0]?.by).toBe(by);
  });

  test("C1487: a reason shows on a refusal and a change request, and on no other type", () => {
    const entries = build([
      source("agreement.refused", { payload: { reason: "Too expensive" }, at: at(9) }),
      source("agreement.changes_requested", { payload: { reason: "Add a spring visit" }, at: at(10) }),
      source("agreement.sent", { payload: { reason: "ignored" }, at: at(11) }),
      source("agreement.accepted", { payload: { reason: 5 }, at: at(12) }),
    ]);
    const reasons = Object.fromEntries(entries.map((e) => [e.label, e.reason]));
    expect(reasons).toMatchObject({
      Refused: "Too expensive",
      "Changes requested": "Add a spring visit",
      "Sent to customer": null,
      Accepted: null,
    });
  });

  test("C1488: a withdrawal by deactivation says so, and any other is plain", () => {
    const entries = build([
      source("agreement.withdrawn", { payload: { via: "deactivation" }, at: at(9) }),
      source("agreement.withdrawn", { payload: { from: "draft", to: "withdrawn" }, at: at(10) }),
    ]);
    expect(entries.map((e) => e.label)).toEqual(["Withdrawn", "Withdrawn · site deactivated", "Created"]);
  });

  test("C1489: expiry shows its last day, and a renewal shows the agreement it renews only when that is the linked one", () => {
    const renews = { id: "old-1", number: "AG-1004" };
    const entries = build(
      [
        source("agreement.expired", { payload: { validUntil: "2026-12-01" }, at: at(9) }),
        source("agreement.renewed", { payload: { renewsAgreementId: "old-1" }, at: at(10) }),
        source("agreement.renewal_drafted", { payload: { renewsAgreementId: "other" }, at: at(11) }),
        source("agreement.renewal_drafted", { payload: { renewsAgreementId: "old-1" }, at: at(12) }),
      ],
      { renews },
    );
    const details = entries.filter((e) => e.type !== "created").map((e) => e.detail);
    expect(details).toEqual(["Renews AG-1004", null, "Renews AG-1004", "Valid until Dec 1, 2026"]);
    expect(build([source("agreement.renewed", { payload: { renewsAgreementId: "old-1" } })])[0]?.detail).toBeNull();
  });
});
