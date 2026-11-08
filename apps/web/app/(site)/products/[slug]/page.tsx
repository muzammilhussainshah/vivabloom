import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCatalogSlugs, getProductBySlug } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { RemoteImage } from "@/components/RemoteImage";
import { CatalogCard } from "@/components/CatalogCard";
import { ProductDetailActions } from "@/components/ProductDetailActions";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";

export const revalidate = 1800;

export async function generateStaticParams() {
  const slugs = await getAllCatalogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: "Product not found" };
  const { item } = data;
  return {
    title: `${item.name} — ${item.store.name}`,
    description: item.description || `${item.name} at a discounted price from ${item.store.name}.`,
    alternates: { canonical: `/products/${slug}` },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { item, relatedItems } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-10 sm:px-8">
      <JsonLd data={productJsonLd({ ...item, storeName: item.store.name })} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: item.name, path: `/products/${item.slug}` },
        ])}
      />

      <Link href="/products" className="text-sm text-brand-primary hover:underline">
        ← All products
      </Link>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <RemoteImage
          src={item.image}
          alt={item.name}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-square w-full rounded-2xl border border-border bg-surface-muted"
        />

        <div className="flex flex-col gap-5">
          <Link
            href={`/stores/${item.store.slug}`}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-muted hover:border-brand-primary hover:text-brand-primary"
          >
            {item.store.logo && (
              <RemoteImage
                src={item.store.logo}
                alt={item.store.name}
                sizes="24px"
                className="h-6 w-6 rounded-full bg-surface-muted"
                imgClassName="object-contain"
              />
            )}
            {item.store.name}
          </Link>

          <h1 className="text-2xl font-bold text-text sm:text-3xl">{item.name}</h1>

          {item.description && <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">{item.description}</p>}

          {/* No googleAdsConversionId/Label here, deliberately: the "Coupon
              Outbound Click" Ads conversion is scoped to /stores/[slug] and
              its PPC variants only — trackCouponClick/trackBundleClick's
              null/null guard skips the Ads gtag ping here while their
              affiliate_click engagement beacon still fires normally. */}
          <ProductDetailActions item={item} />
        </div>
      </div>

      {relatedItems.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">You Might Also Like</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedItems.map((r) => (
              <CatalogCard key={`${r.kind}-${r.data._id}`} item={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
