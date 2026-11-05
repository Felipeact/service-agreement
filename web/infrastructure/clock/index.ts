import type { Clock } from "@/application/ports";

export const systemClock: Clock = {
  now: () => new Date(),
};

/** For tests: always the same instant, as a fresh `Date` so callers cannot mutate it. */
export function fixedClock(at: Date): Clock {
  const time = at.getTime();
  return { now: () => new Date(time) };
}
