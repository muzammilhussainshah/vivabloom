"use client";

import { useState } from "react";
import { ImageUploadButton } from "./ImageUploadButton";

const MAX_IMAGES = 12;

/**
 * Edits a list of extra image URLs (e.g. a product's gallery): upload several
 * at once, add by URL, reorder with ←/→, remove with ×, and (when
 * `onMakeCover` is given) promote one to the cover/main image with ★. Submits as repeated
 * hidden inputs named `name`, so the server action reads them with
 * `formData.getAll(name)` in display order.
 */
export function GalleryEditor({
  name,
  prefix,
  images,
  onChange,
  onMakeCover,
}: {
  name: string;
  /** Blob storage folder for uploads, e.g. "products". */
  prefix: string;
  /** Controlled by the parent form, so the main-image uploader can add to it too. */
  images: string[];
  onChange: (next: string[] | ((prev: string[]) => string[])) => void;
  /** Promote a gallery image to the cover/main image (the parent swaps the old cover into its place). */
  onMakeCover?: (url: string) => void;
}) {
  const setImages = onChange;
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const full = images.length >= MAX_IMAGES;

  function add(url: string) {
    setImages((prev) => (prev.includes(url) || prev.length >= MAX_IMAGES ? prev : [...prev, url]));
  }

  function move(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addFromUrl() {
    const url = urlDraft.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setUrlError("Enter a valid image URL.");
      return;
    }
    setUrlError(null);
    add(url);
    setUrlDraft("");
  }

  const btn =
    "flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-text shadow hover:bg-white disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2">
      {images.map((url) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}

      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <li key={url} className="group relative h-24 w-24 overflow-hidden rounded-base border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/uploaded URL */}
              <img src={url} alt={`Gallery image ${i + 1}`} className="h-full w-full object-contain" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">
                {i + 2}
              </span>
              {onMakeCover && (
                <button
                  type="button"
                  onClick={() => onMakeCover(url)}
                  title="Make this the cover image"
                  aria-label="Make this the cover image"
                  className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-text opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100 focus:opacity-100"
                >
                  ★ Cover
                </button>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button type="button" className={btn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">
                  ←
                </button>
                <button
                  type="button"
                  className={`${btn} text-red-600`}
                  onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  aria-label="Remove image"
                >
                  ×
                </button>
                <button type="button" className={btn} onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Move right">
                  →
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No extra images yet.</p>
      )}

      <div className="flex flex-wrap items-start gap-2">
        {!full && <ImageUploadButton label="Upload more images" prefix={prefix} onUploaded={add} multiple />}
        <div className="flex min-w-64 flex-1 gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromUrl();
              }
            }}
            placeholder="…or paste an image URL"
            disabled={full}
            className="flex-1 rounded-base border border-border bg-surface px-3 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={addFromUrl}
            disabled={full || !urlDraft.trim()}
            className="rounded-base border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
      {urlError && <p className="text-xs text-brand-secondary">{urlError}</p>}
      <p className="text-xs text-text-muted">
        {images.length}/{MAX_IMAGES} extra images · shown after the cover image in the product page gallery. Hover a
        thumbnail to reorder, remove{onMakeCover ? ", or click ★ Cover to make it the cover image" : ""}.
      </p>
    </div>
  );
}
