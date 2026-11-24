"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A thumbnail that opens the full image in a lightbox when clicked
 * (Esc, the backdrop or the close button dismisses it).
 */
export function ZoomImage({ src, alt, boxClass, imgClass }: { src: string; alt: string; boxClass: string; imgClass: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${boxClass} cursor-zoom-in transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-primary`} aria-label={`View image: ${alt || "full size"}`} title="Click to enlarge">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote admin uploads; next/image would need every host allow-listed */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className={imgClass} />
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto max-h-[92vh] w-auto max-w-[min(94vw,1100px)] overflow-visible bg-transparent p-0 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        {open && (
          <figure className="relative flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[80vh] max-w-full rounded-xl bg-white object-contain shadow-2xl" />
            <figcaption className="flex max-w-full items-center gap-3 rounded-full bg-white/95 px-4 py-2 text-xs text-text shadow-lg">
              <span className="truncate font-medium">{alt}</span>
              <a href={src} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-brand-primary hover:underline">
                Open original ↗
              </a>
            </figcaption>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-text shadow-lg hover:bg-surface"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </figure>
        )}
      </dialog>
    </>
  );
}
