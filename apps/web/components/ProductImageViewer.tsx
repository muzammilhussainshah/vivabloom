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
};

/**
 * Product image with zoom:
 * - Desktop: hovering magnifies 2x around the cursor (mouse only — touch
 *   devices skip it so scrolling the page isn't hijacked).
 * - Click/tap (or the expand button) opens a full-screen viewer: zoom with
 *   the +/- buttons, mouse wheel or double-click; drag to pan when zoomed;
 *   Esc or the backdrop closes it.
 */
export function ProductImageViewer({ src, alt }: { src: string; alt: string }) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
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
            src={src}
            alt={alt}
            fill
            priority
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
      </div>

      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const setZoomClamped = useCallback((next: number) => {
    const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    if (z === 1) setPan({ x: 0, y: 0 });
  }, []);

  // Esc to close, +/- keys to zoom; lock page scroll while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoomClamped(zoom + STEP);
      if (e.key === "-") setZoomClamped(zoom - STEP);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, setZoomClamped, zoom]);

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

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
        <p className="line-clamp-1 text-sm font-medium text-white/80">{alt}</p>
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

      <div
        ref={stageRef}
        className={`relative flex-1 touch-none select-none overflow-hidden ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setZoomClamped(zoom > 1 ? 1 : 2.5)}
        onClick={(e) => {
          // A plain click on the empty backdrop (not a drag, not the image) closes.
          if (e.target === e.currentTarget && !drag.current?.moved && zoom === 1) onClose();
        }}
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
          <Image src={src} alt={alt} fill sizes="100vw" className="pointer-events-none object-contain" draggable={false} />
        </div>
      </div>

      <p className="pb-4 text-center text-xs text-white/50">
        Scroll or double-click to zoom · Drag to move · Esc to close
      </p>
    </div>
  );
}
