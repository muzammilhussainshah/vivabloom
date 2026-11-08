import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connectToDatabase, Store, Category } from "@monocoupon/db";
import { StoreForm } from "../../StoreForm";
import { updateStore } from "../../actions";

export const metadata: Metadata = { title: "Edit Store" };

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const [store, categories] = await Promise.all([
    Store.findById(id).lean(),
    Category.find({}).sort({ sortOrder: 1 }).lean(),
  ]);
  if (!store) notFound();

  const action = updateStore.bind(null, id);

  /** Formats a Mongo Date (or undefined) as yyyy-mm-dd for <input type="date">. */
  function toDateInput(date: Date | null | undefined): string {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/stores" className="text-sm text-brand-primary hover:underline">
        ← All stores
      </Link>
      <h1 className="text-2xl font-semibold">Edit Store</h1>
      <StoreForm
        action={action}
        submitLabel="Save Changes"
        categoryOptions={categories.map((c) => ({ id: String(c._id), name: c.name }))}
        initialData={{
          name: store.name,
          slug: store.slug,
          logo: store.logo,
          description: store.description,
          shortDescription: store.shortDescription,
          categoryIds: (store.categories ?? []).map((c) => String(c)),
          websiteUrl: store.websiteUrl,
          faqs: (store.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
          offer: {
            mechanic: (store.offer?.mechanic as "" | "link" | "code" | "popup") ?? "",
            code: store.offer?.code ?? "",
            affiliateUrl: store.offer?.affiliateUrl ?? "",
            discountLabel: store.offer?.discountLabel ?? "",
            discountSuffix: store.offer?.discountSuffix ?? "",
            offerSubline: store.offer?.offerSubline ?? "",
            lede: store.offer?.lede ?? "",
            verifiedDate: toDateInput(store.offer?.verifiedDate),
            nextCheckDate: toDateInput(store.offer?.nextCheckDate),
            verifierName: store.offer?.verifierName ?? "",
            usageCount: store.offer?.usageCount ?? "",
            trustChecks: store.offer?.trustChecks ?? [],
            notOffered: store.offer?.notOffered ?? [],
            proofScreenshots: store.offer?.proofScreenshots ?? [],
          },
          isActive: store.isActive ?? true,
          isFeatured: store.isFeatured ?? false,
          sortOrder: store.sortOrder ?? 0,
          seoTitle: store.seoTitle,
          seoDescription: store.seoDescription,
          rating: store.stats?.rating ?? 0,
        }}
      />
    </div>
  );
}
