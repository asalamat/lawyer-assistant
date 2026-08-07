import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // tesseract.js resolves its own worker script relative to its own
  // __dirname at runtime — bundling it rewrites that path and breaks it
  // ("Cannot find module '.../tesseract.js/src/worker-script/node/index.js'").
  // Excluding it from bundling keeps it on plain Node require. pdf-parse's
  // underlying pdfjs-dist has the exact same problem for its Node "fake
  // worker" fallback ("Cannot find module '.../pdf.worker.mjs'") — every
  // PDF upload was failing extraction under Turbopack until this was added.
  serverExternalPackages: ["tesseract.js", "pdf-parse", "pdfjs-dist"],
  experimental: {
    // Because src/proxy.ts exists, Next.js 16 caps every request body it
    // proxies at 10MB by default — silently truncating anything larger,
    // which corrupts a multipart upload mid-stream ("Failed to parse body
    // as FormData") instead of a clean size-limit error. Raised to match
    // this app's own document-upload/bulk-ZIP-import ceilings
    // (src/lib/bulkImport.ts allows up to 500MB uncompressed per zip).
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
