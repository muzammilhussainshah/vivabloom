"use client";

import { useRef, useState, type FormEvent } from "react";
import Script from "next/script";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const formData = new FormData(e.currentTarget);
    const turnstileToken = turnstileRef.current?.querySelector<HTMLInputElement>(
      'input[name="cf-turnstile-response"]'
    )?.value;

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone") || null,
          message: formData.get("message"),
          turnstileToken,
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

  if (status === "submitted") {
    return (
      <p className="rounded-xl border border-brand-primary/20 bg-brand-primary/10 p-4 text-sm font-medium text-brand-primary">
        Thanks for reaching out — we&apos;ll get back to you soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-shadow placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-shadow placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Phone <span className="text-text-muted">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-shadow placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition-shadow placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/15"
        />
      </div>
      {TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
          <div ref={turnstileRef} className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} />
        </>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="self-start rounded-full bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Submit"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
