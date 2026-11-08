"use client";

import { useEffect } from "react";

/**
 * When returning from a session's full-page view (as opposed to the
 * right-side drawer), scrolls the row you were just reading back into view
 * so you don't lose your place in a long, filtered table.
 */
export function HighlightScroller({ targetId }: { targetId?: string }) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(`session-row-${targetId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [targetId]);

  return null;
}
