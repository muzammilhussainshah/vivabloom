import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/products" className="text-sm text-brand-primary hover:underline">
        ← All products
      </Link>
      <h1 className="text-2xl font-semibold">Edit Product</h1>
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
          price: product.price,
          originalPrice: product.originalPrice,
          productUrl: product.productUrl,
          isActive: product.isActive ?? true,
        }}
      />
    </div>
  );
}
