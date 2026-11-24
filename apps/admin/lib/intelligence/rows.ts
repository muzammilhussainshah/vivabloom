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
  shortlisted: boolean;
  avoid: boolean;
  trust: number | null;
  risk: number | null;
  verdict: Verdict | null;
  bottom: { title: string; detail: string; tone: "good" | "warn" | "bad" | "muted" } | null;
  commission: string | null;
  network: string | null;
  /** Every network the store was found on (Impact, Social Snowball, …). */
  networks: string[];
  top: { name: string; price: number | null; currency: string | null } | null;
}

export function toRow(c: StoreCheckView, doneSteps: number, shortlisted = false): StoreRow {
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
    shortlisted,
    avoid: isAvoidStore(c),
    trust: c.score?.trust ?? null,
    risk: c.score?.risk ?? null,
    verdict: c.score?.verdict ?? null,
    bottom: b ? { title: b.title, detail: b.detail, tone: b.tone } : null,
    commission: c.program?.commission.value ?? null,
    network: allNetworks(c)[0] ?? null,
    networks: allNetworks(c),
    top: top ? { name: top.name, price: top.price ?? null, currency: top.currency ?? null } : null,
  };
}

/** All networks a store is on: the one the terms name first, then every other one detected. */
export function allNetworks(c: Pick<StoreCheckView, "program" | "linkSignals">): string[] {
  const list = [c.program?.network.value, ...(c.program?.detectedNetworks ?? []), ...(c.linkSignals?.networks.map((n) => n.network) ?? [])].filter((n): n is string => Boolean(n));
  return [...new Set(list)];
}
