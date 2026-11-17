import Link from "next/link";
import type { Metadata } from "next";
import { getAllStores } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { RemoteImage } from "@/components/RemoteImage";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 300;

export const metadata: Metadata = { title: "All Stores", alternates: { canonical: "/stores" } };

/**
 * Public listing of every store, linked from the header nav. Does not touch
 * /stores/[slug] or its PPC sitelink-variant routes — those keep their own
 * ad-funnel behavior untouched.
 */
export default async function StoresPage() {
  const stores = await getAllStores();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Stores", path: "/stores" }])} />
      <JsonLd data={itemListJsonLd(stores.map((s) => ({ name: s.name, path: `/stores/${s.slug}` })))} />
      <PageHeader
        eyebrow="Stores"
        title="All Stores"
        description="Every merchant we track, each with one hand-checked offer and the products it applies to."
      />
      {stores.length === 0 ? (
        <p className="text-sm text-text-muted">No stores yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {stores.map((store) => (
            <Link
              key={store._id}
              href={`/stores/${store.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 hover:shadow-[0_10px_28px_-12px_rgb(0_0_0/0.18)]"
            >
              {store.logo && (
                <RemoteImage
                  src={store.logo}
                  alt={store.name}
                  sizes="150px"
                  className="h-12 w-12 overflow-hidden rounded-xl border border-border"
                  imgClassName="object-contain"
                />
              )}
              <div className="flex flex-col gap-1">
                <p className="font-serif text-lg font-semibold text-text transition-colors group-hover:text-brand-primary">{store.name}</p>
                {store.shortDescription && <p className="line-clamp-2 text-sm text-text-muted">{store.shortDescription}</p>}
              </div>
              {store.categories && store.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {store.categories.map((c) => (
                    <span key={c._id} className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
              <span className="mt-auto inline-flex items-center gap-1.5 border-t border-border pt-3 text-sm font-semibold text-brand-primary">
                View store
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
