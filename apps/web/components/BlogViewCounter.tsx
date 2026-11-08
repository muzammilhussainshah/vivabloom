"use client";

import { useEffect, useState } from "react";

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 7s2.7-5 6-5 6 5 6 5-2.7 5-6 5-6-5-6-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** "1,234" under 10k, "12.3K" beyond — keeps the pill compact once a popular post racks up views. */
function formatViews(views: number) {
  if (views >= 10000) return `${(views / 1000).toFixed(1)}K`;
  return views.toLocaleString("en-US");
}

/**
 * Live blog view count. Unlike the mocked category bump (BlogViewBeacon,
 * deduped per browser via localStorage), every mount here is a real view —
 * no dedup, so a same-user refresh counts again too. The page still renders
 * the ISR-cached `initialViews` first (no layout shift, no blocking call on
 * first paint); this bumps it optimistically by 1 on mount, then overwrites
 * with the authoritative count echoed back by the increment request so
 * concurrent traffic from other visitors stays accurate.
 */
export function BlogViewCounter({ slug, initialViews }: { slug: string; initialViews: number }) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    setViews((v) => v + 1);

    let cancelled = false;
    fetch("/api/blog-views", {
      method: "POST",
      body: JSON.stringify({ type: "blog", id: slug }),
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.views === "number") setViews(data.views);
      })
      .catch(() => {
        // Analytics must never surface to the visitor — keep the optimistic count.
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <EyeIcon />
      {formatViews(views)} views
    </span>
  );
}
