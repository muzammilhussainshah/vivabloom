"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "./Logo";

const QUICK_LINKS = [
  { href: "/blog", label: "Blogs" },
  { href: "/about", label: "About" },
  { href: "/categories", label: "Categories" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookie-policy", label: "Cookie Policy" },
];

export interface FooterSocialLinks {
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  discord?: string | null;
}

export interface FooterContact {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

function YoutubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.3 5.2 12 5.2 12 5.2s-7.3 0-8.9.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.7c1.6.4 8.9.4 8.9.4s7.3 0 8.9-.4a2.5 2.5 0 0 0 1.7-1.7C23 15.2 23 12 23 12Zm-13 3.1V8.9l5.3 3.1-5.3 3.1Z" />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.4 2 1.6 3.6 3.5 4v2.6c-1.3 0-2.6-.4-3.7-1.1v5.9a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.7a3 3 0 1 0 2.1 2.9V3h2.9Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.5 5.6A16.9 16.9 0 0 0 15.3 4l-.3.5c1.4.4 2.6 1 3.7 1.7a12.5 12.5 0 0 0-10.8 0c1-.7 2.3-1.3 3.7-1.7L11.3 4A16.9 16.9 0 0 0 7 5.6C4.3 9.6 3.6 13.5 4 17.3a16.6 16.6 0 0 0 5 2.5l.7-1.1c-.6-.2-1.2-.5-1.7-.9l.4-.3c3.3 1.5 6.9 1.5 10.2 0l.4.3c-.5.4-1.1.7-1.7.9l.7 1.1a16.6 16.6 0 0 0 5-2.5c.5-4.4-.6-8.3-3.3-11.7ZM9.8 15c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.7 1.7-1.5 1.7Zm4.4 0c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.5.8 1.5 1.7c0 1-.7 1.7-1.5 1.7Z" />
    </svg>
  );
}

function NewsletterForm({ compact = false }: { compact?: boolean }) {
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

  if (status === "submitted") {
    return <p className="text-sm text-emerald-300">Thanks for subscribing — check your inbox!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className={`flex gap-2 ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
        <input
          name="email"
          type="email"
          required
          placeholder="Enter your email"
          className="w-full rounded-base border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand-primary focus:outline-none"
        />
        {/* Honeypot: hidden from real users via CSS, bots that autofill every field trip this. */}
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
          className="shrink-0 rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm text-white/70">
      <span className="text-white/90">{label}:</span> {children}
    </p>
  );
}

export function Footer({
  contactEmail = "hello@monocoupon.com",
  socialLinks,
  contact,
}: {
  contactEmail?: string;
  socialLinks?: FooterSocialLinks;
  contact?: FooterContact;
}) {
  // Only keep socials that actually have a URL configured — a missing one is
  // hidden entirely rather than rendered as a dead "#" link that reloads the page.
  const socials = [
    { label: "Facebook", href: socialLinks?.facebook, Icon: FacebookIcon },
    { label: "Instagram", href: socialLinks?.instagram, Icon: InstagramIcon },
    { label: "YouTube", href: socialLinks?.youtube, Icon: YoutubeIcon },
    { label: "TikTok", href: socialLinks?.tiktok, Icon: TiktokIcon },
    { label: "Discord", href: socialLinks?.discord, Icon: DiscordIcon },
  ].filter((s): s is { label: string; href: string; Icon: typeof FacebookIcon } => Boolean(s.href));

  const email = contact?.email || contactEmail;

  return (
    <footer className="mt-10 bg-footer-bg text-white ">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <Logo markColor="var(--brand-primary)" glyphColor="#fff" wordmarkColor="#fff" />
          <p className="text-sm text-white/70">
            VivaBloom is built and run by Faliha Limited, a UK-based software solutions company — a
            blogging site sharing useful, well-researched content.
          </p>
          {socials.length > 0 && (
            <div className="flex gap-3">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  title={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 transition-colors hover:text-white"
                >
                  <Icon />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-white">Subscribe to our newsletter</h3>
            <NewsletterForm compact />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white">Contact</h3>
          {contact?.phone && (
            <ContactRow label="Phone">
              <a href={`tel:${contact.phone}`} className="hover:text-white">
                {contact.phone}
              </a>
            </ContactRow>
          )}
          <ContactRow label="Email">
            <a href={`mailto:${email}`} className="hover:text-white">
              {email}
            </a>
          </ContactRow>
          {contact?.address && <ContactRow label="Address">{contact.address}</ContactRow>}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white">Quick Links</h3>
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-white/70 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-white">Legal</h3>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-white/70 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/60 sm:px-8">
        <p>© {new Date().getFullYear()} VivaBloom, a trading name of Faliha Limited. All rights reserved.</p>
        <p className="mt-1">Registered office: Office 1877, 85 Dunstall Hill, Wolverhampton, United Kingdom, WV6 0SR.</p>
      </div>
    </footer>
  );
}
