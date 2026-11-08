import { RemoteImage } from "@/components/RemoteImage";
import type { DerivedOffer } from "@/lib/offerContent";
import type { Dictionary } from "@/lib/i18n";

const BADGE_STYLES = [
  { background: "var(--text)", color: "var(--page)" },
  { background: "var(--accent)", color: "var(--on-accent)" },
  { background: "var(--primary)", color: "var(--page)" },
];

/**
 * "Proof, not promises" — real screenshots of the discount landing. Omitted
 * entirely when no screenshots have been authored (see offerContent.ts's
 * deriveOffer): fabricating this section would defeat its purpose.
 */
export function ProofStrip({ offer, storeName, dict }: { offer: DerivedOffer; storeName: string; dict: Dictionary["proof"] }) {
  if (offer.proofScreenshots.length === 0) return null;

  const steps = [dict.step1(storeName), offer.proofStep2Body, dict.step3(offer.discountLabel)];

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-10 md:py-14">
      <p className="font-store-mono text-[10.5px] uppercase tracking-[0.15em]" style={{ color: "var(--accent-ink)" }}>
        {dict.eyebrow}
      </p>
      <h2 className="sv-section-heading font-store-serif mt-2" style={{ color: "var(--text)" }}>
        {dict.heading}
      </h2>
      <p className="sv-body mt-2 max-w-xl" style={{ color: "var(--muted-text)" }}>
        {dict.subheading(storeName)}
      </p>

      <div className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-[18px] md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {offer.proofScreenshots.slice(0, 3).map((src, i) => (
          <div
            key={src}
            className="w-[236px] shrink-0 snap-start overflow-hidden rounded-[18px] md:w-auto"
            style={{ background: "var(--card)", border: i === 2 ? "1.5px solid var(--primary)" : "1px solid var(--border)" }}
          >
            <div className="h-[172px] w-full md:h-[200px]" style={{ background: "var(--muted)" }}>
              <RemoteImage src={src} alt={`Proof step ${i + 1}`} sizes="240px" className="h-full w-full" />
            </div>
            <div className="flex items-start gap-2.5 p-3.5">
              <span
                className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={BADGE_STYLES[i]}
              >
                {i + 1}
              </span>
              <p className="sv-body" style={{ color: "var(--text-soft)" }}>
                {steps[i]}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[13px] p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="sv-body" style={{ color: "var(--text-soft)" }}>
          <strong style={{ color: "var(--text)" }}>{dict.didntLandStrong}</strong> {dict.didntLandBeforeLink}{" "}
          <a href="mailto:support@monocoupon.com" className="font-bold" style={{ color: "var(--accent-ink)" }}>
            {dict.tellUsLink}
          </a>{" "}
          {dict.didntLandAfterLink}
        </p>
      </div>
    </section>
  );
}
