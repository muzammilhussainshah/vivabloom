"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  close: "M18 6 6 18M6 6l12 12",
  plus: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.3-4.3M11 8v6M8 11h6",
  minus: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.3-4.3M8 11h6",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  prev: "M15 18l-6-6 6-6",
  next: "M9 18l6-6-6-6",
};

/**
 * Product image gallery with zoom:
 * - Main image with thumbnails underneath and ‹ › arrows when there's more
 *   than one image.
 * - Desktop: hovering magnifies 2x around the cursor (mouse only — touch
 *   devices skip it so scrolling the page isn't hijacked).
 * - Click/tap (or the expand button) opens a full-screen viewer: ‹ › / arrow
 *   keys to switch images; zoom with +/- buttons, mouse wheel or double-click;
 *   drag to pan when zoomed; Esc closes it.
 */
export function ProductImageViewer({ images, alt }: { images: string[]; alt: string }) {
  const list = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const count = list.length;
  const many = count > 1;
  const go = (dir: -1 | 1) => setActive((i) => (i + dir + count) % count);
  const src = list[active] ?? list[0];

  if (!src) return null;

  const arrowBtn =
    "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface-muted/95 text-text shadow-md backdrop-blur transition-colors hover:text-brand-primary";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            setHover({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onPointerLeave={() => setHover(null)}
          aria-label={`View larger image of ${alt}`}
          className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-surface-muted"
        >
          <Image
            key={src}
            src={src}
            alt={many ? `${alt} — image ${active + 1} of ${count}` : alt}
            fill
            priority={active === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-200 ease-out"
            style={{
              transform: hover ? "scale(2)" : "scale(1)",
              transformOrigin: hover ? `${hover.x}% ${hover.y}%` : "50% 50%",
            }}
          />
          <span className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition-opacity group-hover:opacity-0 sm:inline-flex">
            <Icon d={ICONS.plus} size={14} />
            Hover to zoom · Click to expand
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open full-screen image"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted/95 text-text shadow-md backdrop-blur transition-colors hover:text-brand-primary"
        >
          <Icon d={ICONS.expand} />
        </button>

        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${arrowBtn} left-3`}>
              <Icon d={ICONS.prev} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${arrowBtn} right-3`}>
              <Icon d={ICONS.next} />
            </button>
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
          {list.map((url, i) => (
            <button
              key={url}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setActive(i)}
              className={`relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-surface-muted transition-all sm:w-20 ${
                i === active ? "border-brand-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && <Lightbox images={list} index={active} onIndexChange={setActive} alt={alt} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndexChange,
  alt,
  onClose,
}: {
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
  alt: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const count = images.length;
  const many = count > 1;

  const setZoomClamped = useCallback((next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  }, []);

  const show = useCallback(
    (dir: -1 | 1) => {
      onIndexChange((index + dir + count) % count);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    [count, index, onIndexChange]
  );

  // Esc closes, ←/→ switch images, +/- zoom; page scroll is locked while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoomClamped(zoom + STEP);
      if (e.key === "-") setZoomClamped(zoom - STEP);
      if (many && e.key === "ArrowLeft") show(-1);
      if (many && e.key === "ArrowRight") show(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, setZoomClamped, zoom, many, show]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Wheel zoom needs a non-passive listener so preventDefault stops page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setZoom((z) => {
        const next = clamp(z + (e.deltaY < 0 ? 0.25 : -0.25), MIN_ZOOM, MAX_ZOOM);
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoom === 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setPan({ x: d.panX + dx / zoom, y: d.panY + dy / zoom });
  }

  function onPointerUp() {
    drag.current = null;
  }

  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10";
  const src = images[index];

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <p className="line-clamp-1 text-sm font-medium text-white/80">
          {alt}
          {many && <span className="ml-2 tabular-nums text-white/50">{index + 1} / {count}</span>}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => setZoomClamped(zoom - STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            <Icon d={ICONS.minus} />
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-white/80">{Math.round(zoom * 100)}%</span>
          <button type="button" className={btn} onClick={() => setZoomClamped(zoom + STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            <Icon d={ICONS.plus} />
          </button>
          <button type="button" className={btn} onClick={() => setZoomClamped(1)} disabled={zoom === 1} aria-label="Reset zoom">
            <Icon d={ICONS.reset} />
          </button>
          <button type="button" className={`${btn} ml-2`} onClick={onClose} aria-label="Close">
            <Icon d={ICONS.close} />
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        <div
          ref={stageRef}
          className={`absolute inset-0 touch-none select-none overflow-hidden ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => setZoomClamped(zoom > 1 ? 1 : 2.5)}
        >
          <div
            className="absolute inset-4 transition-transform duration-150 ease-out sm:inset-10"
            style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
          >
            {/* Shown while the full-size image downloads; the opaque image covers it once loaded. */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
            />
            <Image key={src} src={src} alt={alt} fill sizes="100vw" className="pointer-events-none object-contain" draggable={false} />
          </div>
        </div>

        {many && (
          <>
            <button type="button" onClick={() => show(-1)} aria-label="Previous image" className={`${btn} absolute left-3 top-1/2 -translate-y-1/2 sm:left-6`}>
              <Icon d={ICONS.prev} size={22} />
            </button>
            <button type="button" onClick={() => show(1)} aria-label="Next image" className={`${btn} absolute right-3 top-1/2 -translate-y-1/2 sm:right-6`}>
              <Icon d={ICONS.next} size={22} />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pt-3">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => {
                onIndexChange(i);
                setZoomClamped(1);
              }}
              className={`relative aspect-square w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${
                i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-90"
              }`}
            >
              <Image src={url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <p className="py-3 text-center text-xs text-white/50">
        {many ? "← → to browse · " : ""}Scroll or double-click to zoom · Drag to move · Esc to close
      </p>
    </div>
  );
}
