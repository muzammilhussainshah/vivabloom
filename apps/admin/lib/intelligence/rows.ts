import type { Verdict } from "./types";
import type { StoreCheckView } from "./types";
import { categoryOf } from "./category";
import { isAvoidStore } from "./sort";

/** The slim, serialisable slice of a report that the Store Checker list needs (so full reports never ship to the browser). */
export interface StoreRow {
  id: string;
  domain: string;
  name: string;
  logo: string | null;
  doneSteps: number;
  checkedAt: string | null;
  category: string | null;
  archived: boolean;
  avoid: boolean;
  trust: number | null;
  risk: number | null;
  verdict: Verdict | null;
  bottom: { title: string; detail: string; tone: "good" | "warn" | "bad" | "muted" } | null;
  commission: string | null;
  network: string | null;
  top: { name: string; price: number | null; currency: string | null } | null;
}

export function toRow(c: StoreCheckView, doneSteps: number): StoreRow {
  const b = c.score?.bottomLine;
  const top = c.products?.top[0];
  return {
    id: c.id,
    domain: c.domain,
    name: c.name ?? c.domain,
    logo: c.identity?.logo ?? null,
    doneSteps,
    checkedAt: c.lastCheckedAt,
    category: categoryOf(c),
    archived: c.archived,
    avoid: isAvoidStore(c),
    trust: c.score?.trust ?? null,
    risk: c.score?.risk ?? null,
    verdict: c.score?.verdict ?? null,
    bottom: b ? { title: b.title, detail: b.detail, tone: b.tone } : null,
    commission: c.program?.commission.value ?? null,
    network: c.program?.network.value ?? c.program?.detectedNetworks[0] ?? null,
    top: top ? { name: top.name, price: top.price ?? null, currency: top.currency ?? null } : null,
  };
}
