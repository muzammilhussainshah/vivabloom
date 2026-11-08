import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { GiftIcon } from "./CouponIcons";
import type { CatalogItem, StoreCatalogGroup } from "@/lib/data";

/** Not in CouponIcons.tsx — used only for the "Best Deal in Store" ribbon below. */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3.5 14.6 9 20.5 9.8 16.2 13.9 17.3 19.8 12 16.9 6.7 19.8 7.8 13.9 3.5 9.8 9.4 9 12 3.5Z" />
    </svg>
  );
}

function priceInfo(item: CatalogItem) {
  const { data } = item;
  const hasDiscount = !!(data.originalPrice && data.originalPrice > data.price);
  const percentOff = hasDiscount
    ? Math.ceil(((data.originalPrice! - data.price) / data.originalPrice!) * 100)
    : null;
  const savings = hasDiscount ? data.originalPrice! - data.price : null;
  return { hasDiscount, percentOff, savings };
}

/**
 * The large tile: full square image, a circular discount badge, an optional
 * "Bundle" tag and "Best Deal in Store" ribbon. Used as the sole card when a
 * store has 1-2 items, and as the featured lead when it has 3+.
 */
function LeadCard({ item, isFeatured, priority }: { item: CatalogItem; isFeatured?: boolean; priority?: boolean }) {
  const { data, kind } = item;
  const { hasDiscount, percentOff, savings } = priceInfo(item);

  return (
    <Link
      href={`/products/${data.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="(min-width: 768px) 45vw, 100vw"
          className="h-full w-full"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={priority}
        />
        {percentOff !== null && (
          <span className="absolute left-4 top-4 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-brand-secondary text-white shadow-lg">
            <span className="text-xl font-extrabold leading-none">{percentOff}%</span>
            <span className="text-[9px] font-bold tracking-wide">OFF</span>
          </span>
        )}
        {kind === "bundle" && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-text shadow">
            <GiftIcon />
            Bundle
          </span>
        )}
        {isFeatured && (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-text/80 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <StarIcon className="text-brand-accent" />
            Best Deal in Store
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-5">
        <p className="text-lg font-semibold text-text group-hover:text-brand-primary">{data.name}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[26px] font-extrabold text-text">${data.price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-base text-text-muted line-through">${data.originalPrice!.toFixed(2)}</span>
          )}
        </div>
        {hasDiscount && (
          <span className="w-fit rounded-full bg-[#eef6f1] px-3 py-1 text-sm font-bold text-[#3f8f66]">
            Save ${savings!.toFixed(2)}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * A smaller full-image card, stacked two-to-a-column beside the lead when a
 * store has exactly 3 items. Deliberately not height-matched to the lead via
 * flex-grow — an aspect-square image can't be compressed without distorting,
 * so the pair just sits at its own natural size (close to, but not forced to
 * exactly equal, the lead's height).
 */
function SecondaryCard({ item }: { item: CatalogItem }) {
  const { data } = item;
  const { hasDiscount, percentOff } = priceInfo(item);

  return (
    <Link
      href={`/products/${data.slug}`}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[1/0.92] overflow-hidden bg-surface-muted">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="(min-width: 768px) 20vw, 50vw"
          className="h-full w-full"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {percentOff !== null && (
          <span className="absolute left-2.5 top-2.5 flex h-[42px] w-[42px] flex-col items-center justify-center rounded-full bg-brand-secondary text-white shadow">
            <span className="text-[13px] font-extrabold leading-none">{percentOff}%</span>
            <span className="text-[6.5px] font-bold">OFF</span>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <p className="text-[13.5px] font-semibold text-text group-hover:text-brand-primary">{data.name}</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-extrabold text-text">${data.price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-[11.5px] text-text-muted line-through">${data.originalPrice!.toFixed(2)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * A compact thumbnail+text row, used for every item beside the lead once a
 * store has 4+ of them — there isn't enough height left per item (once the
 * lead's height is divided across all of them) for a full image-on-top card.
 * The thumbnail is `h-20` standalone (mobile: the 2-column grid collapses to
 * one column, so there's no lead height to match) and switches to `h-full`
 * at `md`, where it fills whatever height the row's `flex-1` share of the
 * (grid-stretched, lead-height-matching) column works out to.
 */
function CompactRow({ item }: { item: CatalogItem }) {
  const { data } = item;
  const { hasDiscount, percentOff, savings } = priceInfo(item);

  return (
    <Link
      href={`/products/${data.slug}`}
      className="group flex items-center gap-3.5 overflow-hidden rounded-[18px] border border-border bg-surface p-3 transition-shadow hover:shadow-md md:flex-1 md:min-h-0"
    >
      <div className="relative aspect-square h-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted md:h-full">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="90px"
          className="h-full w-full"
          imgClassName="object-cover"
        />
        {percentOff !== null && (
          <span className="absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-[11px] font-extrabold text-white shadow">
            {percentOff}%
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="line-clamp-2 text-sm font-semibold text-text group-hover:text-brand-primary">{data.name}</p>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[17px] font-extrabold text-text">${data.price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-xs text-text-muted line-through">${data.originalPrice!.toFixed(2)}</span>
          )}
        </div>
        {hasDiscount && (
          <span className="w-fit rounded-full bg-[#eef6f1] px-2.5 py-0.5 text-[11px] font-bold text-[#3f8f66]">
            Save ${savings!.toFixed(2)}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * A 2fr/1fr row where the WIDE (lead) track and the NARROW (secondary) track
 * genuinely swap sides for `align="right"` — not just a visual reorder.
 *
 * A CSS `order` swap was tried first and is wrong here: grid auto-placement
 * assigns items to tracks in order-modified order, so giving the lead
 * `order: 2` moves it into the grid's *second* track — which is still only
 * 1fr wide, since track widths are fixed by grid-template-columns, not by
 * which item lands in them. The result was the lead shrinking into the
 * narrow column and the secondary stack inflating into the wide one on every
 * alternate store — backwards from the intent ("the big one always holds a
 * single item, it just changes which side it's on"). Flipping both the
 * template (`2fr 1fr` vs `1fr 2fr`) and the render order together avoids
 * that: whichever track is 2fr, the lead is the element placed into it, and
 * DOM order matches visual order (no reliance on `order` for a11y either).
 */
function AsymmetricRow({
  align,
  lead,
  secondary,
}: {
  align: "left" | "right";
  lead: React.ReactNode;
  secondary: React.ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-5 ${align === "right" ? "md:grid-cols-[1fr_2fr]" : "md:grid-cols-[2fr_1fr]"}`}
    >
      {align === "right" ? (
        <>
          {secondary}
          {lead}
        </>
      ) : (
        <>
          {lead}
          {secondary}
        </>
      )}
    </div>
  );
}

