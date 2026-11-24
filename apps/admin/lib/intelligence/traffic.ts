import { safeFetch } from "./safeFetch";
import type { TrafficResult } from "./types";

/**
 * Website popularity from Tranco (tranco-list.eu): a free, research-grade
 * ranking of the top 1 million domains that combines several traffic panels.
 * It gives a daily RANK history — not visit counts (those need a paid source) —
 * so the UI labels it as a popularity rank. The API rate-limits quickly, so
 * the result is saved on the report and fetched once.
 */

export function trafficTier(rank: number | null): TrafficResult["tier"] {
  if (rank == null) return "unranked";
  if (rank <= 10_000) return "very_high";
  if (rank <= 100_000) return "high";
  if (rank <= 500_000) return "medium";
  return "low";
}

export async function fetchTraffic(domain: string): Promise<TrafficResult | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await safeFetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
      checkRobots: false,
      timeoutMs: 10_000,
      maxBytes: 200_000,
      accept: "application/json",
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      continue;
    }
    const checkedAt = new Date().toISOString();
    if (res.status === 404) return { source: "tranco", checkedAt, listed: false, rank: null, history: [], changePct: null, best: null, worst: null, tier: "unranked" };
    if (!res.ok) return null;
    try {
      const data = JSON.parse(res.text) as { ranks?: { date?: string; rank?: number }[] };
      const history = (data.ranks ?? [])
        .filter((r): r is { date: string; rank: number } => typeof r.date === "string" && typeof r.rank === "number")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);
      if (history.length === 0) return { source: "tranco", checkedAt, listed: false, rank: null, history: [], changePct: null, best: null, worst: null, tier: "unranked" };
      const ranks = history.map((h) => h.rank);
      const first = history[0]!.rank;
      const latest = history[history.length - 1]!.rank;
      return {
        source: "tranco",
        checkedAt,
        listed: true,
        rank: latest,
        history,
        // Positive = the rank number got smaller = the site got MORE popular.
        changePct: history.length > 1 ? Math.round(((first - latest) / first) * 1000) / 10 : null,
        best: Math.min(...ranks),
        worst: Math.max(...ranks),
        tier: trafficTier(latest),
      };
    } catch {
      return null;
    }
  }
  return null;
}
