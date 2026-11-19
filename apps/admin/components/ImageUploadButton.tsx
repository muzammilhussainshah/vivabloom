"use client";

import { useId, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function ImageUploadButton({
  label = "Upload image",
  prefix,
  onUploaded,
  onUploadedBatch,
  multiple = false,
}: {
  label?: string;
  /** Blob storage folder for this form, e.g. "stores" — keeps uploads from different forms browsable/separate. */
  prefix: string;
  /** Called once per successfully uploaded file (several times when `multiple`). */
  onUploaded?: (url: string) => void;
  /** Called once after a pick/drop finishes, with every URL that uploaded successfully, in order. */
  onUploadedBatch?: (urls: string[]) => void;
  /** Allow picking / dropping several files at once; they upload one after another. */
  multiple?: boolean;
}) {
  const inputId = useId();
  const [isPending, setIsPending] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    setIsPending(true);
    setError(null);
    const urls: string[] = [];
    for (const file of files) {
      const result = await uploadFile(file);
      if (!result.ok) {
        setError(files.length > 1 ? `${file.name}: ${result.error}` : result.error);
        break;
      }
      urls.push(result.url);
      onUploaded?.(result.url);
    }
    if (urls.length) onUploadedBatch?.(urls);
    setIsPending(false);
  }

  /** Uploads one file; returns its URL, or an error message. */
  async function uploadFile(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
    // The file picker's `accept` attribute only filters the browse dialog —
    // a drag-and-drop can carry any file type, so this check covers both paths.
    if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Unsupported file type. Use PNG, JPEG, WebP, or GIF." };
    if (file.size > MAX_BYTES) return { ok: false, error: "File is too large (max 5MB)." };

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("prefix", prefix);
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      return { ok: true, url: data.url as string };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Let the same file be re-selected later (e.g. after fixing an error).
    e.target.value = "";
    if (files.length) void uploadFiles(multiple ? files : files.slice(0, 1));
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!isPending) setIsDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragActive(false);
    if (isPending) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) void uploadFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple={multiple}
        onChange={handleChange}
        disabled={isPending}
        className="hidden"
      />
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`self-start rounded-base border px-3 py-1.5 text-xs font-medium transition-colors ${
          isDragActive ? "border-brand-primary bg-brand-primary/10" : "border-border hover:bg-surface-muted"
        } ${isPending ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        {isPending ? "Uploading…" : isDragActive ? "Drop to upload" : `${label} (or drag & drop)`}
      </label>
      {error && <p className="text-xs text-brand-secondary">{error}</p>}
    </div>
  );
}
