import Link from "next/link";
import type { Metadata } from "next";
import { getAllStores } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { RemoteImage } from "@/components/RemoteImage";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:px-8">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Stores", path: "/stores" }])} />
      <JsonLd data={itemListJsonLd(stores.map((s) => ({ name: s.name, path: `/stores/${s.slug}` })))} />
      <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">All Stores</h1>
      {stores.length === 0 ? (
        <p className="text-sm text-text-muted">No stores yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {stores.map((store) => (
            <Link
              key={store._id}
              href={`/stores/${store.slug}`}
              className="rounded-base border border-border bg-surface p-4 hover:border-brand-primary"
            >
              {store.logo && (
                <RemoteImage
                  src={store.logo}
                  alt={store.name}
                  sizes="150px"
                  className="mb-2 h-10 w-36"
                  imgClassName="object-contain object-left"
                />
              )}
              <p className="font-medium">{store.name}</p>
              <p className="mt-1 text-sm text-text-muted">{store.shortDescription}</p>
              {store.categories && store.categories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {store.categories.map((c) => (
                    <span key={c._id} className="rounded-base bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
