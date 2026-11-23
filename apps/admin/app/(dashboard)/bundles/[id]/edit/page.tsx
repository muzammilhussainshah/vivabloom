import type { Metadata } from "next";
import { FormPage, Thumb, ActiveBadge, siteUrl } from "@/components/ui";
import { notFound } from "next/navigation";
import { connectToDatabase, Bundle, Store } from "@monocoupon/db";
import { BundleForm } from "../../BundleForm";
import { updateBundle } from "../../actions";

export const metadata: Metadata = { title: "Edit Bundle" };

export default async function EditBundlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const [bundle, stores] = await Promise.all([
    Bundle.findById(id).lean(),
    Store.find({}).sort({ name: 1 }).lean(),
  ]);
  if (!bundle) notFound();

  const action = updateBundle.bind(null, id);

  return (
    <FormPage
      backHref="/bundles"
      backLabel="All bundles"
      title={bundle.name}
      subtitle={`/products/${bundle.slug}`}
      media={<Thumb src={bundle.image} alt={bundle.name} size="lg" />}
      meta={<ActiveBadge active={bundle.isActive ?? true} />}
      viewHref={siteUrl(`/products/${bundle.slug}`)}
    >
      <BundleForm
        action={action}
        submitLabel="Save Changes"
        storeOptions={stores.map((s) => ({ id: String(s._id), name: s.name }))}
        initialData={{
          store: String(bundle.store),
          name: bundle.name,
          slug: bundle.slug,
          description: bundle.description ?? "",
          image: bundle.image,
          price: bundle.price,
          originalPrice: bundle.originalPrice,
          extraDiscountPercent: bundle.extraDiscountPercent,
          bundleUrl: bundle.bundleUrl,
          bundleDetailsUrl: bundle.bundleDetailsUrl,
          isActive: bundle.isActive ?? true,
        }}
      />
    </FormPage>
  );
}
