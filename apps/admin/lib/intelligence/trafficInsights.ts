import type { TrafficResult } from "./types";

/**
 * Plain-language reading of a store's popularity-rank history (Tranco). All
 * numbers come from the saved daily ranks — nothing extra is fetched. A LOWER
 * rank number is more popular, so "up" means the rank number fell.
 */

export type TrafficTone = "good" | "warn" | "bad" | "info" | "muted";

export interface TrafficInsights {
  /** Positive = more popular than 7 days ago. */
  change7Pct: number | null;
  average: number;
  /** Average day-to-day move, in percent. */
  dailyMovePct: number;
  stability: { label: "Stable" | "Moving" | "Volatile"; tone: TrafficTone };
  /** Consecutive days (up to today) moving the same way. */
  streak: { direction: "up" | "down" | "flat"; days: number };
  /** Share of the top-1M list this site beats, e.g. 86 = more popular than 86% of ranked sites. */
  beatsPct: number;
  bestDay: { date: string; rank: number };
  worstDay: { date: string; rank: number };
  verdict: { tone: TrafficTone; headline: string; detail: string };
}

const pct = (from: number, to: number) => Math.round(((from - to) / from) * 1000) / 10;

export function trafficInsights(t: TrafficResult): TrafficInsights | null {
  const h = t.history;
  if (!t.listed || h.length < 2 || t.rank == null) return null;
  const last = h[h.length - 1]!;
  const weekAgo = h.length > 7 ? h[h.length - 8]! : null;
  const change7Pct = weekAgo ? pct(weekAgo.rank, last.rank) : null;
  const average = Math.round(h.reduce((n, x) => n + x.rank, 0) / h.length);

  const moves: number[] = [];
  for (let i = 1; i < h.length; i++) moves.push(Math.abs(pct(h[i - 1]!.rank, h[i]!.rank)));
  const dailyMovePct = Math.round((moves.reduce((a, b) => a + b, 0) / moves.length) * 10) / 10;
  const stability: TrafficInsights["stability"] =
    dailyMovePct < 1.5 ? { label: "Stable", tone: "good" } : dailyMovePct < 4 ? { label: "Moving", tone: "info" } : { label: "Volatile", tone: "warn" };

  // Streak: walk back from today while the rank keeps moving the same way (equal days don't break it).
  let direction: "up" | "down" | "flat" = "flat";
  let days = 0;
  for (let i = h.length - 1; i > 0; i--) {
    const d = h[i]!.rank < h[i - 1]!.rank ? "up" : h[i]!.rank > h[i - 1]!.rank ? "down" : "flat";
    if (d === "flat") {
      if (direction !== "flat") days++;
      continue;
    }
    if (direction === "flat") direction = d;
    if (d !== direction) break;
    days++;
  }

  let bestDay = h[0]!;
  let worstDay = h[0]!;
  for (const x of h) {
    if (x.rank < bestDay.rank) bestDay = x;
    if (x.rank > worstDay.rank) worstDay = x;
  }

  return {
    change7Pct,
    average,
    dailyMovePct,
    stability,
    streak: { direction, days },
    beatsPct: Math.max(0, Math.min(99.9, Math.round((1 - t.rank / 1_000_000) * 1000) / 10)),
    bestDay,
    worstDay,
    verdict: verdictFor(t, change7Pct),
  };
}

function verdictFor(t: TrafficResult, change7Pct: number | null): TrafficInsights["verdict"] {
  const c = t.changePct ?? 0;
  const size =
    t.tier === "very_high" || t.tier === "high"
      ? "It's a well-known site, so there are plenty of brand searches — but expect more coupon sites bidding on the same keywords."
      : t.tier === "medium"
        ? "It's a mid-sized site: enough brand searches for small, focused campaigns."
        : "It's a smaller site, so brand + coupon searches will be low — keep budgets small.";
  const recent = change7Pct == null ? "" : change7Pct > 2 && c < 0 ? " The last 7 days are recovering, though." : change7Pct < -2 && c > 0 ? " The last 7 days are slipping, though." : "";
  if (c >= 10) return { tone: "good", headline: "Growing fast", detail: `More people are visiting than a month ago. Coupon searches usually rise with brand interest — a good time to start ads. ${size}${recent}` };
  if (c >= 3) return { tone: "good", headline: "Growing", detail: `Popularity is rising steadily, so brand searches should hold up or grow. ${size}${recent}` };
  if (c > -3) return { tone: "info", headline: "Steady", detail: `Popularity is flat, so search volume and costs should be predictable. ${size}${recent}` };
  if (c > -10) return { tone: "warn", headline: "Slipping", detail: `Popularity is drifting down. Brand + coupon searches may shrink a little — watch impressions after launch. ${size}${recent}` };
  return { tone: "bad", headline: "Falling fast", detail: `Far fewer people are visiting than a month ago, so brand + coupon searches will likely shrink. Check search volume and CPC before spending. ${size}${recent}` };
}
