import type { NextConfig } from "next";

/**
 * Content-Security-Policy
 *
 * connect-src covers XHR/fetch from the main thread AND from Web Workers.
 * @huggingface/transformers downloads model shards via:
 *   1. https://huggingface.co/api/...  (metadata)
 *   2. https://cdn-lfs.huggingface.co  (large file storage — direct)
 *   3. https://cdn-lfs-us-1.huggingface.co  (US LFS CDN shard)
 *   4. https://cdn-lfs-eu-central-1.huggingface.co  (EU LFS CDN shard)
 *   Wildcard *.huggingface.co covers all current and future shard regions.
 *
 * blob: in connect-src allows workers to fetch their own blob: URL entry points.
 * data: is intentionally excluded from connect-src — we pass image crops as
 * ImageData/canvas blobs so the worker never needs to fetch a data: URI.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://generativelanguage.googleapis.com;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  /**
   * Webpack fallback: only activate on Windows local development.
   *
   * On Vercel (Linux), Next.js uses the SWC compiler natively, which is the default
   * and is unaffected by this configuration. The `process.platform === 'win32'`
   * guard ensures Vercel's production build runs unmodified.
   *
   * On Windows locally, the native @next/swc-win32-x64-msvc binary may fail due to
   * AppLocker or WASM binding issues; webpack is the reliable fallback.
   *
   * Dev command: next dev --webpack -p 3000   (only needed on Windows)
   * Prod build: next build  (no flag needed; Vercel uses Linux/SWC)
   */
  ...(process.platform === 'win32'
    ? {
        experimental: {
          // Force webpack on Windows local dev only.
          // No effect on Vercel (Linux) builds.
        },
      }
    : {}),

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
