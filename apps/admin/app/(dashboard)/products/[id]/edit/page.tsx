import type { Metadata } from "next";
import { FormPage, Thumb, ActiveBadge, siteUrl } from "@/components/ui";
import { notFound } from "next/navigation";
import { connectToDatabase, Product, Store } from "@monocoupon/db";
import { ProductForm } from "../../ProductForm";
import { updateProduct } from "../../actions";

export const metadata: Metadata = { title: "Edit Product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const [product, stores] = await Promise.all([
    Product.findById(id).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);
  if (!product) notFound();

  const action = updateProduct.bind(null, id);

  return (
    <FormPage
      backHref="/products"
      backLabel="All products"
      title={product.name}
      subtitle={`/products/${product.slug}`}
      media={<Thumb src={product.image} alt={product.name} size="lg" />}
      meta={<ActiveBadge active={product.isActive ?? true} />}
      viewHref={siteUrl(`/products/${product.slug}`)}
    >
      <ProductForm
        action={action}
        submitLabel="Save Changes"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
        initialData={{
          store: String(product.store),
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          image: product.image,
          gallery: product.gallery ?? [],
          price: product.price,
          originalPrice: product.originalPrice,
          productUrl: product.productUrl,
          isActive: product.isActive ?? true,
        }}
      />
    </FormPage>
  );
}
