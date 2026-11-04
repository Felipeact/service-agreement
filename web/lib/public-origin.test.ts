import { describe, expect, test } from "vitest";
import { publicOrigin } from "./public-origin";

const url = new URL("http://localhost:8080/auth/confirm?token_hash=abc");
const headers = (entries: Record<string, string> = {}) => new Headers(entries);

describe("publicOrigin", () => {
  test("APP_BASE_URL wins and loses any path or trailing slash", () => {
    const forwarded = headers({ "x-forwarded-host": "other.example.com" });
    expect(publicOrigin(url, forwarded, " https://app.example.com/ ")).toBe("https://app.example.com");
  });

  test("a forwarded host and protocol come next", () => {
    const forwarded = headers({ "x-forwarded-host": "web.up.railway.app", "x-forwarded-proto": "https" });
    expect(publicOrigin(url, forwarded, "")).toBe("https://web.up.railway.app");
  });

  test("a forwarded host without a protocol is https, except for localhost", () => {
    expect(publicOrigin(url, headers({ "x-forwarded-host": "web.up.railway.app" }))).toBe("https://web.up.railway.app");
    expect(publicOrigin(url, headers({ "x-forwarded-host": "localhost:3000" }))).toBe("http://localhost:3000");
  });

  test("only the first value of a forwarded list counts", () => {
    const forwarded = headers({ "x-forwarded-host": "web.up.railway.app, proxy.internal", "x-forwarded-proto": "https, http" });
    expect(publicOrigin(url, forwarded)).toBe("https://web.up.railway.app");
  });

  test("with no configuration and no forwarding, the request origin is kept (next dev)", () => {
    expect(publicOrigin(new URL("http://localhost:3000/x"), headers())).toBe("http://localhost:3000");
  });
});
