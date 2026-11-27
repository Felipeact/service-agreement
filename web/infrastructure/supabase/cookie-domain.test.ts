import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { authCookieOptions, migrateSessionCookies } from "./cookie-domain";

const requestWith = (cookies: Record<string, string>, url = "https://servicepacts.com/pipeline") =>
  new NextRequest(url, { headers: { cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ") } });

afterEach(() => vi.unstubAllEnvs());

describe("the shared sign-in cookie", () => {
  test("a domain is used only when configured", () => {
    expect(authCookieOptions()).toEqual({});
    vi.stubEnv("AUTH_COOKIE_DOMAIN", " .servicepacts.com ");
    expect(authCookieOptions()).toEqual({ cookieOptions: { domain: ".servicepacts.com" } });
  });

  test("with no domain configured nothing moves", () => {
    const response = NextResponse.next();
    expect(migrateSessionCookies(requestWith({ "sb-ref-auth-token": "a" }), response)).toEqual([]);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("an existing sign-in is re-issued on the parent domain once, and the old host-only copy is expired", () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".servicepacts.com");
    const response = NextResponse.next();
    const expired = migrateSessionCookies(requestWith({ "sb-ref-auth-token.0": "a", "sb-ref-auth-token.1": "b", other: "x" }), response);
    const lines = response.headers.getSetCookie();
    expect(lines.filter((line) => line.includes("Domain=.servicepacts.com") && line.startsWith("sb-ref-auth-token.")).length).toBe(2);
    expect(lines.some((line) => line.startsWith("sp-sso=1") && line.includes("Domain=.servicepacts.com"))).toBe(true);
    expect(lines.filter((line) => /^sb-ref-auth-token\.\d=; Max-Age=0; Path=\/; Secure$/.test(line))).toHaveLength(2);
    expect(expired).toHaveLength(2);
    expect(lines.some((line) => line.startsWith("other="))).toBe(false);
  });

  test("once marked, a request moves nothing", () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".servicepacts.com");
    const response = NextResponse.next();
    expect(migrateSessionCookies(requestWith({ "sb-ref-auth-token": "a", "sp-sso": "1" }), response)).toEqual([]);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  test("a cookie the refresh already set in this response is left alone, and a signed-out request moves nothing", () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".servicepacts.com");
    const response = NextResponse.next();
    response.cookies.set("sb-ref-auth-token", "fresh", { domain: ".servicepacts.com" });
    expect(migrateSessionCookies(requestWith({ "sb-ref-auth-token": "old" }), response)).toEqual([]);
    expect(response.cookies.get("sb-ref-auth-token")?.value).toBe("fresh");
    expect(migrateSessionCookies(requestWith({ other: "x" }), NextResponse.next())).toEqual([]);
  });

  test("on plain http (localhost) the cookies are not marked Secure", () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".localhost");
    const response = NextResponse.next();
    migrateSessionCookies(requestWith({ "sb-ref-auth-token": "a" }, "http://localhost:3000/"), response);
    expect(response.headers.getSetCookie().every((line) => !line.includes("Secure"))).toBe(true);
  });
});
