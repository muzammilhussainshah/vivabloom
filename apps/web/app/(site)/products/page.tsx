import type { Metadata } from "next";
import { getProductCatalogGroups } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { StoreProductSpotlight } from "@/components/StoreProductSpotlight";
import { breadcrumbJsonLd } from "@/lib/seo";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 600;

export const metadata: Metadata = { title: "Products", alternates: { canonical: "/products" } };

export default async function ProductsPage() {
  const groups = await getProductCatalogGroups();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Products", path: "/products" }])} />

      <PageHeader
        eyebrow="Shop"
        title="Products"
        description="Hand-picked products and bundles at prices we've vetted, straight from the merchant."
      />

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
