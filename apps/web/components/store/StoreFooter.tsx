import type { Dictionary } from "@/lib/i18n";

/**
 * Footer for the store-detail routes only — see app/(store)/layout.tsx (and
 * StoreDetailViewV2, which actually renders this — see that file's note on
 * why it moved out of the layout). Deliberately simpler than the main site's
 * <Footer> (no newsletter form, no social icons): the design's spec for this
 * section is brand blurb + Browse/Trust/Legal columns only.
 */
export function StoreFooter({ dict }: { dict: Dictionary["footer"] }) {
  return (
    <footer style={{ background: "var(--footer)", color: "var(--on-primary-dim)" }}>
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4 md:py-12">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <span className="font-store-serif text-lg font-semibold" style={{ color: "var(--page)" }}>
            VivaBloom
          </span>
          <p className="sv-body max-w-xs" style={{ color: "var(--on-primary-dim)" }}>
            {dict.blurb}
          </p>
        </div>

        {dict.columns.map((col) => (
          <div key={col.label} className="flex flex-col gap-2">
            <p className="font-store-mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--on-primary-faint)" }}>
              {col.label}
            </p>
            {col.links.map((link) => (
              <a key={link.href} href={link.href} className="text-sm" style={{ color: "var(--on-primary-dim)" }}>
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      <div
        className="mx-auto max-w-[1240px] px-4 py-4 text-center text-xs"
        style={{ borderTop: "1px solid rgba(246,243,236,0.1)", color: "var(--on-primary-faint)" }}
      >
        {dict.copyright(new Date().getFullYear())}
      </div>
    </footer>
  );
}
