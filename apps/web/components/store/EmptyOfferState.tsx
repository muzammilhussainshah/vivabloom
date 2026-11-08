import { StoreMark } from "./StoreMark";
import type { Dictionary } from "@/lib/i18n";

/**
 * Genuine "no verified offer" case — a store with neither an admin-authored
 * `offer` nor any active Coupon at all. Per the design handoff: say so
 * plainly rather than ever showing something stale.
 */
export function EmptyOfferState({
  storeName,
  storeLogo,
  monogramLetter,
  dict,
}: {
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  dict: Dictionary["emptyOffer"];
}) {
  return (
    <section className="relative overflow-hidden" style={{ background: "var(--primary)" }}>
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-4 px-4 py-20 text-center">
        <StoreMark
          logo={storeLogo}
          letter={monogramLetter}
          name={storeName}
          className="h-[50px] w-[50px] rounded-[13px] text-xl"
          style={{ background: "var(--page)", color: "var(--primary)" }}
        />
        <h1 className="font-store-serif text-2xl font-bold md:text-[32px]" style={{ color: "var(--page)" }}>
          {dict.heading(storeName)}
        </h1>
        <p className="sv-body max-w-md" style={{ color: "var(--on-primary-soft)" }}>
          {dict.body(storeName)}
        </p>
        <a
          href="/stores"
          className="mt-2 rounded-[13px] px-6 py-3 text-[15px] font-extrabold"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {dict.browseAllStores}
        </a>
      </div>
    </section>
  );
}
