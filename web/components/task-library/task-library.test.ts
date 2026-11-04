import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { MemberRole } from "@/application/ports";
import type { LibraryType } from "@/domain/task-library";
import { canEditTaskLibrary, type TaskLibraryFormState } from "./state";
import { TaskLibraryView } from "./task-library-view";

const RTU: LibraryType = {
  id: "t-r",
  code: "RTU",
  name: "Rooftop unit",
  defaultVisitMonths: [3, 6, 9, 12],
  tasks: [
    { description: "Inspect belts", visitMonths: null },
    { description: "Cooling start-up", visitMonths: [3, 4, 5] },
  ],
};
const BOILER: LibraryType = { id: "t-b", code: "BOILER", name: "Boiler", defaultVisitMonths: [10], tasks: [{ description: "Check flue", visitMonths: null }] };
const TYPES = [BOILER, RTU];

const action = async (): Promise<TaskLibraryFormState> => ({ status: "idle" });
const render = (role: MemberRole, selected: LibraryType | null = RTU, types: LibraryType[] = TYPES) =>
  renderToStaticMarkup(createElement(TaskLibraryView, { types, selected, role, action }));

const inOrder = (html: string, ...parts: string[]) => {
  const at = parts.map((part) => html.indexOf(part));
  expect(at.every((index) => index >= 0), parts.join(" | ")).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
};
const disabled = (tag: string) => /\sdisabled=""/.test(tag);
const inputs = (html: string, name: string) => [...html.matchAll(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "g"))].map((m) => m[0]);

describe("task library view", () => {
  test("C1408: every type is listed with its default months and links to its code", () => {
    const html = render("viewer");
    const links = [...html.matchAll(/<a [^>]*href="\/task-library\?type=([A-Z]+)"[^>]*>/g)].map((m) => m[1]);
    expect(links).toEqual(["BOILER", "RTU"]);
    expect(html).toContain("Rooftop unit");
    expect(html).toContain("Mar, Jun, Sep, Dec");
    expect(html).toContain("Boiler");
    expect(html).toContain("Oct");
  });

  test.each(["viewer", "owner"] as const)("C1409: as %s the selected type shows its tasks in order with All visits and Mar–May, and its entry is current", (role) => {
    const html = render(role);
    inOrder(html, "Inspect belts", "All visits", "Cooling start-up", "Mar–May");
    const current = /<a [^>]*href="\/task-library\?type=RTU"[^>]*>/.exec(html)?.[0] ?? "";
    expect(current).toContain('aria-current="page"');
    expect(/<a [^>]*href="\/task-library\?type=BOILER"[^>]*>/.exec(html)?.[0]).not.toContain("aria-current");
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", false],
    ["viewer", false],
  ] as const)("C1413: %s may edit: %s", (role, allowed) => {
    expect(canEditTaskLibrary(role)).toBe(allowed);
  });

  test.each(["estimator", "viewer"] as const)("C1413: the view for %s has no submit button and no editable field", (role) => {
    const html = render(role);
    expect(html).not.toContain('type="submit"');
    expect(html).not.toMatch(/<(input|textarea|select)\b/);
    expect(html).toContain("Inspect belts");
  });

  test("C1414: with no types the view shows the empty panel and no editor", () => {
    const html = render("owner", null, []);
    expect(html).toContain("No equipment types yet");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Save changes");
  });

  test("C1420: the editor's default months grid is named defaultVisitMonths with the type's months checked", () => {
    const html = render("owner");
    const boxes = inputs(html, "defaultVisitMonths");
    expect(boxes).toHaveLength(12);
    const checked = boxes.map((box, index) => (box.includes("checked") ? index + 1 : 0)).filter(Boolean);
    expect(checked).toEqual([3, 6, 9, 12]);
    expect(html).toContain("Default visit months");
  });

  test("C1428: the editor has a row per task with its controls, and Add task is disabled at 40 rows", () => {
    const html = render("owner");
    const descriptions = inputs(html, "taskDescription");
    expect(descriptions).toHaveLength(2);
    for (const input of descriptions) expect(input).toContain('maxLength="200"');
    expect(inputs(html, "taskMonths-0")).toHaveLength(12);
    expect(inputs(html, "taskMonths-1")).toHaveLength(12);
    expect(inputs(html, "taskMonths-1").filter((box) => box.includes("checked"))).toHaveLength(3);
    expect(inputs(html, "taskMonths-0").some((box) => box.includes("checked"))).toBe(false);

    const allVisits = [...html.matchAll(/<input[^>]*type="checkbox"[^>]*>(?=\s*All visits)/g)].map((m) => m[0]);
    expect(allVisits).toHaveLength(2);
    expect(allVisits[0]).toContain("checked");
    expect(allVisits[1]).not.toContain("checked");

    const button = (label: string, row: number) => new RegExp(`<button[^>]*aria-label="${label} task ${row}[^"]*"[^>]*>`).exec(html)?.[0] ?? "";
    expect(button("Move", 1)).not.toBe("");
    expect(disabled(button("Move", 1))).toBe(true);
    expect(disabled(button("Move", 2))).toBe(false);
    expect(html.match(/>Move up<\/button>/g)).toHaveLength(2);
    expect(html.match(/>Remove<\/button>/g)).toHaveLength(2);
    expect(disabled(/<button[^>]*>Add task<\/button>/.exec(html)?.[0] ?? "")).toBe(false);

    const forty: LibraryType = { ...RTU, tasks: Array.from({ length: 40 }, (_, index) => ({ description: `Task ${index}`, visitMonths: null })) };
    expect(disabled(/<button[^>]*>Add task<\/button>/.exec(render("owner", forty))?.[0] ?? "")).toBe(true);
    const lastMoveDown = /<button[^>]*aria-label="Move task 40 down"[^>]*>/.exec(render("owner", forty))?.[0] ?? "";
    expect(disabled(lastMoveDown)).toBe(true);
  });
});
