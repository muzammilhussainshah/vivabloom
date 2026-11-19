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
 * Hero band of the paid-campaign landing page. One grid, two layouts:
 *
 *  - Mobile (single column, plain source order): store identity -> the
 *    voucher (so its Get Code button sits above the fold on a ~390x844
 *    phone) -> the products strip -> the 3-step "how to save" -> trust row.
 *  - Desktop (`md`, 1fr | 448px): everything but the voucher stacks in the
 *    left column; the voucher is pinned into the right column spanning all
 *    rows, so it stays beside the content instead of below it.
 *
 * The products strip doubles as click-confirmation ("you're on the right
 * page" — proof the visitor landed where the ad promised): real product
 * cards with name, price and the store's own markdown, each a tracked
 * affiliate link.
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
    <section className="relative isolate overflow-hidden" style={{ background: "var(--primary)" }}>
      {/* Depth: a soft light bloom top-left, the accent disc top-right, and a fine dot grain — so the band reads as crafted, not as a flat fill. */}
      <div
        className="pointer-events-none absolute -left-40 -top-48 -z-10 h-[460px] w-[460px] rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 65%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[300px] w-[300px] rounded-full md:h-[520px] md:w-[520px]"
        style={{ background: "var(--accent-stripe)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1240px] px-4 pb-8 pt-4 md:pb-14 md:pt-8">
        <p className="font-store-mono text-[10px] tracking-wide" style={{ color: "var(--on-primary-faint)" }}>
          <a href="/" style={{ color: "var(--on-primary-faint)" }}>
            {dict.home}
          </a>{" "}
          / <span style={{ color: "var(--page)" }}>{storeName}</span>
        </p>

        {tagline && (
          <p
            className="mt-2 inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: "var(--accent-stripe)", color: "var(--page)" }}
          >
            {tagline}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-5 md:mt-6 md:grid-cols-[minmax(0,1fr)_448px] md:grid-rows-[auto_auto_auto_1fr] md:gap-x-14 md:gap-y-7">
          {/* 1. Identity */}
          <div className="flex flex-col gap-3.5 md:col-start-1 md:row-start-1 md:gap-4">
            <div className="flex items-center gap-3">
              <StoreMark
                logo={storeLogo}
                letter={monogramLetter}
                name={storeName}
                className="h-12 w-12 rounded-[14px] text-xl shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)] ring-2 ring-white/15 md:h-14 md:w-14 md:rounded-2xl md:text-2xl"
                style={{ background: "var(--page)", color: "var(--primary)" }}
              />
              <div className="min-w-0">
                <p className="truncate text-[19px] font-extrabold leading-tight tracking-tight md:text-[26px]" style={{ color: "var(--page)" }}>
                  {storeName}
                </p>
                {categoryName && (
                  <p className="text-[13px] md:text-sm" style={{ color: "var(--on-primary-dim)" }}>
                    {categoryName}
                  </p>
                )}
              </div>
            </div>

            <div
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "var(--sec-bg)", border: "1px solid var(--sec-br)", color: "var(--success)" }}
            >
              <span className="sv-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
              {dict.liveOffer(offer.verifiedDateLong)}
            </div>

            {offer.lede && (
              <p className="sv-hero-lede hidden max-w-[560px] md:block" style={{ color: "var(--on-primary-soft)" }}>
                {offer.lede}
              </p>
            )}
          </div>

          {/* 2. Voucher — second on mobile (above the fold), pinned right on desktop */}
          <div id="sv-voucher" className="md:col-start-2 md:row-span-4 md:row-start-1 md:self-start">
            {voucher}
          </div>

          {/* 3. Products */}
          {heroProducts.length > 0 && (
            <div className="flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-bold md:text-[15px]" style={{ color: "var(--page)" }}>
                  {dict.onTheRightPage}
                </p>
                <p className="hidden text-right text-[13px] md:block" style={{ color: "var(--on-primary-dim)" }}>
                  {dict.ownCutsLine(storeName, offer.discountLabel)}
                </p>
              </div>

              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
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
                      className="group flex w-[158px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl shadow-[0_10px_24px_-14px_rgba(0,0,0,0.55)] transition-transform duration-200 hover:-translate-y-1 md:w-auto"
                      style={{ background: "var(--page)" }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
                        <RemoteImage
                          src={item.image}
                          alt={item.name}
                          sizes="(min-width: 768px) 200px, 158px"
                          className="h-full w-full"
                          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {percentOff !== null && (
                          <span
                            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold"
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
                      <div className="flex flex-1 flex-col gap-1 border-t px-3 pb-3 pt-2.5" style={{ borderColor: "var(--border)" }}>
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

          {/* 4. How to save, in 3 steps */}
          <div className="md:col-start-1 md:row-start-3">
            <p className="mb-3 text-[13.5px] font-bold md:text-[15px]" style={{ color: "var(--page)" }}>
              {dict.howToSaveHeading}
            </p>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex items-start gap-3 rounded-2xl px-3.5 py-3 sm:flex-col sm:gap-2.5 sm:px-4 sm:py-4"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14px] font-bold leading-snug" style={{ color: "var(--page)" }}>
                      {step.title}
                    </span>
                    <span className="text-[12.5px] leading-snug" style={{ color: "var(--on-primary-dim)" }}>
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
              style={{ borderColor: "rgba(255,255,255,0.14)" }}
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
