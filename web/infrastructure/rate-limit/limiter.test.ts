import { describe, expect, test } from "vitest";
import { clientAddress, createRateLimiter } from "./limiter";

describe("createRateLimiter", () => {
  test("allows up to the limit, then refuses with the seconds left", () => {
    let time = 0;
    const check = createRateLimiter({ limit: 2, windowMs: 60_000 }, () => time);
    expect(check("a").allowed).toBe(true);
    expect(check("a").allowed).toBe(true);
    time = 15_000;
    expect(check("a")).toEqual({ allowed: false, retryAfterSeconds: 45 });
  });

  test("counts each client separately and opens a new window after the old one ends", () => {
    let time = 0;
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 }, () => time);
    expect(check("a").allowed).toBe(true);
    expect(check("b").allowed).toBe(true);
    expect(check("a").allowed).toBe(false);
    time = 1_000;
    expect(check("a").allowed).toBe(true);
  });
});

describe("clientAddress", () => {
  test("prefers x-real-ip, falls back to the first forwarded address, else null", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.4", "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientAddress(new Headers())).toBeNull();
  });
});
