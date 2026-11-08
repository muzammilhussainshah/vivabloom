"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StoreMark } from "./StoreMark";
import { RemoteImage } from "@/components/RemoteImage";
import { CopyIcon, CheckIcon, CloseIcon, GiftIcon, ExternalLinkIcon } from "@/components/CouponIcons";
import { copyCouponCode, trackBundleClick } from "@/lib/couponInteraction";
import type { BundleCard, ProductCard } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * The upsell slot below the main CTA: a random Bundle when the store has
 * any, otherwise a random Product (so the modal still has an upsell even
 * for stores with no bundles set up) — never both, and never neither unless
 * the store truly has no bundles *and* no products. `detailsUrl`/
 * `extraDiscountPercent` only exist on bundles; a product's card in this
 * slot just omits that badge and the secondary "Details" link.
 */
interface FeaturedItem {
  kind: "bundle" | "product";
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  url: string;
  detailsUrl?: string;
  extraDiscountPercent?: number | null;
}

/** Whichever coupon the visitor last activated — the voucher, the sticky bar, the header, or one of the AllDealsSection cards can all arm this with their own coupon's details. */
export interface HandoffData {
  title: string;
  description?: string | null;
  code: string | null;
  affiliateUrl: string;
  couponId: string | null;
}

/**
 * The "welcome back" modal — re-created from the pre-redesign CouponModal
 * (see git history) in the new theme's visual language. Deliberately does
 * NOT open at the moment a CTA is tapped (the merchant tab already opened;
 * showing a modal on top of that on this tab would just be in the way while
 * the visitor is busy on the other one). Instead `StoreDetailViewV2` arms it
 * with the clicked coupon's data, then opens it ~1s after this tab regains
 * visibility (the visitor switching back from the merchant tab) — so it
 * greets them with the code again (and a bundle upsell) right when they're
 * back and receptive, not competing with the handoff itself.
 */
