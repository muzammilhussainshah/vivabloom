import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContactForm } from "./ContactForm";
import { getCachedSiteSettings } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { resolveSiteName } from "@/lib/brand";

export const metadata: Metadata = { title: "Contact Us", alternates: { canonical: "/contact" } };

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
        <span className="text-sm leading-relaxed text-text">{children}</span>
      </div>
    </li>
  );
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export default async function ContactPage() {
  const settings = await getCachedSiteSettings();
  const contactEmail = settings.contact.email || "vivabloom2@gmail.com";
  const socials = [
    { label: "Facebook", href: settings.socialLinks.facebook },
    { label: "Instagram", href: settings.socialLinks.instagram },
    { label: "YouTube", href: settings.socialLinks.youtube },
    { label: "TikTok", href: settings.socialLinks.tiktok },
    { label: "Discord", href: settings.socialLinks.discord },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <PageHeader
        eyebrow="Get in touch"
        title="Contact Us"
        description="Have a question, found an expired code, or want to suggest a store? Send us a message and we'll get back to you."
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface-muted p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-8">
          <h2 className="mb-5 font-serif text-xl font-semibold tracking-tight">Send a message</h2>
          <ContactForm />
        </section>

        <aside className="flex flex-col gap-6 rounded-2xl border border-border bg-surface-muted p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-xl font-semibold tracking-tight">Contact information</h2>
            <p className="text-sm text-text-muted">AppMash Limited (operating {resolveSiteName(settings.siteName)})</p>
          </div>
          <ul className="flex flex-col gap-4">
            <InfoRow
              label="Email"
              icon={
                <svg {...ICON_PROPS}>
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
              }
            >
              <a href={`mailto:${contactEmail}`} className="break-all text-brand-primary hover:underline">
                {contactEmail}
              </a>
            </InfoRow>
            {settings.contact.phone && (
              <InfoRow
                label="Phone"
                icon={
                  <svg {...ICON_PROPS}>
                    <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                  </svg>
                }
              >
                <a href={`tel:${settings.contact.phone}`} className="hover:text-brand-primary">
                  {settings.contact.phone}
                </a>
              </InfoRow>
            )}
            {settings.contact.address && (
              <InfoRow
                label="Address"
                icon={
                  <svg {...ICON_PROPS}>
                    <path d="M12 21s7-5.6 7-11.5a7 7 0 1 0-14 0C5 15.4 12 21 12 21Z" />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </svg>
                }
              >
                {settings.contact.address}
              </InfoRow>
            )}
          </ul>

          {socials.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Follow us</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-border px-3 py-1 text-sm font-medium text-text-muted transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
