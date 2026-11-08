"use client";

import { useEffect, useState } from "react";

function format(iso: string, timeZone?: string) {
  const date = new Date(iso);
  // The year is only worth its width when it isn't the current one.
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  };
  try {
    return date.toLocaleString("en-US", { ...opts, ...(timeZone ? { timeZone } : {}) });
  } catch {
    // Unknown/invalid IANA name — fall back to the viewer's local time.
    return date.toLocaleString("en-US", opts);
  }
}

/**
 * Event timestamp shown in two clocks: the visitor's local time (from the
 * IP-derived timezone recorded with the event) and the admin's own system
 * time. Rendered after mount so the server (UTC) and the admin's browser
 * never disagree during hydration.
 */
export function TimeCell({ iso, visitorTimeZone }: { iso: string; visitorTimeZone?: string | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="text-text-muted">{format(iso, "UTC")} UTC</span>;
  }

  const yours = format(iso);
  const theirs = visitorTimeZone ? format(iso, visitorTimeZone) : null;
  return (
    <span className="flex flex-col gap-0.5">
      {theirs && theirs !== yours ? (
        <>
          <span title="Visitor's local time">
            {theirs} <span className="text-[10px] text-text-muted">{visitorTimeZone}</span>
          </span>
          <span className="text-[11px] text-text-muted" title="Your time">
            you: {yours}
          </span>
        </>
      ) : (
        <span title={visitorTimeZone ? "Same clock as yours" : "Your time"}>
          {yours}
          {visitorTimeZone && <span className="ml-1 text-[10px] text-text-muted">{visitorTimeZone}</span>}
        </span>
      )}
    </span>
  );
}

/** Header annotation naming the admin's detected timezone. */
export function TimeZoneHeaderNote() {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
  }, []);
  return (
    <span className="block text-[10px] font-normal normal-case text-text-muted">
      visitor local · yours{tz ? ` (${tz})` : ""}
    </span>
  );
}
