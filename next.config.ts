import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://generativelanguage.googleapis.com;
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
