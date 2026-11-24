/** One rule: at most `limit` requests per client in each `windowMs` window. */
export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
}

/** The answer for one request: allowed, or refused with the seconds until the client may try again. */
export type RateDecision = { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

/**
 * A fixed-window counter held in memory. Each server process keeps its own counts, so with several replicas the
 * real ceiling is `limit` times the replica count; the ingress (deploy/k8s/ingress.yaml) adds the cluster-wide limit.
 * Expired windows are swept so the map cannot grow without bound.
 */
export function createRateLimiter(rule: RateRule, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  const MAX_KEYS = 10_000;

  return function check(key: string): RateDecision {
    const time = now();
    if (windows.size > MAX_KEYS) {
      for (const [stale, entry] of windows) if (time - entry.start >= rule.windowMs) windows.delete(stale);
      if (windows.size > MAX_KEYS) windows.clear();
    }
    const entry = windows.get(key);
    if (!entry || time - entry.start >= rule.windowMs) {
      windows.set(key, { start: time, count: 1 });
      return { allowed: true };
    }
    entry.count += 1;
    if (entry.count <= rule.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.start + rule.windowMs - time) / 1000)) };
  };
}

/**
 * The client address behind a trusted proxy. `x-real-ip` comes first: the proxy (Railway's edge, ingress-nginx) sets it itself, while
 * the first `x-forwarded-for` entry can be written by the client and is only a fallback. Null when neither is set.
 */
export function clientAddress(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  return real || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
