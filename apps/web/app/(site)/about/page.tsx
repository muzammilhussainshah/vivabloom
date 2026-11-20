import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { getCachedSiteSettings } from "@/lib/data";
import { resolveSiteName } from "@/lib/brand";

export const metadata: Metadata = { title: "About Us", alternates: { canonical: "/about" } };

const WHAT_WE_DO = [
  {
    title: "Curate Verified Deals",
    description:
      "We track promo codes and deals across hundreds of stores and mark each one with when it was last checked, so you're not wasting time on codes that stopped working months ago.",
  },
  {
    title: "Save You Time",
    description:
      "Instead of hunting across forums and browser extensions, find a store's active codes in one place, organized by category so you can browse for what you actually need.",
  },
  {
    title: "Help You Maximize Savings",
    description:
      "Beyond codes, our blog covers shopping strategy — when to buy, how to stack discounts, and what to watch out for — so you save more than just the coupon's face value.",
  },
];

const VALUES = [
  {
    title: "Trust & Transparency",
    description: "We clearly mark verified codes and disclose when a link may earn us a commission at no cost to you.",
  },
  {
    title: "User-First Approach",
    description: "No account walls, no fake countdown timers — just codes you can copy and use immediately.",
  },
  {
    title: "Quality Over Quantity",
    description: "We'd rather list ten working codes than a hundred expired ones padding out a page.",
  },
  {
    title: "Continuous Improvement",
    description: "We regularly refresh listings and retire dead codes so the site stays genuinely useful.",
  },
];

const WHY_CHOOSE_US = [
  "Wide selection of stores across electronics, fashion, travel, and more.",
  "Codes and deals refreshed regularly, not left to go stale.",
  "A simple, fast interface built for finding a code and getting back to checkout.",
  "Completely free to use — no account or subscription required.",
];

export default async function AboutPage() {
  const siteName = resolveSiteName((await getCachedSiteSettings()).siteName);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-12 px-5 py-10 sm:px-8 sm:py-14">
      <PageHeader
        eyebrow="About us"
        title={`About ${siteName}`}
        description={
          <>
            {siteName} helps online shoppers find verified coupon codes and deals without digging through
            outdated forum posts or dodgy browser extensions. We built this site because finding a working
            discount code shouldn&apos;t be harder than the checkout itself.
          </>
        }
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold tracking-tight">Our Mission</h2>
        <p className="text-text-muted">
          To make saving money online simple and trustworthy — by surfacing real, working
          discounts and being upfront about how we operate.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold tracking-tight">What We Do</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {WHAT_WE_DO.map((item) => (
            <div key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-muted p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <p className="font-semibold text-text">{item.title}</p>
              <p className="text-sm leading-relaxed text-text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold tracking-tight">Our Values</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VALUES.map((item) => (
            <div key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-muted p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <p className="font-semibold text-text">{item.title}</p>
              <p className="text-sm leading-relaxed text-text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold tracking-tight">Why Choose Us</h2>
        <ol className="flex flex-col gap-3">
          {WHY_CHOOSE_US.map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="text-sm text-text-muted">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-bold tracking-tight">Who Operates {siteName}</h2>
        <p className="text-text-muted">
          {siteName} is built and run by <strong>AppMash Limited</strong>, a UK-based software solutions
          company. AppMash Limited designs and builds software products for clients as well as its own
          in-house web platforms — {siteName} is one of those, a blogging site created to share useful,
          well-researched content. That combination of software engineering and content publishing is what
          shapes how the site is built and maintained.
        </p>
        <div className="rounded-2xl border border-border bg-surface-muted p-5 text-sm text-text-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
          <p className="font-medium text-text">AppMash Limited</p>
          <p className="mt-1">Office 875, 55 Gracechurch Street, London, United Kingdom, EC3V 0HR</p>
          <p className="mt-1">
            Email:{" "}
            <a href="mailto:vivabloom2@gmail.com" className="text-brand-primary hover:underline">
              vivabloom2@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
