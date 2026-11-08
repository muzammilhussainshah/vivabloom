"use client";

import { useState } from "react";
import type { FaqItem } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * "How we check" steps + a single-open FAQ accordion. Always renders (unlike
 * ProofStrip/HonestyPanel) — the steps are generic and the FAQ reuses the
 * store's existing `faqs` (already authored per store from the pre-redesign
 * page, see Store.faqs), rather than requiring a fresh mechanic-specific
 * Q&A set on top of everything else this redesign already needs authored.
 */
export function HowWeCheckFaq({ faqs, dict }: { faqs: FaqItem[]; dict: Dictionary["howWeCheck"] }) {
  const steps = dict.steps.map((text, i) => ({ n: String(i + 1).padStart(2, "0"), text }));
  const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4);
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-10 md:grid md:grid-cols-2 md:gap-[44px] md:py-14">
      <div className="flex flex-col gap-6 rounded-[18px] bg-[var(--muted)] p-5 md:bg-transparent md:p-0">
        <h2 className="sv-subsection-heading font-store-serif" style={{ color: "var(--text)" }}>
          {dict.heading}
        </h2>
        <div className="flex flex-col gap-4">
          {steps.map((step) => (
            <div key={step.n} className="flex items-center gap-3">
              <span className="font-store-mono text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>
                {step.n}
              </span>
              <p className="text-[14.5px] font-semibold" style={{ color: "var(--text)" }}>
                {step.text}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
            {dict.howWeMakeMoneyHeading}
          </p>
          <p className="sv-body mt-1.5" style={{ color: "var(--muted-text)" }}>
            {dict.howWeMakeMoneyBody}
          </p>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="mt-6 flex flex-col gap-4 md:mt-0">
          <h2 className="sv-subsection-heading font-store-serif" style={{ color: "var(--text)" }}>
            {dict.questionsHeading}
          </h2>
          <div className="flex flex-col gap-2.5">
            {sorted.map((faq, i) => {
              const open = i === openIndex;
              return (
                <div key={faq.question} className="overflow-hidden rounded-[14px]" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? -1 : i)}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left"
                    style={{ touchAction: "manipulation" }}
                  >
                    <span className="text-[14.5px] font-bold" style={{ color: "var(--text)" }}>
                      {faq.question}
                    </span>
                    <span
                      className="shrink-0 text-lg transition-transform duration-[180ms] ease-in-out"
                      style={{ color: "var(--accent-ink)", transform: open ? "rotate(45deg)" : "none" }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="sv-body px-4 pb-4" style={{ color: "var(--muted-text)" }}>
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
