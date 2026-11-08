"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/data";

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Two-panel FAQ: a scrollable question list on the left (top on mobile, since
 * the panels are a flex-col that only goes side-by-side at md+) with the
 * selected question's answer shown in the panel beside/below it — rather
 * than each question expanding inline, like a settings sidebar.
 */
export function StoreFaq({ faqs }: { faqs: FaqItem[] }) {
  const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selected, setSelected] = useState(0);
  const active = sorted[selected];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface md:flex-row">
        <div
          className="flex flex-col divide-y divide-border overflow-y-auto md:max-h-[420px] md:w-2/5 md:border-r md:border-border
            [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-brand-primary/30"
        >
          {sorted.map((faq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-current={i === selected}
              className={`flex items-center gap-2 border-l-4 px-4 py-3.5 text-left text-sm transition-colors ${
                i === selected
                  ? "border-brand-primary bg-brand-primary/10 font-semibold text-brand-accent"
                  : "border-transparent text-text hover:bg-surface-muted"
              }`}
            >
              <ChevronIcon />
              {faq.question}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-6 md:w-3/5">
          <h3 className="text-lg font-bold text-brand-accent">{active.question}</h3>
          <p className="text-sm leading-relaxed text-text-muted">{active.answer}</p>
        </div>
      </div>
    </section>
  );
}
