'use client';
// Our own OCR — Tesseract runs entirely in the browser (no external service, no
// per-call cost, the document never leaves the device). Engine, worker, language
// model and the PDF worker are all SELF-HOSTED from /public (no third-party CDN),
// so it works reliably at scale with no external dependency.
//
// Extracts the GST/PAN/CIN number from an uploaded certificate so we spend only a
// verification credit, not an OCR one. Best-effort: if a scan can't be read the
// vendor just types the number in.

const PATTERNS = {
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]/,
  GST: /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/,
  CIN: /[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}/,
};

// A single Tesseract worker, created once and reused across all three documents
// in a session (the first document loads the engine; the rest are fast).
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
      });
    })().catch((e) => {
      workerPromise = null; // allow a retry on next upload
      throw e;
    });
  }
  return workerPromise;
}

// Render a PDF's first page to a canvas (Tesseract reads images, not PDFs).
async function pdfFirstPageCanvas(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
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
    const worker = await getWorker();
    const { data } = await worker.recognize(source);
    const text = (data?.text || '').toUpperCase().replace(/\s+/g, '');
    const m = text.match(PATTERNS[type]);
    return m ? m[0] : null;
  } finally {
    if (typeof source === 'string') URL.revokeObjectURL(source);
  }
}
