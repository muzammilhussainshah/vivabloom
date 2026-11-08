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
          className="mb-4 self-start text-sm text-brand-primary hover:underline"
        >
          ← Close
        </button>
        {children}
      </div>
    </div>
  );
}
