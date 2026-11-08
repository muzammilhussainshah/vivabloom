"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True while the returned ref's element is crossing the vertical center band
 * of the viewport — a mobile-equivalent of ":hover" for the "Get Code"/"Get
 * Deal" buttons' masked-code preview (OfferVoucher.tsx, AllDealsSection.tsx):
 * touch devices have no hover at all, so without this, the last-3-digits
 * preview those buttons show on `:hover` never appears for the large share
 * of visitors on a phone. As they scroll, whichever button is currently in
 * that center band gets the same "focused" treatment desktop's mouse-hover
 * gives for free.
 *
 * Only activates on devices that genuinely lack hover (`(hover: none)`) —
 * checked once via matchMedia rather than a screen-width breakpoint, since
 * this is specifically a hover *substitute*, not a mobile-width effect. On a
 * real hover-capable device (any mouse, even on a touchscreen laptop) this
 * hook does nothing and `isFocused` stays permanently false, leaving the
 * existing CSS-only `:hover` behavior as the only trigger there.
 *
 * The band is intentionally narrow (middle ~24% of the viewport height) so
 * normally only one button qualifies at a time while scrolling past a list.
 */
export function useCenterFocus<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: none)").matches) return;

    const observer = new IntersectionObserver(([entry]) => setIsFocused(entry.isIntersecting), {
      rootMargin: "-38% 0px -38% 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isFocused };
}
