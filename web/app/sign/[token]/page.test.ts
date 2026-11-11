import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ViewSigningResult } from "@/application/use-cases";

const viewSigning = vi.fn<(token: string) => Promise<ViewSigningResult>>();
const container = { viewSigning, logo: { url: (path: string | null) => path } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// The page only passes the result on; the form it would embed is not rendered here.
vi.mock("@docuseal/react", () => ({ DocusealForm: () => null }));

const { SigningForRequest } = await import("./page");

const TOKEN = "U-FVzrQONnE0OeSkuG3mDhLni8aAqblTz4-KLseYCj4";

beforeEach(() => {
  viewSigning.mockReset();
});

describe("the signing page route", () => {
  test("C1707: it renders the state viewSigning returns for the token", async () => {
    const result: ViewSigningResult = { state: "signed", tenant: null, agreementNumber: "AG-1052", signerName: "Pat Lee", embedSrc: null };
    viewSigning.mockResolvedValue(result);
    const element = (await SigningForRequest({ token: TOKEN })) as ReactElement<{ result: ViewSigningResult }>;
    expect(viewSigning).toHaveBeenCalledTimes(1);
    expect(viewSigning).toHaveBeenCalledWith(TOKEN);
    expect(element.props.result).toBe(result);
  });

  test("C1707: an unknown link is notFound()", async () => {
    viewSigning.mockResolvedValue(null);
    await expect(SigningForRequest({ token: TOKEN })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("C1707: the unavailable state is rendered, not a 404", async () => {
    viewSigning.mockResolvedValue({ state: "unavailable" });
    const element = (await SigningForRequest({ token: TOKEN })) as ReactElement<{ result: ViewSigningResult }>;
    expect(element.props.result).toEqual({ state: "unavailable" });
  });
});
