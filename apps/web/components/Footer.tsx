"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "./Logo";

const EXPLORE_LINKS = [
  { href: "/blog", label: "Blog" },
  { href: "/categories", label: "Categories" },
  { href: "/deals", label: "Deals & Discounts" },
  { href: "/stores", label: "Stores" },
  { href: "/products", label: "Products" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
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

function NewsletterForm() {
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
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2 md:max-w-md">
      <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-1.5 transition-colors focus-within:border-white/35 sm:flex-row sm:items-center sm:rounded-full">
        <input
          name="email"
          type="email"
          required
          placeholder="Your email address"
          aria-label="Email address"
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none"
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
          className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-semibold text-footer-bg transition-colors hover:bg-white/90 disabled:opacity-60"
        >
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {error && <p className="px-2 text-sm text-red-300">{error}</p>}
      <p className="px-2 text-xs text-white/45">No spam. Unsubscribe anytime.</p>
    </form>
  );
}

/** Soft mint tint of the brand primary — legible on the dark footer. */
const MINT = "color-mix(in srgb, var(--brand-primary) 45%, #fff)";

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11.5a7 7 0 1 0-14 0C5 15.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ContactRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed text-white/70">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07]" style={{ color: MINT }}>
        {icon}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

function FooterHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{children}</h3>;
}

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <FooterHeading>{title}</FooterHeading>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-white/75 transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({
  contactEmail = "vivabloom2@gmail.com",
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
    <footer className="mt-12 bg-footer-bg text-white">
      {/* Newsletter band */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-md flex-col gap-1">
            <h2 className="font-serif text-xl font-semibold tracking-tight">Stay in the bloom</h2>
            <p className="text-sm leading-relaxed text-white/65">
              Fresh wellness guides and verified deals, delivered to your inbox. One email, no fluff.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-8 px-5 py-10 sm:px-8 lg:grid-cols-12">
        <div className="col-span-2 flex flex-col gap-4 lg:col-span-4 lg:pr-8">
          <Link href="/" className="w-fit">
            <Logo markColor={MINT} glyphColor="var(--footer-bg)" wordmarkColor="#fff" bloomColor={MINT} />
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-white/65">
            VivaBloom is built and run by AppMash Limited, a UK-based software solutions company — a
            blogging site sharing useful, well-researched content.
          </p>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  title={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  <Icon />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <LinkColumn title="Explore" links={EXPLORE_LINKS} />
        </div>
        <div className="lg:col-span-2">
          <LinkColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <div className="col-span-2 flex flex-col gap-3 lg:col-span-4">
          <FooterHeading>Get in touch</FooterHeading>
          <ul className="flex flex-col gap-3">
            <ContactRow icon={<MailIcon />}>
              <a href={`mailto:${email}`} className="break-all transition-colors hover:text-white">
                {email}
              </a>
            </ContactRow>
            {contact?.phone && (
              <ContactRow icon={<PhoneIcon />}>
                <a href={`tel:${contact.phone}`} className="transition-colors hover:text-white">
                  {contact.phone}
                </a>
              </ContactRow>
            )}
            {contact?.address && <ContactRow icon={<PinIcon />}>{contact.address}</ContactRow>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 text-xs text-white/50 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-0.5">
            <p>© {new Date().getFullYear()} VivaBloom, a trading name of AppMash Limited. All rights reserved.</p>
            <p>Registered office: Office 875, 55 Gracechurch Street, London, United Kingdom, EC3V 0HR.</p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
