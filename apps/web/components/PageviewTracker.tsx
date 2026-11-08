"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendBeacon } from "@/lib/beacon";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

const SCROLL_MILESTONES = [25, 50, 75, 100];

// Fires a fire-and-forget beacon on mount and on every client-side route
// change. Runs after paint, never blocks rendering and never surfaces an
// error. Also tracks passive engagement signals for the current page: time
// spent (dwell) and scroll-depth milestones reached.
export function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // The fingerprint promise is computed once per page load and cached;
    // the beacon waits for it (a few ms) but the page never does. No
    // cancellation on route change — every pageview must be reported.
    getDeviceFingerprint().then((fingerprintId) =>
      sendBeacon("/api/track", {
        fingerprintId,
        path: pathname,
        referrer: document.referrer || null,
        utmSource: searchParams.get("utm_source"),
        utmMedium: searchParams.get("utm_medium"),
        utmCampaign: searchParams.get("utm_campaign"),
        utmTerm: searchParams.get("utm_term"),
        utmContent: searchParams.get("utm_content"),
        screenWidth: window.screen?.width ?? null,
        screenHeight: window.screen?.height ?? null,
        gclid: searchParams.get("gclid"),
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        // Permissionless automation/fingerprint signals: webdriver is true in
        // undisguised Selenium/Puppeteer/Playwright; the hardware hints expose
        // headless defaults (e.g. "iPhone" UA with 0 touch points, DPR 1).
        webdriver: navigator.webdriver === true,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        maxTouchPoints: navigator.maxTouchPoints ?? null,
        devicePixelRatio: window.devicePixelRatio ?? null,
        viewportWidth: window.innerWidth || null,
        viewportHeight: window.innerHeight || null,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  useEffect(() => {
    // Dwell counts only *visible* time: the clock pauses while the tab is
    // hidden and each flush resets the accumulator, so a tab left open in the
    // background no longer inflates dwell, and a pagehide-then-close sequence
    // can't double-count the same seconds.
    let activeMs = 0;
    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    const reachedMilestones = new Set<number>();
    let ticking = false;

    // Flushing here — not only on pagehide — is what makes dwell survive on
    // iOS. Safari frequently never fires `pagehide` at all when the visitor
    // leaves the way iOS visitors actually leave (swiping to another app,
    // locking the screen, switching tabs), and even when it does fire, WebKit
    // has a long history of dropping sendBeacon during unload. Both cost us
    // the dwell event, which left iOS sessions holding a single pageview and
    // nothing else — scored as durationMs = 0 and flagged `paid_bounce` in
    // the admin even for visitors who read the page for minutes. Android
    // Chrome fires pagehide reliably, which is why the false bounces looked
    // iOS-specific. visibilitychange fires while the page is still alive, so
    // the beacon actually goes out.
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        visibleSince ??= Date.now();
      } else {
        flushDwell();
      }
    }

    // bfcache restore after a pagehide flush — restart the clock cleanly.
    function handlePageShow() {
      visibleSince = Date.now();
    }

    function currentScrollPercent() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return 100;
      return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    }

    function checkMilestones() {
      const percent = currentScrollPercent();
      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone && !reachedMilestones.has(milestone)) {
          reachedMilestones.add(milestone);
          sendBeacon("/api/engagement", { path: pathname, type: "scroll_depth", value: milestone });
        }
      }
    }

    // Plain timeout-based throttle rather than requestAnimationFrame — rAF
    // is paused in background/non-rendering tabs, which would silently drop
    // scroll tracking; a timeout keeps firing regardless of paint state.
    function handleScroll() {
      if (ticking) return;
      ticking = true;
      setTimeout(() => {
        checkMilestones();
        ticking = false;
      }, 200);
    }

    function flushDwell() {
      if (visibleSince != null) {
        activeMs += Date.now() - visibleSince;
        visibleSince = document.visibilityState === "visible" ? Date.now() : null;
      }
      if (activeMs > 0) {
        sendBeacon("/api/engagement", { path: pathname, type: "dwell", value: activeMs });
      }
      activeMs = 0;
    }

    // Covers pages short enough to need no scrolling at all (100% is
    // already visible on load).
    checkMilestones();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", flushDwell);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);

    // Cleanup runs when the pathname/query changes (internal navigation) —
    // pagehide/visibilitychange cover the tab-close/background case, where
    // cleanup never runs. Every path funnels through flushDwell, which zeroes
    // the accumulator on the way out, so overlapping triggers (hidden, then
    // pagehide, then unmount) can't double-count the same seconds or emit a
    // second empty beacon.
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", flushDwell);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
      checkMilestones();
      flushDwell();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  return null;
}