export function HandoffModal({
  data,
  onClose,
  onReopen,
  storeName,
  storeLogo,
  monogramLetter,
  storeSlug,
  bundles,
  products,
  dict,
  country,
}: {
  data: HandoffData | null;
  onClose: () => void;
  /** Re-arms the handoff (so returning again later shows this modal again) — navigation is the anchor's own job. */
  onReopen: (data: HandoffData) => void;
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  storeSlug: string;
  bundles: BundleCard[];
  /** Featured only when the store has zero bundles — see FeaturedItem above. */
  products: ProductCard[];
  dict: Dictionary["handoff"];
  country?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [featuredItem, setFeaturedItem] = useState<FeaturedItem | null>(null);

  useEffect(() => setMounted(true), []);

  // Re-roll which bundle/product to feature each time the modal opens (a
  // client-only effect fired by user interaction post-hydration, not during
  // render — safe per this app's own hydration-mismatch history, unlike
  // calling Math.random directly in a render body). Bundles always win over
  // products when the store has both.
  useEffect(() => {
    if (!data) {
      setFeaturedItem(null);
      return;
    }
    if (bundles.length > 0) {
      const b = bundles[Math.floor(Math.random() * bundles.length)];
      const bundleLocale = country ? b.i18n?.find((e) => e.country === country) : null;
      setFeaturedItem({
        kind: "bundle",
        id: b._id,
        name: b.name,
        image: b.image,
        price: b.price,
        originalPrice: b.originalPrice,
        url: bundleLocale?.bundleUrl || b.bundleUrl,
        detailsUrl: bundleLocale?.bundleDetailsUrl || b.bundleDetailsUrl,
        extraDiscountPercent: b.extraDiscountPercent,
      });
      return;
    }
    if (products.length > 0) {
      const p = products[Math.floor(Math.random() * products.length)];
      const productLocale = country ? p.i18n?.find((e) => e.country === country) : null;
      setFeaturedItem({
        kind: "product",
        id: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        originalPrice: p.originalPrice,
        url: productLocale?.productUrl || p.productUrl,
      });
      return;
    }
    setFeaturedItem(null);
  }, [data, bundles, products, country]);

  useEffect(() => {
    if (!data) return;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [data, onClose]);

  if (!mounted || !data) return null;

  const portalTarget = document.getElementById("store-modal-root") ?? document.body;

  function handleCopy() {
    if (!data!.code) return;
    navigator.clipboard?.writeText(data!.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCtaClick() {
    copyCouponCode(data!.code, { storeSlug, couponId: data!.couponId, couponCode: data!.code, destinationUrl: data!.affiliateUrl });
    onReopen(data!);
    onClose();
  }

  function handleFeaturedItemClick() {
    if (!featuredItem) return;
    const meta = { storeSlug, couponId: data!.couponId, couponCode: data!.code, destinationUrl: featuredItem.url };
    copyCouponCode(data!.code, meta);
    // Reused as-is for products too — the function fires a generic
    // affiliate_click engagement beacon, nothing bundle-specific about it.
    // null/null deliberately skips the Ads conversion ping: this is a
    // product/bundle upsell, not a coupon CTA, so it shouldn't count.
    trackBundleClick(null, null, meta);
    onReopen(data!);
    onClose();
  }

  const hasSavings = !!(featuredItem?.originalPrice && featuredItem.originalPrice > featuredItem.price);
  const savingsAmount = hasSavings ? featuredItem!.originalPrice! - featuredItem!.price : null;
  const percentOff = hasSavings ? Math.ceil((savingsAmount! / featuredItem!.originalPrice!) * 100) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-6"
      style={{ background: "var(--scrim)" }}
      // React bubbles portal events through the *React* tree, not the DOM
      // tree — this modal is still logically nested inside whatever CTA
      // triggered it, so a backdrop click must stop propagation or it'd also
      // re-trigger that CTA's own click handler.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={dict.dialogAriaLabel(storeName)}
    >
      <div
        className="flex max-h-[92%] w-full flex-col overflow-y-auto rounded-t-[22px] shadow-2xl md:max-h-[88vh] md:max-w-[420px] md:rounded-[22px]"
        style={{ background: "var(--page)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex shrink-0 flex-col items-center gap-2 px-6 py-5 text-center"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.closeAria}
            className="absolute right-4 top-4 opacity-80 transition-opacity hover:opacity-100"
          >
            <CloseIcon />
          </button>
          <StoreMark
            logo={storeLogo}
            letter={monogramLetter}
            name={storeName}
            priority={false}
            className="h-11 w-11 rounded-[12px] text-lg"
            style={{ background: "var(--text)", color: "var(--page)" }}
          />
          <div>
            <p className="text-[15px] font-bold leading-snug">{data.title}</p>
            <p className="text-[13px] opacity-80">{storeName}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {data.description && (
            <p className="sv-body" style={{ color: "var(--text-soft)" }}>
              {data.description}
            </p>
          )}

          {data.code && (
            <div className="flex flex-col items-center gap-2.5 rounded-[14px] border-2 border-dashed p-4 text-center" style={{ borderColor: "var(--border-strong)" }}>
              <p className="font-store-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--muted-text)" }}>
                {dict.yourCouponCode}
              </p>
              <p className="font-store-mono text-[21px] font-bold tracking-[0.06em]" style={{ color: "var(--text)" }}>
                {data.code}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13.5px] font-bold transition-colors"
                style={{ border: `1.5px solid ${copied ? "var(--success)" : "var(--primary)"}`, color: copied ? "var(--success)" : "var(--primary)" }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? dict.copied : dict.copyCode}
              </button>
            </div>
          )}

          {/* A real anchor, not a button calling window.open — the
              guaranteed-working path to the merchant, since a navigation the
              visitor triggered by tapping a link is never popup-blocked. */}
          <a
            href={data.affiliateUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            onClick={handleCtaClick}
            className="inline-flex items-center justify-center gap-2 rounded-[13px] py-[15px] text-[15px] font-extrabold"
            style={{ background: "var(--primary)", color: "var(--page)" }}
          >
            {data.code ? dict.copyCodeAndGetDeal : dict.getDeal}
            <ExternalLinkIcon />
          </a>

          {featuredItem && (
            <div className="mt-1 flex flex-col gap-2.5 rounded-[14px] p-3.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent-ink)" }}>
                  {featuredItem.kind === "bundle" && <GiftIcon />}
                  {featuredItem.kind === "bundle" ? dict.bundleAndSave : dict.featuredProductHeading}
                </div>
                {!!featuredItem.extraDiscountPercent && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--primary)", color: "var(--page)" }}
                  >
                    {dict.extraOff(featuredItem.extraDiscountPercent)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <RemoteImage
                  src={featuredItem.image}
                  alt={featuredItem.name}
                  sizes="44px"
                  className="h-11 w-11 shrink-0 rounded-[10px] bg-[var(--muted)]"
                  imgClassName="object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold" style={{ color: "var(--text)" }}>
                    {featuredItem.name}
                  </p>
                  {hasSavings && (
                    <p className="text-[13px] font-bold" style={{ color: "var(--accent-ink)" }}>
                      {dict.save(`$${savingsAmount!.toFixed(2)}`, percentOff !== null ? ` (${percentOff}%)` : "")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={featuredItem.url}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  onClick={handleFeaturedItemClick}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12.5px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                  {featuredItem.kind === "bundle" ? dict.getThisBundle : dict.getThisProduct}
                  <ExternalLinkIcon />
                </a>
                {featuredItem.detailsUrl && (
                  <a
                    href={featuredItem.detailsUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener"
                    className="shrink-0 text-[12.5px] font-bold"
                    style={{ color: "var(--primary)" }}
                  >
                    {dict.details}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  );
}
