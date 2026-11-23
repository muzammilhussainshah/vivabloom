"use client";

import { useActionState, useState } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { GalleryEditor } from "@/components/GalleryEditor";
import { slugify } from "@/lib/slugify";
import type { ActionState } from "./actions";

export interface StoreOption {
  id: string;
  name: string;
}

export interface ProductFormInitialData {
  store: string;
  name: string;
  slug: string;
  description?: string;
  image: string;
  gallery?: string[];
  price: number;
  originalPrice?: number | null;
  productUrl: string;
  isActive: boolean;
}

export function ProductForm({
  action,
  storeOptions,
  initialData,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  storeOptions: StoreOption[];
  initialData?: ProductFormInitialData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [image, setImage] = useState(initialData?.image ?? "");
  const [gallery, setGallery] = useState<string[]>(initialData?.gallery ?? []);

  // Picking several files in the main uploader: the first becomes the main
  // image, the rest go to "More images" — so it works whichever button is used.
  // ★ Cover on a gallery image: it becomes the main image and the old main
  // image takes its place in the gallery, so nothing is lost.
  function makeCover(url: string) {
    const oldCover = image.trim();
    setGallery((prev) =>
      oldCover && oldCover !== url ? prev.map((u) => (u === url ? oldCover : u)) : prev.filter((u) => u !== url)
    );
    setImage(url);
  }

  function handleMainUpload(urls: string[]) {
    const [first, ...rest] = urls;
    setImage(first);
    if (rest.length) setGallery((prev) => [...prev, ...rest.filter((u) => !prev.includes(u))].slice(0, 12));
  }
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="store" className="text-sm font-medium">
          Store
        </label>
        <select
          id="store"
          name="store"
          required
          defaultValue={initialData?.store ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="" disabled>
            Select a store…
          </option>
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Wireless Earbuds Pro"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
        />
        <p className="text-xs text-text-muted">Powers the product's detail page: /products/{slug || "…"}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={initialData?.description ?? ""}
          placeholder="What makes this product worth the discount — shown on its detail page."
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="image" className="text-sm font-medium">
            Cover image URL
          </label>
          <ImageUploadButton label="Upload main image" prefix="products" onUploadedBatch={handleMainUpload} multiple />
        </div>
        <input
          id="image"
          name="image"
          type="url"
          required
          placeholder="https://example.com/image.png, or upload one above"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        {image && (
          <span className="relative mt-1 inline-block self-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/uploaded URL */}
            <img src={image} alt="Cover image preview" className="h-24 w-24 rounded-base border-2 border-brand-primary bg-surface object-contain" />
            <span className="absolute left-1 top-1 rounded bg-brand-primary px-1.5 text-[10px] font-semibold text-white">★ Cover</span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          More images <span className="text-text-muted">(optional)</span>
        </span>
        <GalleryEditor name="gallery" prefix="products" images={gallery} onChange={setGallery} onMakeCover={makeCover} />
        <p className="text-xs text-text-muted">
          Tip: you can select several images at once in either uploader. In the main uploader the first one becomes the
          cover image and the rest are added here.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium">
            Price
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={initialData?.price ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="originalPrice" className="text-sm font-medium">
            Original price <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="originalPrice"
            name="originalPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initialData?.originalPrice ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="productUrl" className="text-sm font-medium">
          Product URL
        </label>
        <input
          id="productUrl"
          name="productUrl"
          type="url"
          required
          defaultValue={initialData?.productUrl ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={initialData?.isActive ?? true} />
        Active
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>

      {state?.error && <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>}
    </form>
  );
}
