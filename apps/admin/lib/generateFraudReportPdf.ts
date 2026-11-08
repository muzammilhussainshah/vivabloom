// Next.js bundles this route handler, which breaks pdfkit's default build —
// it reads its built-in font metrics (Helvetica.afm etc.) from disk at
// runtime using a path relative to its own module directory, and that
// resolution doesn't survive bundling. The "standalone" build embeds the
// base-14 font data instead of reading files, avoiding the problem entirely.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { FLAG_LABELS } from "@/lib/fraudSignals";
import type { FraudReportSession } from "@/lib/exportFraudReport";

// Everything below writes through pdfkit's normal *flowing* text layout
// (no absolute x/y positioning) so pdfkit's own line-wrapping and automatic
// page-breaking do the work — a manual multi-column table was tried first
// and produced overlapping text once a cell (gclid especially) wrapped to
// more than one line, since hand-computed row heights didn't account for it.

const PAGE_MARGIN = 50;
const COLOR_MUTED = "#555555";
const COLOR_HEADING = "#111111";
const COLOR_BODY = "#1f2937";
const COLOR_ACCENT = "#b91c1c";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function adParamsLine(s: FraudReportSession): string | null {
  const parts = [
    s.utmSource ? `source ${s.utmSource}` : null,
    s.utmMedium ? `medium ${s.utmMedium}` : null,
    s.utmCampaign ? `campaign ${s.utmCampaign}` : null,
    s.utmTerm ? `keyword "${s.utmTerm}"` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("  ·  ") : null;
}

function coverMessage(siteName: string, sessions: FraudReportSession[]): string {
  const gclidCount = sessions.filter((s) => s.gclid).length;
  const fpCount = sessions.filter((s) => s.fingerprintAssociates && s.fingerprintAssociates.length > 0).length;
  const distinctIps = new Set(sessions.map((s) => s.ip).filter(Boolean)).size;

  const fpLine =
    fpCount > 0
      ? ` In ${fpCount} of these, the same device/browser fingerprint reappeared under multiple different cookie identities and IP addresses within a short window — clearing cookies and rotating IPs specifically to appear as new, unrelated visitors.`
      : "";

  return (
    `I've identified a pattern of what appears to be deliberate click-fraud evasion on my Google Ads account for ${siteName}. ` +
    `This report covers ${sessions.length} suspicious session${sessions.length === 1 ? "" : "s"}, ${gclidCount} of which carried a Google Click ID (gclid), across ${distinctIps} distinct IP address${distinctIps === 1 ? "" : "es"}.` +
    `${fpLine} ` +
    `I'm requesting a manual review of the clicks detailed below and, where applicable, an invalid-click credit. Full evidence — timestamps, gclids, IP addresses, and the device-fingerprint correlation behind each flagged session — is included in this report.`
  );
}

/** Inserts a page break if less than `minSpace` points remain on the current page. */
function ensureSpace(doc: PDFKit.PDFDocument, minSpace: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - minSpace) {
    doc.addPage();
  }
}

/**
 * Builds a PDF invalid-click report for a set of admin-selected suspicious
 * sessions: a ready-to-send message for Google Ads support, a quick-
 * reference list, then one detailed section per session (risk flags, ad
 * attribution, and — for fingerprint-reset sessions — the concrete cookie
 * identities/IPs proving deliberate evasion).
 */
