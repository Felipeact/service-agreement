import { describe, expect, test } from "vitest";
import { itemWords } from "./index";
import { groupSetupCatalog, setupEntry, setupGate, validateSetupProfile, type SetupProfileInput } from "./setup";

describe("setup gate", () => {
  test("C2800: an owner and an admin of a pending org are sent to setup", () => {
    expect(setupGate("owner", true)).toBe("setup");
    expect(setupGate("admin", true)).toBe("setup");
  });

  test("C2801: an estimator and a viewer of a pending org proceed", () => {
    expect(setupGate("estimator", true)).toBe("proceed");
    expect(setupGate("viewer", true)).toBe("proceed");
  });

  test("C2802: every role proceeds when setup is not pending", () => {
    for (const role of ["owner", "admin", "estimator", "viewer"] as const) expect(setupGate(role, false)).toBe("proceed");
  });
});

describe("setup entry", () => {
  test("C2806: an owner or admin of an org whose setup is done goes to /pipeline", () => {
    expect(setupEntry({ status: "member", role: "owner" }, false)).toEqual({ to: "/pipeline" });
    expect(setupEntry({ status: "member", role: "admin" }, false)).toEqual({ to: "/pipeline" });
  });

  test("C2807: estimator, viewer and no membership go to /pipeline; signed out goes to /login", () => {
    expect(setupEntry({ status: "member", role: "estimator" }, true)).toEqual({ to: "/pipeline" });
    expect(setupEntry({ status: "member", role: "viewer" }, true)).toEqual({ to: "/pipeline" });
    expect(setupEntry({ status: "no_membership" }, true)).toEqual({ to: "/pipeline" });
    expect(setupEntry({ status: "signed_out" }, true)).toEqual({ to: "/login" });
  });

  test("C2808: an owner or admin of a pending org sees the screen", () => {
    expect(setupEntry({ status: "member", role: "owner" }, true)).toEqual({ to: "render" });
    expect(setupEntry({ status: "member", role: "admin" }, true)).toEqual({ to: "render" });
  });
});

const VALID: SetupProfileInput = {
  legalName: "Flow Plumbing Ltd.",
  address: "",
  phone: "604-555-0123",
  accentColor: "#1F6F8B",
  governingProvince: "BC",
  itemSingular: "fixture",
  itemPlural: "fixtures",
};

describe("setup profile validation", () => {
  test("C2810: a valid form is accepted with empty optional fields stored as null and the colour lowercased", () => {
    expect(validateSetupProfile({ ...VALID })).toEqual({
      ok: true,
      value: {
        legalName: "Flow Plumbing Ltd.",
        address: null,
        phone: "604-555-0123",
        accentColor: "#1f6f8b",
        governingProvince: "BC",
        itemSingular: "fixture",
        itemPlural: "fixtures",
      },
    });
  });

  test("C2810: every invalid case reports its field, and several together", () => {
    const cases: [Partial<SetupProfileInput>, keyof SetupProfileInput][] = [
      [{ legalName: "" }, "legalName"],
      [{ legalName: "x".repeat(121) }, "legalName"],
      [{ accentColor: "blue" }, "accentColor"],
      [{ itemSingular: "Fixtures!" }, "itemSingular"],
      [{ governingProvince: "" }, "governingProvince"],
      [{ governingProvince: "ZZ" }, "governingProvince"],
    ];
    expect(cases).toHaveLength(6);
    for (const [change, field] of cases) {
      const result = validateSetupProfile({ ...VALID, ...change });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors)).toEqual([field]);
    }
    const together = validateSetupProfile({ ...VALID, legalName: "", accentColor: "blue", governingProvince: "" });
    expect(together.ok).toBe(false);
    if (!together.ok) expect(Object.keys(together.errors).sort()).toEqual(["accentColor", "governingProvince", "legalName"]);
  });
});

describe("setup catalog review", () => {
  const equipment = itemWords("equipment", "equipment");

  test("C2815: groups by pack in the order hvac, plumbing, electrical, then types of no pack, with counts in the org's words", () => {
    const types = [
      { pack: null, name: "Ice machine" },
      { pack: "electrical", name: "Panel" },
      { pack: "plumbing", name: "Backflow preventer" },
      { pack: "plumbing", name: "Water heater" },
      { pack: "hvac", name: "Boiler" },
    ];
    const groups = groupSetupCatalog(types, equipment);
    expect(groups.map((g) => [g.pack, g.label, g.countText, g.names])).toEqual([
      ["hvac", "Heating and cooling", "1 equipment type", ["Boiler"]],
      ["plumbing", "Plumbing", "2 equipment types", ["Backflow preventer", "Water heater"]],
      ["electrical", "Electrical", "1 equipment type", ["Panel"]],
      [null, "Added by you", "1 equipment type", ["Ice machine"]],
    ]);
  });

  test("C2815: the count uses the org's own word for the item", () => {
    const [group] = groupSetupCatalog([{ pack: "plumbing", name: "Sink" }, { pack: "plumbing", name: "Tap" }], itemWords("fixture", "fixtures"));
    expect(group.countText).toBe("2 fixture types");
  });

  test("C2815: no types gives no groups", () => {
    expect(groupSetupCatalog([], equipment)).toEqual([]);
  });
});

describe("a drafted catalog in the review", () => {
  test("C4122: types with no pack sit under Added by you with their count in the org's words", () => {
    const words = itemWords("equipment", "equipment");
    const groups = groupSetupCatalog([{ pack: null, name: "Rodent stations" }, { pack: null, name: "Gutters" }], words);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ pack: null, label: "Added by you", count: 2, names: ["Rodent stations", "Gutters"] });
    expect(groups[0].countText).toBe("2 equipment types");
  });
});