/**
 * One store's block on the /products listing: a store header (logo + name +
 * its category pills + short description, when it has them, all linking to
 * the store page) above a column-based layout, not a fixed-size grid — the
 * lead item (a bundle, when the store has one, since getProductCatalogGroups
 * sorts bundle-first) always takes 2 column-units:
 *  - 1 item: the lead alone, capped to a sensible width.
 *  - 2 items: an even 50/50 split, both at lead size.
 *  - 3 items: lead (2 units) beside the other two stacked in the 3rd unit.
 *  - 4+ items: lead (2 units) beside every remaining item listed top to
 *    bottom in the other unit, in a compact thumbnail+text row rather than a
 *    shrunk full-image card — divided so the stack's total height matches
 *    the lead's height instead of running past it.
 * Every card is the same width within its own tier — no item is a different
 * size from its neighbors at the same tier, per the approved design.
 *
 * `align` flips which side the lead column sits on (desktop only — the grid
 * collapses to one column on mobile regardless, via `AsymmetricRow`) so a
 * page of many stores doesn't read as one long column of left-heavy blocks.
 */
export function StoreProductSpotlight({
  group,
  align = "left",
}: {
  group: StoreCatalogGroup;
  align?: "left" | "right";
}) {
  const items = group.items;
  if (items.length === 0) return null;

  const [lead, ...rest] = items;

  return (
    <section className="flex flex-col gap-4 border-b border-border pb-10 last:border-b-0">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/stores/${group.store.slug}`}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-text hover:text-brand-primary"
        >
          {group.store.logo && (
            <RemoteImage
              src={group.store.logo}
              alt={group.store.name}
              sizes="28px"
              className="h-7 w-7 rounded-full bg-surface-muted"
              imgClassName="object-contain"
            />
          )}
          {group.store.name}
          <span aria-hidden="true">→</span>
        </Link>

        {(!!group.store.categories?.length || group.store.shortDescription) && (
          <div className="flex flex-wrap items-center gap-2 pl-9 text-xs text-text-muted">
            {group.store.categories?.map((c) => (
              <Link
                key={c._id}
                href={`/category/${c.slug}`}
                className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-text-muted hover:text-brand-primary"
              >
                {c.name}
              </Link>
            ))}
            {group.store.shortDescription && (
              <span className="line-clamp-1">{group.store.shortDescription}</span>
            )}
          </div>
        )}
      </div>

      {items.length === 1 && (
        <div className="max-w-md">
          <LeadCard item={lead} priority />
        </div>
      )}

      {items.length === 2 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <LeadCard item={lead} priority />
          <LeadCard item={rest[0]} />
        </div>
      )}

      {items.length === 3 && (
        <AsymmetricRow
          align={align}
          lead={<LeadCard item={lead} isFeatured priority />}
          secondary={
            <div className="flex flex-col gap-4">
              {rest.map((item) => (
                <SecondaryCard key={`${item.kind}-${item.data._id}`} item={item} />
              ))}
            </div>
          }
        />
      )}

      {items.length >= 4 && (
        <AsymmetricRow
          align={align}
          lead={<LeadCard item={lead} isFeatured priority />}
          secondary={
            <div className="flex flex-col gap-4">
              {rest.map((item) => (
                <CompactRow key={`${item.kind}-${item.data._id}`} item={item} />
              ))}
            </div>
          }
        />
      )}
    </section>
  );
}
