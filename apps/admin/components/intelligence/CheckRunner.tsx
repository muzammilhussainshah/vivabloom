"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreCheckStep } from "@monocoupon/validation";
import { Spinner } from "@/components/ui/client";
import type { StepState } from "@/lib/intelligence/types";

const STEPS: { key: StoreCheckStep; label: string; detail: string }[] = [
  { key: "identity", label: "Store identity", detail: "Website, domain age, contact & policies" },
  { key: "program", label: "Affiliate program & ad rules", detail: "Commission, payouts, Google Ads rules" },
  { key: "reputation", label: "Reputation", detail: "Affiliate payment reports & reviews" },
  { key: "products", label: "Best products", detail: "Catalogue, ratings, ranking" },
];

/** A step stuck in "running" this long (e.g. the tab was closed mid-step) is treated as pending again. */
const STALE_MS = 2 * 60 * 1000;

function needsRun(s: StepState | undefined): boolean {
  if (!s || s.status === "pending") return true;
  if (s.status === "running") return !s.updatedAt || Date.now() - new Date(s.updatedAt).getTime() > STALE_MS;
  return false;
}

/**
 * Runs the outstanding research steps one after another (each is its own
 * short request), showing live progress, and refreshes the report after
 * every step so results appear as soon as they're ready.
 */
export function CheckRunner({ checkId, steps }: { checkId: string; steps: Record<StoreCheckStep, StepState> }) {
  const router = useRouter();
  const [state, setState] = useState(steps);
  const [running, setRunning] = useState<StoreCheckStep | null>(null);
  const started = useRef(false);

  const runStep = useCallback(
    async (step: StoreCheckStep) => {
      setRunning(step);
      setState((s) => ({ ...s, [step]: { status: "running", error: null, updatedAt: new Date().toISOString() } }));
      try {
        const res = await fetch(`/api/intelligence/check/${checkId}/${step}`, { method: "POST" });
        const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string | null };
        const ok = res.ok && json.status === "done";
        setState((s) => ({ ...s, [step]: { status: ok ? "done" : "failed", error: ok ? null : (json.error ?? `Request failed (${res.status})`), updatedAt: new Date().toISOString() } }));
      } catch {
        setState((s) => ({ ...s, [step]: { status: "failed", error: "Network error — check your connection.", updatedAt: new Date().toISOString() } }));
      } finally {
        setRunning(null);
        router.refresh();
      }
    },
    [checkId, router]
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      for (const { key } of STEPS) {
        if (needsRun(steps[key])) await runStep(key);
      }
    })();
  }, [runStep, steps]);

  const done = STEPS.filter((s) => state[s.key]?.status === "done").length;
  const failed = STEPS.filter((s) => state[s.key]?.status === "failed");
  if (done === STEPS.length && !running) return null;

  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-gradient-to-br from-brand-primary/[0.06] to-white p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text">{running ? "Researching this store…" : failed.length ? "Some steps need a retry" : "Preparing…"}</p>
          <p className="text-xs text-text-muted">Results appear below as each step finishes. Usually under a minute.</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-brand-primary">
          {done}/{STEPS.length}
        </span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => {
          const st = state[s.key]?.status ?? "pending";
          const isRunning = running === s.key;
          return (
            <li
              key={s.key}
              className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
                st === "failed" ? "border-red-200" : isRunning ? "border-brand-primary/40 shadow-sm" : "border-border"
              }`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                {isRunning ? (
                  <Spinner className="h-5 w-5 text-brand-primary" />
                ) : st === "done" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">✓</span>
                ) : st === "failed" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">!</span>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-border" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{s.label}</p>
                <p className="text-xs text-text-muted">{s.detail}</p>
                {st === "failed" && (
                  <>
                    <p className="mt-1 line-clamp-3 text-xs text-red-600">{state[s.key]?.error}</p>
                    <button
                      type="button"
                      disabled={Boolean(running)}
                      onClick={() => void runStep(s.key)}
                      className="mt-1.5 text-xs font-semibold text-brand-primary hover:underline disabled:opacity-50"
                    >
                      Retry this step
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
