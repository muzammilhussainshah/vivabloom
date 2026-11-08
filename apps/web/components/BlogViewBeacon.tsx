"use client";

import { useEffect } from "react";
import { sendBeacon } from "@/lib/beacon";

const STORAGE_PREFIX = "mc_viewed_";

/**
 * Bumps every published blog post in a category by a mocked random amount,
 * once per visitor to that category's store page. A localStorage flag is
 * set before the beacon fires, so refreshing or revisiting the same page
 * never double-counts — only the first visit per browser does. (The blog
 * post's own page uses BlogViewCounter instead, which counts every real
 * pageview with no dedup.)
 */
export function BlogViewBeacon({ type, id }: { type: "category"; id: string }) {
  useEffect(() => {
    const key = `${STORAGE_PREFIX}${type}_${id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // Private browsing / storage disabled — skip rather than risk
      // incrementing on every load with no way to remember we already did.
      return;
    }
    sendBeacon("/api/blog-views", { type, id });
  }, [type, id]);

  return null;
}
