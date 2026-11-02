import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pipelineBoard = vi.fn();
const pipelineExpiring = vi.fn();
// 2027-12-02 03:00 UTC is still Dec 1 in Vancouver.
const container = { pipelineBoard, pipelineExpiring, clock: { now: () => new Date("2027-12-02T03:00:00Z") } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/pipeline" }));

const { PipelineForRequest } = await import("./pipeline/page");

const render = async (view: string | undefined) => renderToStaticMarkup((await PipelineForRequest({ view })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  pipelineBoard.mockResolvedValue([]);
  pipelineExpiring.mockResolvedValue([]);
});

describe("/pipeline views", () => {
  test("C1214: view=expiring reads expiring for the business day and shows Expiring soon", async () => {
    const out = await render("expiring");
    expect(pipelineExpiring).toHaveBeenCalledWith("2027-12-01");
    expect(pipelineBoard).not.toHaveBeenCalled();
    expect(out).toContain("Expiring soon");
    expect(out).toContain("No agreements end in the next 90 days.");
  });

  test.each([undefined, "other"])("C1214: view=%s reads the board and shows it", async (view) => {
    const out = await render(view);
    expect(pipelineBoard).toHaveBeenCalledTimes(1);
    expect(pipelineExpiring).not.toHaveBeenCalled();
    expect(out).toContain("No agreements yet");
  });
});
