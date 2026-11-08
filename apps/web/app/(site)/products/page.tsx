import type { Metadata } from "next";
import { getProductCatalogGroups } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { StoreProductSpotlight } from "@/components/StoreProductSpotlight";
import { breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = { title: "Products", alternates: { canonical: "/products" } };

export default async function ProductsPage() {
  const groups = await getProductCatalogGroups();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Products", path: "/products" }])} />

      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-extrabold text-brand-accent sm:text-5xl">Products</h1>
        <p className="text-sm text-text-muted">Hand-picked products and bundles at prices we&apos;ve vetted, straight from the merchant.</p>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-text-muted">No products yet — check back shortly.</p>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group, i) => (
            <StoreProductSpotlight key={group.store._id} group={group} align={i % 2 === 0 ? "left" : "right"} />
          ))}
        </div>
      )}
    </div>
  );
}
