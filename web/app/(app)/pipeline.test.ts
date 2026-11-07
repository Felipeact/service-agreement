import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pipelineBoard = vi.fn();
const pipelineExpiring = vi.fn();
const listImportHistory = vi.fn();
// 2027-12-02 03:00 UTC is still Dec 1 in Vancouver.
const container = { pipelineBoard, pipelineExpiring, listImportHistory, clock: { now: () => new Date("2027-12-02T03:00:00Z") } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/pipeline" }));

const { PipelineForRequest } = await import("./pipeline/page");

const render = async (view: string | undefined) => renderToStaticMarkup((await PipelineForRequest({ view })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  pipelineBoard.mockResolvedValue([]);
  pipelineExpiring.mockResolvedValue([]);
  listImportHistory.mockResolvedValue([]);
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
    // The board carries Expiring soon as its sixth column, so it reads the same list the full view does.
    expect(pipelineExpiring).toHaveBeenCalledWith("2027-12-01");
    expect(out).toContain("No agreements yet");
  });

  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
    [undefined, false],
  ] as const)("C1359: for role %s the board gets the New agreement dialog: %s", async (role, shown) => {
    const board = (await PipelineForRequest({ view: undefined, role })) as ReactElement<{ canCreate: boolean; newAgreement?: unknown }>;
    expect(board.props.canCreate).toBe(shown);
    expect(board.props.newAgreement !== undefined).toBe(shown);
  });

  test("the board also gets the newest imports, and opens filtered when the bell's link asked for follow-ups", async () => {
    const job = { id: "j1", originalName: "units.xlsx" };
    listImportHistory.mockResolvedValue([job]);
    const board = (await PipelineForRequest({ view: undefined, followUps: true })) as ReactElement<{ imports: unknown[]; initialFollowUpOnly: boolean }>;
    expect(listImportHistory).toHaveBeenCalledWith({});
    expect(board.props.imports).toEqual([job]);
    expect(board.props.initialFollowUpOnly).toBe(true);
    const plain = (await PipelineForRequest({ view: undefined })) as ReactElement<{ initialFollowUpOnly: boolean }>;
    expect(plain.props.initialFollowUpOnly).toBe(false);
  });

  test("the board's title is a greeting by the member's name, or plain when the email has none", async () => {
    const named = (await PipelineForRequest({ view: undefined, email: "jamie.walsh@x.com" })) as ReactElement<{ title: string }>;
    // The container's clock is 20:00 in Vancouver.
    expect(named.props.title).toBe("Good evening, Jamie");
    const plain = (await PipelineForRequest({ view: undefined, email: "felipetiburcioviana@gmail.com" })) as ReactElement<{ title: string }>;
    expect(plain.props.title).toBe("Good evening");
  });
});
