import path from "path";
import { readPlaintextFile } from "./textExtraction";

// pdfjs-dist's legacy Node build renders via its own bundled Node canvas
// factory (an optional dependency on @napi-rs/canvas — NOT something this
// file constructs itself). That optional dependency is version-pinned
// tightly (^0.1.80 as of pdfjs-dist 5.x) — installing a newer major of
// @napi-rs/canvas breaks the internal integration silently (page.render()
// hangs forever rather than throwing), which is exactly what happened
// when this was first verified against a real document. Keep
// package.json's @napi-rs/canvas pinned to what pdfjs-dist actually
// declares; don't let it drift to "latest" on a future `npm update`.
const STANDARD_FONT_DATA_URL = path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts") + "/";
const CMAP_URL = path.join(process.cwd(), "node_modules/pdfjs-dist/cmaps") + "/";

export interface RenderedPage {
  buffer: Buffer;
  pageCount: number;
}

// pdfjs-dist types its Node canvas factory as an opaque object (it's a
// pluggable interface, not a concrete class) — this is the minimal shape
// this file actually calls, matching pdfjs-dist's own bundled
// implementation (backed by @napi-rs/canvas under the hood).
interface NodeCanvasAndContext {
  canvas: { toBuffer(mimeType: string): Buffer };
  context: unknown;
}
interface NodeCanvasFactory {
  create(width: number, height: number): NodeCanvasAndContext;
  destroy(canvasAndContext: NodeCanvasAndContext): void;
}

// Renders one page of an (encrypted-at-rest) PDF to a PNG buffer, on
// demand — not cached, not pre-rendered for every page of every PDF.
// scale 2.0 keeps small print (checkbox labels, form footnotes) legible
// to a vision model without producing an unreasonably large image.
export async function renderPdfPageToPng(storagePath: string, pageNumber: number): Promise<RenderedPage> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await readPlaintextFile(storagePath);

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  });
  const pdfDocument = await loadingTask.promise;

  try {
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new Error(`Page ${pageNumber} is out of range — this PDF has ${pdfDocument.numPages} pages.`);
    }

    const page = await pdfDocument.getPage(pageNumber);
    try {
      const canvasFactory = pdfDocument.canvasFactory as NodeCanvasFactory;
      const viewport = page.getViewport({ scale: 2.0 });
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

      // @napi-rs/canvas's canvas/context are structurally compatible with
      // what pdfjs-dist's renderer actually calls, but aren't nominally
      // the DOM types pdfjs's own .d.ts declares here.
      await page.render({
        canvasContext: canvasAndContext.context as CanvasRenderingContext2D,
        canvas: canvasAndContext.canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      const buffer = canvasAndContext.canvas.toBuffer("image/png");
      canvasFactory.destroy(canvasAndContext);
      return { buffer, pageCount: pdfDocument.numPages };
    } finally {
      page.cleanup();
    }
  } finally {
    await pdfDocument.destroy();
  }
}
