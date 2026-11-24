import type { StoreCheckView } from "./types";

export const CHECK_SORTS = [
  { key: "best", label: "Best first" },
  { key: "trust", label: "Highest trust" },
  { key: "recent", label: "Most recent" },
] as const;
export type CheckSortKey = (typeof CHECK_SORTS)[number]["key"];

const BOTTOM_RANK = { good: 0, warn: 1, muted: 2, bad: 3 } as const;
const VERDICT_RANK = { good: 0, caution: 1, insufficient: 2, risky: 3 } as const;

/**
 * "Best first": stores you can promote → ones to confirm → not enough data →
 * don't advertise; then the stronger store verdict, then trust score. Checks
 * still running go last.
 */
export function sortChecks(checks: StoreCheckView[], sort: CheckSortKey): StoreCheckView[] {
  const time = (c: StoreCheckView) => (c.lastCheckedAt ? new Date(c.lastCheckedAt).getTime() : 0);
  return [...checks].sort((a, b) => {
    if (sort === "recent") return time(b) - time(a);
    if (!a.score || !b.score) return Number(Boolean(b.score)) - Number(Boolean(a.score)) || time(b) - time(a);
    if (sort === "trust") return b.score.trust - a.score.trust || a.score.risk - b.score.risk;
    return (
      BOTTOM_RANK[a.score.bottomLine?.tone ?? "muted"] - BOTTOM_RANK[b.score.bottomLine?.tone ?? "muted"] ||
      VERDICT_RANK[a.score.verdict] - VERDICT_RANK[b.score.verdict] ||
      b.score.trust - a.score.trust ||
      a.score.risk - b.score.risk
    );
  });
}
