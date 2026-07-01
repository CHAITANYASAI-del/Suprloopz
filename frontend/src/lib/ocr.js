'use client';
// Our own OCR — runs Tesseract entirely in the browser (no external service, no
// per-call cost, document never leaves the device). Extracts the GST/PAN/CIN number
// from an uploaded certificate so we only spend a verification credit, not an OCR one.
// Best-effort: if a scan is too poor to read, the vendor just types it manually.

// Loosened patterns (we strip spaces from OCR text before matching, since OCR often
// injects spaces inside the ID). Order: strip whitespace → find the strict pattern.
const PATTERNS = {
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]/,
  GST: /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/,
  CIN: /[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}/,
};

// Render a PDF's first page to a canvas (Tesseract can't read PDFs directly).
async function pdfFirstPageCanvas(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

// Returns the extracted number for `type` (GST|PAN|CIN), or null if not found.
export async function extractDocNumber(type, file) {
  if (!file || !PATTERNS[type]) return null;
  const source = file.type === 'application/pdf' ? await pdfFirstPageCanvas(file) : URL.createObjectURL(file);
  try {
    const { default: Tesseract } = await import('tesseract.js');
    const { data } = await Tesseract.recognize(source, 'eng');
    const text = (data?.text || '').toUpperCase().replace(/\s+/g, '');
    const m = text.match(PATTERNS[type]);
    return m ? m[0] : null;
  } finally {
    if (typeof source === 'string') URL.revokeObjectURL(source);
  }
}
