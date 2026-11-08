import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

/**
 * The explicit, per-store "what this store does NOT offer" list.
 * deriveOffer() (offerContent.ts) fills this with generic, defensible copy
 * until an admin writes store-specific lines, so this section always shows
 * once there's an offer at all; the emptiness check below is just a
 * defensive fallback. Doesn't claim there's only one offer for the store —
 * AllDealsSection.tsx lists every deal we could verify above this.
 */
export function HonestyPanel({ offer, storeName, dict }: { offer: DerivedOffer; storeName: string; dict: Dictionary["honesty"] }) {
  if (offer.notOffered.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1240px] px-4 pt-5 pb-10 md:pt-7 md:pb-14">
      <div
        className="rounded-[24px] px-[26px] pb-[26px] pt-[13px] md:grid md:grid-cols-[1.1fr_1fr] md:gap-[44px] md:px-10 md:pb-10 md:pt-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-store-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "var(--accent-ink)" }}>
              {dict.eyebrow}
            </p>
            <h2 className="sv-subsection-heading font-store-serif mt-2" style={{ color: "var(--text)" }}>
              {dict.heading(storeName)}
            </h2>
          </div>
          <p className="sv-body" style={{ color: "var(--text-soft)" }}>
            {dict.body}
          </p>
          {offer.verifiedDateLong && (
            <div className="flex items-center gap-3 rounded-[12px] p-3" style={{ background: "var(--muted)" }}>
              <span
                className="font-store-serif flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: "var(--primary)", color: "var(--page)" }}
                aria-hidden="true"
              >
                {storeName.charAt(0).toUpperCase()}
              </span>
              <p className="sv-caption" style={{ color: "var(--muted-text)" }}>
                {dict.lastFullCheckPrefix}
                <strong style={{ color: "var(--text)" }}>{offer.verifiedDateLong}</strong>
                {dict.lastFullCheckSuffix(offer.verifierName)}
                {offer.nextCheckDateShort && dict.nextCheck(offer.nextCheckDateShort)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 md:mt-0 md:border-l md:pl-[44px]" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
            {dict.whatStoreDoesNotOffer(storeName)}
          </p>
          {offer.notOffered.slice(0, 4).map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-sm font-bold" style={{ color: "var(--warn)" }} aria-hidden="true">
                ✕
              </span>
              <p className="text-[14.5px]" style={{ color: "var(--text-soft)" }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
