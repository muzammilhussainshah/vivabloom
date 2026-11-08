"use client";

import { useActionState, useState } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { slugify } from "@/lib/slugify";
import type { ActionState } from "./actions";

export interface StoreOption {
  id: string;
  name: string;
}

export interface BundleFormInitialData {
  store: string;
  name: string;
  slug: string;
  description?: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  extraDiscountPercent?: number | null;
  bundleUrl: string;
  bundleDetailsUrl: string;
  isActive: boolean;
}

export function BundleForm({
  action,
  storeOptions,
  initialData,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  storeOptions: StoreOption[];
  initialData?: BundleFormInitialData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [image, setImage] = useState(initialData?.image ?? "");
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
          placeholder="Skincare Starter Bundle"
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
        <p className="text-xs text-text-muted">
          Powers the bundle&apos;s detail page: /products/{slug || "…"} (shares the products URL space — must be unique across products and bundles)
        </p>
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
          placeholder="What's in this bundle and why it's worth it — shown on its detail page."
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="image" className="text-sm font-medium">
            Image URL
          </label>
          <ImageUploadButton prefix="bundles" onUploaded={setImage} />
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
          // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/uploaded URL
          <img src={image} alt="Bundle image preview" className="mt-1 h-14 w-auto max-w-48 rounded-base border border-border object-contain" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium">
            Bundle price
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
            Price if bought separately <span className="text-text-muted">(optional)</span>
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
        <label htmlFor="extraDiscountPercent" className="text-sm font-medium">
          Extra discount % <span className="text-text-muted">(optional — marketing badge only, doesn't affect price)</span>
        </label>
        <input
          id="extraDiscountPercent"
          name="extraDiscountPercent"
          type="number"
          step="1"
          min="0"
          max="100"
          placeholder="e.g. 7"
          defaultValue={initialData?.extraDiscountPercent ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        <p className="text-xs text-text-muted">
          Highlights &quot;Get an extra X% off&quot; on the bundle promo. The bundle price above should already include
          this discount — this field only controls the callout text.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bundleUrl" className="text-sm font-medium">
          Bundle URL <span className="text-text-muted">(affiliate/purchase link)</span>
        </label>
        <input
          id="bundleUrl"
          name="bundleUrl"
          type="url"
          required
          defaultValue={initialData?.bundleUrl ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="bundleDetailsUrl" className="text-sm font-medium">
          Bundle details URL
        </label>
        <input
          id="bundleDetailsUrl"
          name="bundleDetailsUrl"
          type="url"
          required
          defaultValue={initialData?.bundleDetailsUrl ?? ""}
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

      {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
    </form>
  );
}
