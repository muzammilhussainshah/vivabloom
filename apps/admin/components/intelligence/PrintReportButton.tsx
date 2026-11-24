"use client";

import { useEffect } from "react";
import { buttonStyles } from "@/components/ui";

/**
 * "Download PDF": prints the report page itself (Save as PDF), so the PDF
 * looks exactly like the web report. Collapsed details (product strengths,
 * keyword ideas, sources) are opened for printing and restored afterwards —
 * also when the admin uses Ctrl+P directly. Print styles live in globals.css
 * under [data-print-report].
 */
export function PrintReportButton({ fileName }: { fileName: string }) {
  useEffect(() => {
    const opened: HTMLDetailsElement[] = [];
    const originalTitle = document.title;
    const before = () => {
      document.querySelectorAll<HTMLDetailsElement>("[data-print-report] details:not([open])").forEach((d) => {
        d.open = true;
        opened.push(d);
      });
      // Chrome uses the document title as the suggested PDF file name.
      document.title = fileName;
    };
    const after = () => {
      opened.splice(0).forEach((d) => (d.open = false));
      document.title = originalTitle;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [fileName]);

  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles.secondary} title="Opens the print dialog — choose “Save as PDF”">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M10 3.5v9M6.5 9 10 12.5 13.5 9M4 15.5h12" />
      </svg>
      Download PDF
    </button>
  );
}