export function generateFraudReportPdf(sessions: FraudReportSession[], siteName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;

    // --- Header -------------------------------------------------------
    doc.fillColor(COLOR_HEADING).font("Helvetica-Bold").fontSize(20).text("Invalid Click Report");
    doc.moveDown(0.3);
    doc
      .fillColor(COLOR_MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(
        `${siteName}  ·  generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}  ·  ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
      );
    doc.moveDown(1.2);

    // --- Suggested message ---------------------------------------------
    doc.fillColor(COLOR_HEADING).font("Helvetica-Bold").fontSize(13).text("Suggested message to Google Ads support");
    doc.moveDown(0.5);
    const boxPadding = 14;
    const boxTop = doc.y;
    const message = coverMessage(siteName, sessions);
    doc.font("Helvetica-Oblique").fontSize(11);
    const messageHeight = doc.heightOfString(message, { width: pageWidth - boxPadding * 2, lineGap: 3 });
    doc
      .rect(PAGE_MARGIN, boxTop, pageWidth, messageHeight + boxPadding * 2)
      .fillAndStroke("#f3f4f6", "#d1d5db");
    doc
      .fillColor(COLOR_BODY)
      .text(message, PAGE_MARGIN + boxPadding, boxTop + boxPadding, { width: pageWidth - boxPadding * 2, lineGap: 3 });
    doc.y = boxTop + messageHeight + boxPadding * 2;
    doc.x = PAGE_MARGIN;
    doc.moveDown(1.4);

    // --- Quick-reference list ---------------------------------------------
    ensureSpace(doc, 100);
    doc.fillColor(COLOR_HEADING).font("Helvetica-Bold").fontSize(13).text("Sessions at a glance");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10.5).fillColor(COLOR_BODY);
    // Written as plain numbered lines (not pdfkit's built-in numbered list)
    // so the "N. " prefix is guaranteed a literal space before the text —
    // list()'s marker spacing wasn't leaving one.
    sessions.forEach((s, i) => {
      ensureSpace(doc, 30);
      const location = [s.city, s.region, s.country].filter(Boolean).join(", ");
      const bits = [
        `IP ${s.ip ?? "—"}${location ? ` (${location})` : ""}`,
        formatDate(s.at),
        `${s.risk.level.toUpperCase()} risk`,
        s.gclid ? `gclid ${s.gclid}` : "no gclid",
      ];
      doc.text(`${i + 1}. ${bits.join("  —  ")}`, { width: pageWidth, lineGap: 4 });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.9);

    // --- Per-session detail -----------------------------------------------
    ensureSpace(doc, 100);
    doc.fillColor(COLOR_HEADING).font("Helvetica-Bold").fontSize(13).text("Session details");
    doc.moveDown(0.6);

    sessions.forEach((s, i) => {
      ensureSpace(doc, 140);

      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + pageWidth, doc.y)
        .strokeColor("#e5e7eb")
        .stroke();
      doc.moveDown(0.6);

      // IP is the headline, not the session ID — Google Ads only understands
      // IP addresses, so that's what a reviewer needs to see first.
      doc
        .fillColor(COLOR_HEADING)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`${i + 1}. IP ${s.ip ?? "—"} — ${s.risk.level.toUpperCase()} risk (score ${s.risk.score})`);
      doc.moveDown(0.5);

      const location = [s.city, s.region, s.country].filter(Boolean).join(", ") || "—";
      const field = (label: string, value: string, mono = false) => {
        ensureSpace(doc, 30);
        doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_MUTED).text(`${label}:`, { continued: true });
        doc.font(mono ? "Courier" : "Helvetica").fontSize(10).fillColor(COLOR_BODY).text(` ${value}`);
      };

      field("Date", formatDate(s.at));
      field("Location", location);
      field("Google Click ID (gclid)", s.gclid ?? "— (no gclid on this session)", true);
      const adLine = adParamsLine(s);
      if (adLine) field("Campaign parameters", adLine);
      field("Internal reference (session ID)", s.sessionId.slice(0, 12), true);
      doc.moveDown(0.5);

      ensureSpace(doc, 40);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR_MUTED).text("Flagged for:");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10).fillColor(COLOR_BODY);
      const flagLines = s.risk.flags.map((flag) => `${FLAG_LABELS[flag.code] ?? flag.label} — ${flag.detail}`);
      doc.list(flagLines, { listType: "bullet", width: pageWidth, textIndent: 6, lineGap: 3 });

      if (s.fingerprintAssociates && s.fingerprintAssociates.length > 0) {
        doc.moveDown(0.5);
        ensureSpace(doc, 40);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLOR_ACCENT)
          .text(`Same device, ${s.fingerprintAssociates.length} different cookie identities:`);
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(9.5).fillColor(COLOR_BODY);
        const associateLines = s.fingerprintAssociates.map(
          (a) =>
            `device ${a.deviceId.slice(0, 12)} — ${a.sessionCount} session${a.sessionCount === 1 ? "" : "s"}, IP${a.ips.length === 1 ? "" : "s"}: ${a.ips.join(", ") || "—"}, last seen ${formatDate(a.lastSeen)}`
        );
        doc.list(associateLines, { listType: "bullet", width: pageWidth, textIndent: 6, lineGap: 3 });
      }

      doc.moveDown(1);
    });

    // --- Footer: page numbers ---------------------------------------------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor(COLOR_MUTED)
        .text(`Page ${i + 1 - range.start} of ${range.count}`, PAGE_MARGIN, doc.page.height - 30, {
          width: pageWidth,
          align: "center",
        });
    }

    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}
