"use client";

import { useState } from "react";

const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "48h", label: "Last 48 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
] as const;

const RANGE_VALUES = new Set(RANGE_OPTIONS.map((o) => o.value));

/**
 * Duration select for a filter form: a preset dropdown (24h/48h/7d/30d)
 * whose choice alone determines the date bound server-side, plus a "Custom"
 * option that reveals From/To date fields — hidden otherwise so they never
 * get submitted (and override the preset) unless the admin actually wants
 * a custom range.
 */
export function RangeControls({
  range,
  from,
  to,
  idPrefix = "",
}: {
  range?: string;
  from?: string;
  to?: string;
  idPrefix?: string;
}) {
  const [selected, setSelected] = useState(range && RANGE_VALUES.has(range as never) ? range : "24h");
  const isCustom = selected === "custom";

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted" htmlFor={`${idPrefix}range`}>
          Duration
        </label>
        <select
          id={`${idPrefix}range`}
          name="range"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {isCustom && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted" htmlFor={`${idPrefix}from`}>
              From
            </label>
            <input
              id={`${idPrefix}from`}
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted" htmlFor={`${idPrefix}to`}>
              To
            </label>
            <input
              id={`${idPrefix}to`}
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        </>
      )}
    </>
  );
}
