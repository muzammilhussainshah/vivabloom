"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/slugify";
import { AIGenerateImageButton } from "@/components/AIGenerateImageButton";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { categoryImagePrompt } from "@/lib/ai/prompts";
import type { ActionState } from "./actions";

export interface CategoryFormInitialData {
  name: string;
  slug: string;
  description?: string;
  icon?: string | null;
  image?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** Store context carried over from the Categories list's "Generate by AI" panel, used to sharpen the Generate All prompt. Never persisted — session-only. */
export interface CategoryAIContext {
  storeUrl?: string;
  siteTitle?: string;
  siteDescription?: string;
}

export function CategoryForm({
  action,
  initialData,
  aiContext,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: CategoryFormInitialData;
  aiContext?: CategoryAIContext;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug || (initialData?.name ? slugify(initialData.name) : ""));
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [image, setImage] = useState(initialData?.image ?? "");
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription ?? "");
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function generateAll() {
    if (!name.trim()) {
      setGenerateError("Enter a name first.");
      return;
    }
    setIsGeneratingContent(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ai/generate-category-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ...aiContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (data.description) setDescription(data.description);
      if (data.seoTitle) setSeoTitle(data.seoTitle);
      if (data.seoDescription) setSeoDescription(data.seoDescription);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGeneratingContent(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-base border border-brand-primary/40 bg-surface-muted p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-primary">Generate with AI</h2>
            <p className="text-xs text-text-muted">
              Fills description and SEO fields from the name above{aiContext?.storeUrl ? " (using the store context you started from)" : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={generateAll}
            disabled={isGeneratingContent}
            className="shrink-0 rounded-base bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {isGeneratingContent ? "Generating…" : "✨ Generate All with AI"}
          </button>
        </div>
        {generateError && <p className="text-xs text-brand-secondary">{generateError}</p>}
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
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="icon" className="text-sm font-medium">
          Icon URL <span className="text-text-muted">(optional — a small icon, distinct from the tile image below)</span>
        </label>
        <input
          id="icon"
          name="icon"
          type="url"
          defaultValue={initialData?.icon ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="image" className="text-sm font-medium">
            Category image <span className="text-text-muted">(optional — square tile image)</span>
          </label>
          <div className="flex items-center gap-2">
            <ImageUploadButton prefix="categories" onUploaded={setImage} />
            {name.trim() ? (
              <AIGenerateImageButton
                label="Generate Category Image"
                task="categoryImage"
                getPrompt={() => categoryImagePrompt({ name, description })}
                onGenerated={setImage}
              />
            ) : (
              <span
                title="Enter a name first"
                className="self-start rounded-base border border-border px-3 py-1.5 text-xs font-medium text-text-muted opacity-60"
              >
                Generate Category Image
              </span>
            )}
          </div>
        </div>
        <input
          id="image"
          name="image"
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        {!name.trim() && <p className="text-xs text-text-muted">Enter a name to enable AI image generation.</p>}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/AI-generated URL
          <img src={image} alt="Category image preview" className="mt-1 h-32 w-32 rounded-base object-cover" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="seoTitle" className="text-sm font-medium">
            SEO title <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sortOrder" className="text-sm font-medium">
            Sort order
          </label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={initialData?.sortOrder ?? 0}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="seoDescription" className="text-sm font-medium">
          SEO description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={2}
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={initialData?.isActive ?? true} />
        Active (visible on the public site)
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
