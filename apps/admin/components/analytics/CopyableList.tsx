"use client";

import { useState } from "react";

/**
 * Read-only textarea of values (one per line) plus a copy button — for
 * pasting a block of IPs straight into Google Ads' campaign IP-exclusion
 * list.
 */
export function CopyableList({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  const [copied, setCopied] = useState(false);
  const text = values.join("\n");

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  if (values.length === 0) {
    return <p className="text-sm text-text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        readOnly
        value={text}
        rows={Math.min(10, values.length)}
        className="w-full resize-y rounded-base border border-border bg-surface-muted p-3 font-mono text-xs focus:border-brand-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="w-fit rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover"
      >
        {copied ? "Copied!" : `Copy ${values.length} IP${values.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
