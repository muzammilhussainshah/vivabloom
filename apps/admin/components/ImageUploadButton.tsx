"use client";

import { useId, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function ImageUploadButton({
  label = "Upload image",
  prefix,
  onUploaded,
}: {
  label?: string;
  /** Blob storage folder for this form, e.g. "stores" — keeps uploads from different forms browsable/separate. */
  prefix: string;
  onUploaded: (url: string) => void;
}) {
  const inputId = useId();
  const [isPending, setIsPending] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    // The file picker's `accept` attribute only filters the browse dialog —
    // a drag-and-drop can carry any file type, so this check covers both paths.
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 5MB).");
      return;
    }

    setIsPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("prefix", prefix);
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsPending(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Let the same file be re-selected later (e.g. after fixing an error).
    e.target.value = "";
    if (file) void uploadFile(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
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
