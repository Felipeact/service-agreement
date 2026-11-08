import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { MemberRole } from "@/application/ports";
import type { LibraryType } from "@/domain/task-library";
import { TaskLibraryView } from "./task-library-view";
import type { TypeActions } from "./state";
import { RemoveTypePrompt } from "./type-controls";

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");
const noop = async () => ({ status: "idle" as const });
const actions: TypeActions = { create: noop, rename: noop, remove: noop, reset: noop };

const seeded: LibraryType = { id: "t-r", code: "RTU", name: "Rooftop unit", pack: "hvac", defaultVisitMonths: [3, 6, 9, 12], tasks: [] };
const handMade: LibraryType = { id: "t-s", code: "SUMP_PUMP", name: "Sump pump", pack: null, defaultVisitMonths: [3, 6, 9, 12], tasks: [] };

const view = (role: MemberRole, selected: LibraryType | null, types: LibraryType[] = [seeded, handMade]) =>
  html(createElement(TaskLibraryView, { types, selected, role, action: async (state) => state, typeActions: actions }));
const buttons = (out: string) => (out.match(/<button[^>]*>[^<]*<\/button>/g) ?? []).map((button) => button.replace(/<[^>]*>/g, ""));

describe("remove confirmation", () => {
  const prompt = (confirming: boolean) =>
    html(createElement(RemoveTypePrompt, { name: "Sump pump", typeCode: "SUMP_PUMP", confirming, pending: false, state: { status: "idle" } }));

  test("C1914: before confirming there is one Remove type button and no form to send", () => {
    const out = prompt(false);
    expect(buttons(out)).toEqual(["Remove type"]);
    expect(out).not.toContain("<form");
    expect(out).not.toContain("Remove Sump pump");
  });

  test("C1914: confirming names the type and offers Remove and Cancel", () => {
    const out = prompt(true);
    expect(out).toContain("Remove Sump pump and its checklist?");
    expect(buttons(out)).toEqual(["Remove", "Cancel"]);
    expect(out).toContain('name="typeCode" value="SUMP_PUMP"');
  });
});

describe("Reset", () => {
  test("C1929: a type with a pack shows Reset to its pack, and one made by hand shows none", () => {
    expect(buttons(view("owner", seeded))).toContain("Reset to hvac pack");
    expect(buttons(view("owner", handMade)).join("|")).not.toContain("Reset");
  });
});

describe("who sees the controls", () => {
  const CONTROLS = ["Add type", "Rename", "Remove type", "Reset to hvac pack"];

  test.each(["owner", "admin"] as const)("C1931: %s sees Add, Rename, Remove, Reset and Save", (role) => {
    const labels = buttons(view(role, seeded));
    for (const label of [...CONTROLS, "Save changes"]) expect(labels, label).toContain(label);
  });

  test.each(["estimator", "viewer"] as const)("C1931: %s sees none of the five controls", (role) => {
    const out = view(role, seeded);
    const labels = buttons(out).join("|");
    for (const label of [...CONTROLS, "Save"]) expect(labels, label).not.toContain(label);
    expect(out).not.toContain("<form");
  });
});

describe("empty library", () => {
  test("C1932: an owner sees the empty panel and the Add form", () => {
    const out = view("owner", null, []);
    expect(out).toContain("No equipment types yet");
    expect(buttons(out)).toEqual(["Add type"]);
  });

  test("C1932: an estimator sees the empty panel and no form", () => {
    const out = view("estimator", null, []);
    expect(out).toContain("No equipment types yet");
    expect(out).not.toContain("<form");
  });
});
