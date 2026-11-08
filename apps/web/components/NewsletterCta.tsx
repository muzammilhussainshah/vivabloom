"use client";

import { useState, type FormEvent } from "react";

/** The large "Stay Updated with Latest Deals" band shown above the footer. */
export function NewsletterCta() {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          honeypot: formData.get("company"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-primary px-6 py-14 text-center text-white sm:px-10">
      <span className="relative inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">The Digest</span>
      <h2 className="relative mt-3 font-serif text-2xl font-bold sm:text-3xl">Stay Updated with Latest Deals</h2>
      <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-white/60" />
      <p className="relative mx-auto mt-4 max-w-xl text-white/90">
        Subscribe to our newsletter and never miss out on exclusive coupons, discounts, and special
        offers!
      </p>

      {status === "submitted" ? (
        <p className="mt-6 font-medium text-white">Thanks for subscribing — check your inbox!</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="Enter your email address"
            className="w-full rounded-full border border-white/30 bg-black/25 px-5 py-3 text-sm text-white placeholder:text-white/60 focus:outline-none sm:max-w-xs"
          />
          {/* Honeypot */}
          <input
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full shrink-0 rounded-full bg-footer-bg px-7 py-3 text-sm font-semibold text-white hover:bg-footer-bg/90 disabled:opacity-60 sm:w-auto"
          >
            {status === "submitting" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      )}

      {error ? (
        <p className="mt-3 text-sm text-white">{error}</p>
      ) : (
        status !== "submitted" && (
          <p className="mt-3 text-xs text-white/70">
            We respect your privacy. Unsubscribe at any time.
          </p>
        )
      )}
    </section>
  );
}
