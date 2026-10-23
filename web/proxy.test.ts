import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/infrastructure/supabase/session", () => ({ updateSession: vi.fn() }));

const { config, proxy } = await import("./proxy");

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe("proxy matcher", () => {
  test.each([
    "/_next/static/chunks/a.js",
    "/_next/image?url=x",
    "/favicon.ico",
    "/logo.svg",
    "/a.png",
    "/a.jpg",
    "/a.jpeg",
    "/a.gif",
    "/a.webp",
    "/a.ico",
  ])("C15: does not run for %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  test.each(["/pipeline", "/login", "/auth/confirm"])("C15: runs for %s", (url) => {
    expect(matches(url)).toBe(true);
  });

  test("C15: proxy is the exported handler", () => {
    expect(typeof proxy).toBe("function");
  });
});
