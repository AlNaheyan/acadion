import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js discovers its Node worker and font assets at runtime. Bundling it
  // into an app-route chunk breaks that discovery under Turbopack.
  serverExternalPackages: ["pdfjs-dist"],
  images: {
    domains: ["img.clerk.com"],
  }
};

export default nextConfig;
