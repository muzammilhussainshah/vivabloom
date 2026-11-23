"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Chrome for the intercepted-route version of the session journey page —
 * slides in from the right over the still-mounted /analytics page
 * underneath, so filters/scroll position/table page aren't lost. Closing
 * (backdrop click, Escape, or the close button) just goes back in history,
 * which drops the interception and reveals /analytics again.
 */
export function SessionDrawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function close() {
    router.back();
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={close} role="presentation">
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface-muted p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Session journey"
      >
        <button
          type="button"
          onClick={close}
          className="group mb-4 inline-flex h-9 items-center gap-1.5 self-start rounded-[10px] border border-border bg-white pl-2 pr-3.5 text-sm font-medium text-text-muted shadow-[0_1px_1px_rgba(16,24,20,0.04)] transition-colors hover:border-text-muted/40 hover:text-text"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true">
            <path d="M12 15 7 10l5-5" />
          </svg>
          Close
        </button>
        {children}
      </div>
    </div>
  );
}
