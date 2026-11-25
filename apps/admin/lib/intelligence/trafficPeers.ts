import { connectToDatabase, StoreCheck } from "@monocoupon/db";
import { categoryOf } from "./category";
import type { StoreCheckView } from "./types";

export interface TrafficPeer {
  id: string;
  name: string;
  domain: string;
  rank: number;
  changePct: number | null;
  current: boolean;
}

export interface TrafficPeers {
  /** 1 = most popular of your checked stores. */
  position: number;
  total: number;
  /** Up to 5 stores around this one, most popular first. */
  nearby: TrafficPeer[];
  category: { name: string; position: number; total: number } | null;
}

/** Where this store's popularity sits among the other (non-archived) stores you've checked. */
export async function getTrafficPeers(checkId: string): Promise<TrafficPeers | null> {
  await connectToDatabase();
  const docs = (await StoreCheck.find(
    { "identity.traffic.listed": true, archived: { $ne: true } },
    "name domain category identity.name identity.title identity.description identity.traffic.rank identity.traffic.changePct products.top.name",
  ).lean()) as unknown as Record<string, unknown>[];

  const all = docs
    .map((d) => {
      const identity = (d.identity ?? {}) as Record<string, unknown>;
      const traffic = (identity.traffic ?? {}) as { rank?: number; changePct?: number | null };
      const view = {
        category: (d.category as string | null) ?? null,
        name: (d.name as string | null) ?? (identity.name as string | null) ?? null,
        domain: d.domain as string,
        identity: identity as unknown as StoreCheckView["identity"],
        products: (d.products ?? null) as StoreCheckView["products"],
      };
      return {
        id: String(d._id),
        name: view.name ?? view.domain,
        domain: view.domain,
        rank: traffic.rank ?? Infinity,
        changePct: traffic.changePct ?? null,
        category: categoryOf(view),
      };
    })
    .filter((p) => Number.isFinite(p.rank))
    .sort((a, b) => a.rank - b.rank);

  const idx = all.findIndex((p) => p.id === checkId);
  if (idx < 0 || all.length < 2) return null;
  const start = Math.max(0, Math.min(idx - 2, all.length - 5));
  const me = all[idx]!;
  const sameCat = me.category ? all.filter((p) => p.category === me.category) : [];
  return {
    position: idx + 1,
    total: all.length,
    nearby: all.slice(start, start + 5).map((p) => ({ id: p.id, name: p.name, domain: p.domain, rank: p.rank, changePct: p.changePct, current: p.id === checkId })),
    category: me.category && sameCat.length > 1 ? { name: me.category, position: sameCat.findIndex((p) => p.id === checkId) + 1, total: sameCat.length } : null,
  };
}
