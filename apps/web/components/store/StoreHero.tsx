"use client";

import type { ReactNode } from "react";
import { RemoteImage } from "@/components/RemoteImage";
import { StoreMark } from "./StoreMark";
import { GiftIcon } from "@/components/CouponIcons";
import type { DerivedOffer } from "@/lib/offerContent";
import type { ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";
import { buildCatalogTiles } from "@/lib/catalogItems";
import { getSupportedCountry } from "@monocoupon/validation/countries";
import type { Dictionary } from "@/lib/i18n";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M3 8.5l3 3 7-7" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Product prices are stored as plain numbers; show cents only when there are any ("$35" / "$35.98"), in the route country's currency. */
function formatPrice(amount: number, country?: string | null): string {
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const supported = country ? getSupportedCountry(country) : undefined;
  if (!supported) return `$${value}`;
  return supported.currencyPosition === "prefix" ? `${supported.currencySymbol}${value}` : `${value} ${supported.currencySymbol}`;
}

/**
 * Hero band of the paid-campaign landing page. A deep, near-black brand
 * backdrop lit by two soft color glows (accent top-right behind the voucher,
 * primary bottom-left) so the coral voucher is the brightest thing on screen,
 * with a big headline on the left stating the offer in one line.
 *
 * One grid, two layouts:
 *  - Mobile (single column, source order): identity -> headline -> the
 *    voucher (its Get Code button lands above the fold on a ~390x844 phone)
 *    -> products -> 3 steps -> trust row.
 *  - Desktop (`md`, 1fr | 448px): everything but the voucher stacks on the
 *    left; the voucher is pinned into the right column across all rows.
 *
 * Everything decorative here is static CSS (gradients, one pre-blurred
 * glow) — nothing animates, so it costs a single paint and no main-thread
 * time.
 */
export function StoreHero({
  storeName,
  storeLogo,
  monogramLetter,
  categoryName,
  tagline,
  offer,
  products,
  bundles,
  onProductClick,
  voucher,
  dict,
  country,
}: {
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  categoryName?: string | null;
  /** Set only on the 6 PPC-sitelink variant routes — a short line distinguishing that URL's landing page from the canonical one, per Google Ads sitelink policy (see storeVariants.ts). */
  tagline?: string;
  offer: DerivedOffer;
  products: ProductCardData[];
  bundles: BundleCardData[];
  onProductClick: (url: string) => void;
  voucher: ReactNode;
  dict: Dictionary["storeHero"];
  country?: string | null;
}) {
  const heroProducts = buildCatalogTiles(products, bundles, 3, country);
  const steps = dict.steps(Boolean(offer.code), storeName, offer.discountLabel);
  const trustChecks = offer.trustChecks.slice(0, 4);

  return (
    <section
      className="relative isolate overflow-hidden"
      style={{
        background:
          "radial-gradient(900px 560px at 88% -8%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%), radial-gradient(1000px 640px at -12% 112%, color-mix(in srgb, var(--primary) 75%, transparent), transparent 62%), var(--footer)",
      }}
    >
      {/* Fine dot grain — gives the dark field texture instead of a flat fill. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1240px] px-4 pb-9 pt-4 md:pb-16 md:pt-8">
        <p className="font-store-mono text-[10px] tracking-wide" style={{ color: "var(--on-primary-faint)" }}>
          <a href="/" style={{ color: "var(--on-primary-faint)" }}>
            {dict.home}
          </a>{" "}
          / <span style={{ color: "var(--page)" }}>{storeName}</span>
        </p>

        {tagline && (
          <p
            className="mt-2 inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {tagline}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-6 md:mt-7 md:grid-cols-[minmax(0,1fr)_448px] md:grid-rows-[auto_auto_auto_1fr] md:gap-x-16 md:gap-y-9">
          {/* 1. Identity + headline */}
          <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1 md:gap-5">
            <div className="flex items-center gap-3">
              <StoreMark
                logo={storeLogo}
                letter={monogramLetter}
                name={storeName}
                className="h-11 w-11 rounded-[13px] text-lg shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] ring-2 ring-white/15 md:h-12 md:w-12 md:rounded-[14px] md:text-xl"
                style={{ background: "var(--page)", color: "var(--primary)" }}
              />
              <div className="min-w-0">
                <p className="truncate text-[16px] font-extrabold leading-tight md:text-[18px]" style={{ color: "var(--page)" }}>
                  {storeName}
                  {categoryName && (
                    <span className="font-medium" style={{ color: "var(--on-primary-faint)" }}>
                      {" "}
                      · {categoryName}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--success)" }}>
                  <span className="sv-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
                  {dict.liveOffer(offer.verifiedDateLong)}
                </p>
              </div>
            </div>

            {/* The offer in one line. Not an <h1> — that lives in the voucher (store name + discount), per the store-page SEO spec. */}
            <p
              className="font-store-serif text-balance text-[36px] font-bold leading-[1.02] tracking-[-0.03em] md:text-[64px]"
              style={{ color: "var(--page)" }}
            >
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(100deg, var(--accent) 10%, color-mix(in srgb, var(--accent) 45%, #ffd8b0) 90%)" }}
              >
                {offer.discountLabel}
              </span>{" "}
              {offer.discountSuffix}
            </p>

            {offer.lede && (
              <p className="sv-hero-lede hidden max-w-[540px] md:block" style={{ color: "var(--on-primary-soft)" }}>
                {offer.lede}
              </p>
            )}
          </div>

          {/* 2. Voucher — right after the headline on mobile, pinned right on desktop, sitting in a soft accent glow. */}
          <div id="sv-voucher" className="relative md:col-start-2 md:row-span-4 md:row-start-1 md:self-start">
            <div
              className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 opacity-50 md:-inset-20"
              style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
              aria-hidden="true"
            />
            {voucher}
          </div>

          {/* 3. Products */}
          {heroProducts.length > 0 && (
            <div className="flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-store-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--on-primary-dim)" }}>
                  {dict.onTheRightPage}
                </p>
                <p className="hidden text-right text-[12.5px] md:block" style={{ color: "var(--on-primary-faint)" }}>
                  {dict.ownCutsLine(storeName, offer.discountLabel)}
                </p>
              </div>

              {/* scroll-px-4 matches the px-4 inset: without it, snap-start aligns the first card to the scrollport's raw edge, gluing it to the screen border. */}
              <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:scroll-px-0 md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                {heroProducts.map((item) => {
                  const hasDiscount = !!(item.originalPrice && item.originalPrice > item.price);
                  const percentOff = hasDiscount ? Math.ceil(((item.originalPrice! - item.price) / item.originalPrice!) * 100) : null;
                  return (
                    <a
                      key={`${item.kind}-${item.id}`}
                      href={item.url}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      onClick={() => onProductClick(item.url)}
                      className="group flex w-[172px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:-translate-y-1 md:w-auto"
                      style={{ background: "var(--page)" }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                        <RemoteImage
                          src={item.image}
                          alt={item.name}
                          sizes="(min-width: 768px) 200px, 172px"
                          className="h-full w-full"
                          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {percentOff !== null && (
                          <span
                            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold shadow-sm"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                          >
                            -{percentOff}%
                          </span>
                        )}
                        {item.kind === "bundle" && (
                          <span
                            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ background: "var(--text)", color: "var(--page)" }}
                            aria-label={dict.bundleAriaLabel}
                          >
                            <GiftIcon />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5">
                        <p className="line-clamp-1 text-[13px] font-bold leading-snug" style={{ color: "var(--text)" }}>
                          {item.name}
                        </p>
                        <div className="mt-auto flex items-end justify-between gap-2">
                          <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
                            <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
                              {formatPrice(item.price, country)}
                            </span>
                            {hasDiscount && (
                              <span className="text-[11.5px] line-through" style={{ color: "var(--muted-text)" }}>
                                {formatPrice(item.originalPrice!, country)}
                              </span>
                            )}
                          </p>
                          <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold" style={{ color: "var(--accent-ink)" }}>
                            {dict.shop}
                            <ArrowIcon />
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. How to save — a connected 3-step track, not three more boxes */}
          <div className="md:col-start-1 md:row-start-3">
            <p className="font-store-mono mb-4 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--on-primary-dim)" }}>
              {dict.howToSaveHeading}
            </p>
            <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
              {steps.map((step, i) => (
                <li key={step.title} className="relative flex items-start gap-3 sm:flex-1 sm:flex-col sm:gap-3 sm:pr-5">
                  {i < steps.length - 1 && (
                    <>
                      {/* connector: vertical on mobile, horizontal from sm up */}
                      <span className="absolute left-[15px] top-9 h-[calc(100%-20px)] w-px sm:hidden" style={{ background: "rgba(255,255,255,0.16)" }} aria-hidden="true" />
                      <span className="absolute left-11 right-3 top-4 hidden h-px sm:block" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06))" }} aria-hidden="true" />
                    </>
                  )}
                  <span
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold shadow-[0_6px_16px_-6px_var(--accent)]"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 pt-1 sm:pt-0">
                    <span className="text-[15px] font-bold leading-snug" style={{ color: "var(--page)" }}>
                      {step.title}
                    </span>
                    <span className="text-[13px] leading-snug" style={{ color: "var(--on-primary-dim)" }}>
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* 5. Trust row */}
          {trustChecks.length > 0 && (
            <ul
              className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-5 md:col-start-1 md:row-start-4 md:flex md:flex-wrap md:gap-x-6 md:self-end"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              {trustChecks.map((check) => (
                <li key={check} className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--on-primary-soft)" }}>
                  <CheckIcon />
                  {check}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
