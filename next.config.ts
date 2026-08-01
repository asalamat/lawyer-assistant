import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // tesseract.js resolves its own worker script relative to its own
  // __dirname at runtime — bundling it rewrites that path and breaks it
  // ("Cannot find module '.../tesseract.js/src/worker-script/node/index.js'").
  // Excluding it from bundling keeps it on plain Node require.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
