import Link from "next/link";
import { StoreMark } from "./StoreMark";
import type { Dictionary } from "@/lib/i18n";

export type AlternativeDeal = {
  href: string;
  name: string;
  logo?: string | null;
  monogramLetter: string;
  category?: string | null;
  discountLabel: string;
  discountSuffix: string;
};

/**
 * Genuine "no verified offer" case — a store with neither an admin-authored
 * `offer` nor any active Coupon at all. Per the design handoff: say so
 * plainly rather than ever showing something stale — but don't leave the
 * visitor at a dead end either: point them at verified deals elsewhere.
 *
 * Same dark, glow-lit backdrop as the store hero (StoreHero.tsx), and it
 * grows to fill the viewport (`flex-1` inside StoreDetailViewV2's min-h-dvh
 * column) so a short page never leaves blank space under the footer.
 */
export function EmptyOfferState({
  storeName,
  storeLogo,
  monogramLetter,
  alternatives,
  dict,
}: {
  storeName: string;
  storeLogo?: string | null;
  monogramLetter: string;
  alternatives: AlternativeDeal[];
  dict: Dictionary["emptyOffer"];
}) {
  return (
    <section
      // border-b: the footer below is the same dark colour, so a hairline marks where this section ends.
      className="relative isolate flex flex-1 flex-col overflow-hidden border-b border-white/10"
      style={{
        background:
          "radial-gradient(900px 560px at 88% -8%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 62%), radial-gradient(1000px 640px at -12% 112%, color-mix(in srgb, var(--primary) 75%, transparent), transparent 62%), var(--footer)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />

      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 py-16 md:py-24">
        {/* Message */}
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <StoreMark
            logo={storeLogo}
            letter={monogramLetter}
            name={storeName}
            className="h-16 w-16 rounded-[18px] text-2xl shadow-[0_12px_28px_-12px_rgba(0,0,0,0.7)] ring-2 ring-white/15"
            style={{ background: "var(--page)", color: "var(--primary)" }}
          />
          <p
            className="mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--on-primary-soft)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#f5b942" }} aria-hidden="true" />
            {dict.statusPill}
          </p>
          <h1 className="font-store-serif mt-4 text-balance text-[30px] font-bold leading-[1.08] tracking-[-0.02em] md:text-[44px]" style={{ color: "var(--page)" }}>
            {dict.heading(storeName)}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed md:text-base" style={{ color: "var(--on-primary-soft)" }}>
            {dict.body(storeName)}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/deals"
              className="inline-flex h-12 items-center rounded-[13px] px-6 text-[15px] font-extrabold shadow-[0_10px_24px_-10px_var(--accent)] transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {dict.seeVerifiedDeals}
            </Link>
            <Link
              href="/stores"
              className="inline-flex h-12 items-center rounded-[13px] px-6 text-[15px] font-semibold transition-colors hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.22)", color: "var(--page)" }}
            >
              {dict.browseAllStores}
            </Link>
          </div>
        </div>

        {/* Somewhere to go next */}
        {alternatives.length > 0 && (
          <div className="mx-auto mt-16 w-full max-w-4xl md:mt-20">
            <div className="mb-5 flex flex-col items-center gap-1 text-center">
              <h2 className="font-store-serif text-xl font-bold md:text-2xl" style={{ color: "var(--page)" }}>
                {dict.otherDealsHeading}
              </h2>
              <p className="text-sm" style={{ color: "var(--on-primary-faint)" }}>
                {dict.otherDealsSubheading}
              </p>
            </div>
            <ul className={`grid grid-cols-1 gap-3 ${alternatives.length > 1 ? "sm:grid-cols-2" : ""} ${alternatives.length > 2 ? "lg:grid-cols-3" : ""}`}>
              {alternatives.map((deal) => (
                <li key={deal.href} className={alternatives.length === 1 ? "mx-auto w-full max-w-sm" : ""}>
                  <Link
                    href={deal.href}
                    className="group flex items-center gap-4 rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <StoreMark
                      logo={deal.logo}
                      letter={deal.monogramLetter}
                      name={deal.name}
                      priority={false}
                      className="h-12 w-12 rounded-xl text-lg"
                      style={{ background: "var(--page)", color: "var(--primary)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold" style={{ color: "var(--page)" }}>
                        {deal.name}
                        {deal.category && (
                          <span className="font-medium" style={{ color: "var(--on-primary-faint)" }}>
                            {" "}
                            · {deal.category}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-sm" style={{ color: "var(--on-primary-soft)" }}>
                        <span className="font-extrabold" style={{ color: "var(--accent)" }}>
                          {deal.discountLabel}
                        </span>{" "}
                        {deal.discountSuffix}
                      </span>
                    </span>
                    <span className="text-lg transition-transform group-hover:translate-x-0.5" style={{ color: "var(--on-primary-soft)" }} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
