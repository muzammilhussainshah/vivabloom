// pdfkit's standalone build (see lib/generateFraudReportPdf.ts for why it's
// used over the default entry point) has no shipped types of its own —
// it's the same PDFDocument class, just bundled with embedded font data.
declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}
