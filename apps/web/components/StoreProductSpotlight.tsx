import Link from "next/link";
import { RemoteImage } from "./RemoteImage";
import { GiftIcon } from "./CouponIcons";
import type { CatalogItem, StoreCatalogGroup } from "@/lib/data";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 3.5 14.6 9 20.5 9.8 16.2 13.9 17.3 19.8 12 16.9 6.7 19.8 7.8 13.9 3.5 9.8 9.4 9 12 3.5Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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

const CARD =
  "group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-[0_16px_36px_-18px_rgb(0_0_0/0.3)]";

/** Small pills pinned to the image's top-left: discount first, then "Bundle". Kept compact so they don't cover the product. */
function ImageBadges({ percentOff, isBundle, size = "md" }: { percentOff: number | null; isBundle: boolean; size?: "sm" | "md" }) {
  if (percentOff === null && !isBundle) return null;
  const pill = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <div className={`absolute flex flex-wrap gap-1.5 ${size === "sm" ? "left-2 top-2" : "left-3 top-3"}`}>
      {percentOff !== null && (
        <span className={`rounded-full bg-brand-secondary font-bold text-white shadow-md ${pill}`}>-{percentOff}%</span>
      )}
      {isBundle && (
        <span className={`inline-flex items-center gap-1 rounded-full bg-brand-accent font-bold uppercase tracking-wide text-white shadow-md ${pill}`}>
          <GiftIcon />
          Bundle
        </span>
      )}
    </div>
  );
}

function Price({ item, large = false }: { item: CatalogItem; large?: boolean }) {
  const { data } = item;
  const { hasDiscount } = priceInfo(item);
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`font-bold tracking-tight text-text ${large ? "text-[28px]" : "text-lg"}`}>${data.price.toFixed(2)}</span>
      {hasDiscount && (
        <span className={`text-text-muted line-through ${large ? "text-base" : "text-xs"}`}>${data.originalPrice!.toFixed(2)}</span>
      )}
    </div>
  );
}

function SavePill({ savings, small = false }: { savings: number; small?: boolean }) {
  return (
    <span
      className={`w-fit rounded-full bg-brand-primary/10 font-semibold text-brand-primary ${
        small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      }`}
    >
      You save ${savings.toFixed(2)}
    </span>
  );
}

/**
 * The large card: square image with compact badges, then name, price, savings
 * and a "View deal" cue. "Best deal in store" sits in the body rather than
 * over the image, where it used to cover the product graphic's own text.
 * Used as the sole card when a store has 1-2 items, and as the featured lead
 * when it has 3+.
 */
function LeadCard({ item, isFeatured, priority }: { item: CatalogItem; isFeatured?: boolean; priority?: boolean }) {
  const { data, kind } = item;
  const { percentOff, savings } = priceInfo(item);

  return (
    <Link href={`/products/${data.slug}`} className={`${CARD} h-full`}>
      <div className="relative">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="(min-width: 768px) 45vw, 100vw"
          className="aspect-square w-full bg-surface"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority={priority}
        />
        <ImageBadges percentOff={percentOff} isBundle={kind === "bundle"} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
        {isFeatured && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">
            <StarIcon />
            Best deal in store
          </span>
        )}
        <p className="font-serif text-xl font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary sm:text-2xl">
          {data.name}
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Price item={item} large />
            {savings !== null && <SavePill savings={savings} />}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-brand-primary-hover">
            View deal
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * A smaller card stacked two-to-a-column beside the lead when a store has
 * exactly 3 items. The image area flex-grows so the pair always ends flush
 * with the lead card's bottom edge (object-cover absorbs the extra height).
 */
function SecondaryCard({ item }: { item: CatalogItem }) {
  const { data, kind } = item;
  const { percentOff, savings } = priceInfo(item);

  return (
    <Link href={`/products/${data.slug}`} className={`${CARD} flex-1`}>
      <div className="relative flex min-h-[180px] flex-1 flex-col">
        <RemoteImage
          src={data.image}
          alt={data.name}
          sizes="(min-width: 768px) 25vw, 100vw"
          className="min-h-[180px] w-full flex-1 bg-surface"
          imgClassName="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <ImageBadges percentOff={percentOff} isBundle={kind === "bundle"} size="sm" />
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="line-clamp-1 font-serif text-base font-semibold text-text transition-colors group-hover:text-brand-primary">
          {data.name}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Price item={item} />
          {savings !== null && <SavePill savings={savings} small />}
        </div>
      </div>
    </Link>
  );
}

/**
 * A compact thumbnail+text row, used for every item beside the lead once a
 * store has 4+ of them. The thumbnail is `h-20` standalone (mobile) and
 * switches to `h-full` at `md`, where it fills the row's `flex-1` share of the
 * lead-height-matching column.
 */
function CompactRow({ item }: { item: CatalogItem }) {
  const { data, kind } = item;
  const { percentOff, savings } = priceInfo(item);

  return (
    <Link
      href={`/products/${data.slug}`}
      className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-surface-muted p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all hover:border-brand-primary/30 hover:shadow-[0_12px_28px_-16px_rgb(0_0_0/0.3)] md:min-h-0 md:flex-1"
    >
      <div className="relative aspect-square h-20 shrink-0 overflow-hidden rounded-xl bg-surface md:h-full">
        <RemoteImage src={data.image} alt={data.name} sizes="96px" className="h-full w-full" imgClassName="object-cover" />
        <ImageBadges percentOff={percentOff} isBundle={false} size="sm" />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {kind === "bundle" && (
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-brand-accent">Bundle</span>
        )}
        <p className="line-clamp-2 font-serif text-base font-semibold leading-snug text-text transition-colors group-hover:text-brand-primary">
          {data.name}
        </p>
        <Price item={item} />
        {savings !== null && <SavePill savings={savings} small />}
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
    <section className="flex flex-col gap-5 border-b border-border pb-10 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {group.store.logo && (
            <RemoteImage
              src={group.store.logo}
              alt={group.store.name}
              sizes="44px"
              className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-muted"
              imgClassName="object-contain"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/stores/${group.store.slug}`}
              className="w-fit font-serif text-xl font-semibold leading-tight text-text transition-colors hover:text-brand-primary"
            >
              {group.store.name}
            </Link>
            {(!!group.store.categories?.length || group.store.shortDescription) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                {group.store.categories?.map((c) => (
                  <Link
                    key={c._id}
                    href={`/category/${c.slug}`}
                    className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 font-medium text-brand-primary transition-colors hover:bg-brand-primary/15"
                  >
                    {c.name}
                  </Link>
                ))}
                {group.store.shortDescription && <span className="line-clamp-1">{group.store.shortDescription}</span>}
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/stores/${group.store.slug}`}
          className="group/visit inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
        >
          Visit store
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform group-hover/visit:translate-x-0.5">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
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
            <div className="flex h-full flex-col gap-4">
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
            <div className="flex h-full flex-col gap-4">
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
