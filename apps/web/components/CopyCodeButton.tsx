"use client";

import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the code
      // is still visible in plain text right next to this button either way.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center gap-1 rounded-base border px-2 py-1 text-xs font-medium transition-colors ${
        copied
          ? "border-brand-accent text-brand-accent"
          : "border-border text-text-muted hover:border-brand-primary hover:text-brand-primary"
      }`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
