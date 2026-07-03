'use client';
// Extracts the GST/PAN/CIN number from an uploaded certificate.
//
// Strategy (fast + accurate):
//   1. PDF with a real text layer (most digital certificates) → read the text
//      directly with pdf.js. No OCR, instant, exact.
//   2. Scanned/image PDF or an image file → OCR with Tesseract (self-hosted,
//      runs in the browser, no external service, no per-call cost).
//
// If nothing matches, we return null and the vendor enters the number manually.

const PATTERNS = {
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]/,
  GST: /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/,
  CIN: /[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}/,
};
const normalize = (t) => (t || '').toUpperCase().replace(/\s+/g, '');

// A single Tesseract worker, created once and reused across all three documents.
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
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function ocrMatch(source, re) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(source);
    const m = normalize(data?.text).match(re);
    return m ? m[0] : null;
  } finally {
    if (typeof source === 'string') URL.revokeObjectURL(source);
  }
}

async function loadPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

export async function extractDocNumber(type, file) {
  const re = PATTERNS[type];
  if (!file || !re) return null;

  if (file.type === 'application/pdf') {
    const pdf = await loadPdf(file);

    // 1) Embedded text layer (accurate, no OCR) — scan up to 3 pages.
    let text = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      text += ' ' + content.items.map((i) => i.str).join(' ');
    }
    const fromText = normalize(text).match(re);
    if (fromText) return fromText[0];

    // 2) No text layer (scanned PDF) → OCR the rendered first page.
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return ocrMatch(canvas, re);
  }

  // Image file → OCR.
  return ocrMatch(URL.createObjectURL(file), re);
}
