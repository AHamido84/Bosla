import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Self-contained server in .next/standalone → assembled into deploy/ by `npm run package`.
  output: "standalone",
  // The custom image loader means sharp is never used at runtime; keeping its native
  // binaries out of the bundle makes deploy/ platform-independent (and 46 MB smaller).
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**", "node_modules/@emnapi/**"],
  },
  images: {
    // Pre-generated WebP variants (scripts/build-images.mjs) instead of a runtime optimizer,
    // so the deploy folder has no native dependencies and runs on any Node host.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    deviceSizes: [384, 512, 640, 960],
    imageSizes: [128, 256],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
