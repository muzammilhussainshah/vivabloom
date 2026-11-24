"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/client";
import { FoundStoresTable, type ShownStore } from "./FoundStoresTable";
import { selectClass } from "./ui";

/** The shortlist: stores you starred, with everything known about each, a private note, and one click to check them. */
export function ShortlistPanel({ stores }: { stores: ShownStore[] }) {
  const router = useRouter();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"added" | "lead">("added");

  const sorted = useMemo(() => (sort === "lead" ? [...stores].sort((a, b) => (b.lead?.score ?? 0) - (a.lead?.score ?? 0)) : stores), [stores, sort]);
  const unchecked = stores.filter((s) => !s.check).length;

  async function check(store: ShownStore) {
    if (store.check) {
      router.push(`/intelligence/${store.check.id}`);
      return;
    }
    setStarting(store.name);
    setError(null);
    try {
      const res = await fetch("/api/intelligence/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: store.domain ?? store.name, country: "us" }) });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Could not start the check");
      router.push(`/intelligence/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check");
      setStarting(null);
    }
  }

  if (stores.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
        <p className="text-base font-semibold text-text">Your shortlist is empty</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
          Tap the ☆ star on any store — in{" "}
          <Link href="/intelligence?tab=find" className="font-semibold text-brand-primary hover:underline">
            Find new stores
          </Link>{" "}
          or your checked stores — to keep the ones worth pursuing here, with a note for each.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          {stores.length} shortlisted · {unchecked} not checked yet
        </p>
        <div className="w-44">
          <Select value={sort} onChange={(e) => setSort(e.target.value as "added" | "lead")} aria-label="Sort shortlist" className={selectClass}>
            <option value="added">Recently added</option>
            <option value="lead">Best opportunity</option>
          </Select>
        </div>
      </div>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <FoundStoresTable stores={sorted} starting={starting} onCheck={(s) => void check(s)} withMemo />
    </div>
  );
}
