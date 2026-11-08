"use client";

import type { ReactNode } from "react";
import { RemoteImage } from "@/components/RemoteImage";
import { StoreMark } from "./StoreMark";
import { GiftIcon } from "@/components/CouponIcons";
import type { DerivedOffer } from "@/lib/offerContent";
import type { ProductCard as ProductCardData, BundleCard as BundleCardData } from "@/lib/data";
import { buildCatalogTiles } from "@/lib/catalogItems";
import type { Dictionary } from "@/lib/i18n";

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M3 8.5l3 3 7-7" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Hero band: store identity, verified chip, lede, the 3-tile
 * "click-confirmation" strip (proof the visitor landed on the right item
 * from the ad — products plus one bundle when the store has any), the trust
 * row, and — via the `voucher` slot — the voucher card. See
 * design_handoff_store_page's README §2. Desktop is a `1fr 448px` grid (left
 * column flex, voucher fixed-width right column); mobile stacks, with the
 * voucher last, via plain source order.
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

  // Rendered twice below (desktop position vs. mobile position, each gated by
  // a `hidden`/`md:hidden` wrapper) — same pattern as the lede paragraph
  // further down. On mobile the trust row moves to after the voucher instead
  // of before it, so the voucher itself appears higher up without as much
  // scrolling; desktop keeps it directly under the product strip.
  const trustCheckItems = offer.trustChecks.length > 0 && (
    <>
      {offer.trustChecks.slice(0, 4).map((check) => (
        <div key={check} className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--on-primary-soft)" }}>
          <CheckIcon />
          {check}
        </div>
      ))}
    </>
  );

  return (
    <section className="relative overflow-hidden" style={{ background: "var(--primary)" }}>
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-[300px] w-[300px] rounded-full md:h-[520px] md:w-[520px]"
        style={{ background: "var(--accent-stripe)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1240px] px-4 py-6 md:py-10">
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

        <div className="mt-4 flex flex-col gap-6 md:grid md:grid-cols-[1fr_448px] md:items-stretch md:gap-[54px]">
          <div className="flex flex-col gap-5 md:justify-between">
            <div className="flex flex-col gap-4">
              {/* Store identity row */}
              <div className="flex items-center gap-2.5">
                <StoreMark
                  logo={storeLogo}
                  letter={monogramLetter}
                  name={storeName}
                  className="h-[42px] w-[42px] rounded-[13px] text-lg md:h-[50px] md:w-[50px] md:text-xl"
                  style={{ background: "var(--page)", color: "var(--primary)" }}
                />
                <div>
                  <p className="text-[15px] font-extrabold md:text-[21px]" style={{ color: "var(--page)" }}>
                    {storeName}
                  </p>
                  {categoryName && (
                    <p className="text-sm" style={{ color: "var(--on-primary-dim)" }}>
                      {categoryName}
                    </p>
                  )}
                </div>
              </div>

              {/* Verified chip */}
              <div
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: "var(--sec-bg)", border: "1px solid var(--sec-br)", color: "var(--success)" }}
              >
                <span className="sv-pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
                {dict.liveOffer(offer.verifiedDateLong)}
              </div>

              {/* Lede — desktop only */}
              {offer.lede && (
                <p className="sv-hero-lede hidden max-w-[540px] md:block" style={{ color: "var(--on-primary-soft)" }}>
                  {offer.lede}
                </p>
              )}
            </div>

            {/* Click-confirmation block */}
            {heroProducts.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[12.5px] font-bold md:text-[15px]" style={{ color: "var(--page)" }}>
                    {dict.onTheRightPage}
                  </p>
                  <p className="hidden text-right text-[13px] md:block" style={{ color: "var(--on-primary-dim)" }}>
                    {dict.ownCutsLine(storeName, offer.discountLabel)}
                  </p>
                </div>

                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                  {heroProducts.map((item, i) => {
                    const hasDiscount = !!(item.originalPrice && item.originalPrice > item.price);
                    const percentOff = hasDiscount ? Math.ceil(((item.originalPrice! - item.price) / item.originalPrice!) * 100) : null;
                    const altBadge = i % 2 === 1;
                    return (
                      <a
                        key={`${item.kind}-${item.id}`}
                        href={item.url}
                        target="_blank"
                        rel="nofollow sponsored noopener"
                        onClick={() => onProductClick(item.url)}
                        className="group relative w-[108px] shrink-0 rounded-[14px] p-[9px] transition-colors md:w-auto"
                        style={{ background: "rgba(246,243,236,0.07)", border: "1px solid rgba(246,243,236,0.15)" }}
                      >
                        <div className="relative h-[80px] w-full overflow-hidden rounded-[9px] md:h-[118px]" style={{ background: "var(--muted)" }}>
                          <RemoteImage src={item.image} alt={item.name} sizes="120px" className="h-full w-full" imgClassName="object-contain" />
                          {percentOff !== null && (
                            <span
                              className="font-store-mono absolute left-[7px] top-[7px] rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-semibold"
                              style={altBadge ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: "var(--text)", color: "var(--page)" }}
                            >
                              -{percentOff}%
                            </span>
                          )}
                          {item.kind === "bundle" && (
                            <span
                              className="absolute right-[7px] top-[7px] flex h-5 w-5 items-center justify-center rounded-full"
                              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                              aria-label={dict.bundleAriaLabel}
                            >
                              <GiftIcon />
                            </span>
                          )}
                        </div>
                        {/* <p className="mt-1.5 line-clamp-2 text-[10.5px] font-bold md:text-[12.5px]" style={{ color: "var(--page)" }}>
                          {item.name}
                        </p> */}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trust row — desktop position, directly under the product strip */}
            {trustCheckItems && (
              <div
                className="hidden md:flex md:flex-wrap md:gap-6 md:border-t md:pt-5"
                style={{ borderColor: "rgba(246,243,236,0.14)" }}
              >
                {trustCheckItems}
              </div>
            )}
          </div>

          <div>{voucher}</div>

          {/* Trust row — mobile position, after the voucher instead of before it */}
          {trustCheckItems && <div className="grid grid-cols-2 gap-3 md:hidden">{trustCheckItems}</div>}
        </div>
      </div>
    </section>
  );
}
