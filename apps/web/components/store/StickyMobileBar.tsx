import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

/**
 * Mobile-only fixed CTA bar — the scratch bypass. Always live, so a visitor
 * who doesn't want to play the voucher can still convert from anywhere on
 * the page. `store-scope`'s 104px bottom padding (store.css) keeps page
 * content clear of it.
 */
export function StickyMobileBar({ offer, onCtaClick, dict }: { offer: DerivedOffer; onCtaClick: () => void; dict: Dictionary["stickyMobileBar"] }) {
  const subtext = dict.liveOffer;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 px-[15px] pt-[16px] md:hidden"
      // translateZ(0): promotes this to its own compositing layer. Verified
      // in testing that `position: fixed` alone computes and paints
      // correctly pinned to the viewport bottom, but real mobile Safari/
      // Chrome have a long history of letting fixed-position elements drift
      // out of sync with the visual viewport during scroll (especially
      // while the browser's own address-bar chrome is animating in/out) —
      // this is the standard, low-risk mitigation and costs nothing on
      // browsers that don't need it.
      //
      // paddingBottom extends this bar's own colored background down
      // through the home-indicator safe area on notched iPhones (needs
      // viewportFit:"cover" in app/layout.tsx's viewport export, or the
      // browser reserves that strip as blank native chrome no matter what
      // this component does) — the content itself still sits the normal
      // 11px above that boundary, only the background paints further.
      style={{
        background: "var(--bar)",
        backdropFilter: "blur(10px)",
        transform: "translateZ(0)",
        borderTop: "2px solid var(--accent)",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div>
        <p className="text-[15px] font-extrabold" style={{ color: "var(--page)" }}>
          {offer.discountLabel} {offer.discountSuffix}
        </p>
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--success)" }}>
          <span className="sv-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--success)" }} aria-hidden="true" />
          {offer.verifiedDateShort ? dict.testedPrefix(offer.verifiedDateShort) : ""}
          {subtext}
        </p>
      </div>
      <a
        href={offer.affiliateUrl}
        target="_blank"
        rel="nofollow sponsored noopener"
        onClick={onCtaClick}
        className="shrink-0 whitespace-nowrap rounded-[12px] px-4 py-2.5 text-[14.5px] font-extrabold"
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        {offer.code ? dict.getDiscountCode : dict.getDiscountDeal}
      </a>
    </div>
  );
}
