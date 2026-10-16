# LOOPGATE — Vercel Deployment Guide

> **Team NEXARC · DSU Code Clash 2.0 · PS06**  
> Contact: selfabhijeetkumar@gmail.com

---

## 1. Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.x (LTS) |
| npm | ≥ 9.x |
| Next.js | 14 (App Router) |
| Vercel CLI (optional) | `npm i -g vercel` |

---

## 2. Environment Variables

Set the following in **Vercel → Project → Settings → Environment Variables**.  
All variables are **server-side only** (no `NEXT_PUBLIC_` prefix for secrets).

### Required — AI Providers (at least one)

| Variable | Description | Example value |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `GROQ_API_KEY` | Groq API key | `gsk_...` |
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-v1-...` |

> **Minimum**: Set `GEMINI_API_KEY`. The system auto-fails over to Groq then OpenRouter.

### Optional — Model Overrides

| Variable | Default | Description |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Gemini model ID |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` | Groq model ID |
| `OPENROUTER_MODEL` | `nvidia/nemotron-3.5-lightning:free` | OpenRouter model ID |

### Required — Public Site URL (for OG/sitemap/canonical)

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://loopgate-rose.vercel.app` |

> Set this to the **exact** production URL Vercel assigns (or your custom domain).  
> Without it, Open Graph images and the sitemap will use `http://localhost:3000`.

---

## 3. One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/selfabhijeetkumar/loopgate)

Or manually:

```bash
# 1. Clone
git clone https://github.com/selfabhijeetkumar/loopgate
cd loopgate

# 2. Install
npm ci

# 3. Set env (local dev only)
cp .env.example .env.local
# Fill in your API keys in .env.local

# 4. Build & run locally
npm run build
npm run start
```

---

## 4. Vercel Project Settings

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` (auto) |
| Install Command | `npm ci` |
| Node.js Version | 18.x |

No custom `vercel.json` is required. Vercel auto-detects Next.js.

---

## 5. Security Headers

Security headers are set in `next.config.ts` via the `headers()` export:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | See `next.config.ts` for the full directive |

---

## 6. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/explain` | `POST` | LLM explain chain (Gemini → Groq → OpenRouter → template) |
| `/api/cv` | `POST` | Computer-vision classification (DETR + CLIP pipeline) |

Both routes:
- Validate `Origin` / `Referer` (same-origin check)
- Apply Zod input validation
- Enforce a 6-second LLM timeout
- Rate-limit via in-memory cooldown per provider (5 min)

---

## 7. Public Assets

| Path | Contents |
|---|---|
| `public/` | Static files, favicon, OG image |
| `public/textures/` | Three.js scene textures |
| `public/models/` | (none - geometry is code-generated) |

Total `public/` size is checked as part of CI (< 5 MB target).

---

## 8. Pre-flight Checklist

- [ ] All three API keys set in Vercel environment variables
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production URL
- [ ] `npm run build` exits 0 locally
- [ ] `npx vitest run` — all 114 tests pass
- [ ] `npm audit --audit-level=high` — 0 vulnerabilities
- [ ] No secrets in `.next/static` (verified by live-providers test suite)
- [ ] Open Graph image visible at `<SITE_URL>/og-image.png`
- [ ] `/sitemap.xml` and `/robots.txt` return 200
- [ ] `/api/explain` returns 200 with `source: "ai"` or `source: "template"`
- [ ] Lighthouse Performance >= 80 on production URL

---

## 9. Notes

- `.env.local` is **git-ignored** and must **never** be committed.
- The `/dev` debug route returns 404 in production (guarded by `NODE_ENV`).
- Browser sourcemaps are disabled in production (`productionBrowserSourceMaps: false`).
- The Three.js WebGL canvas is a single context — no duplicate renderer instances.

---

*Generated for Phase 8A Step 3 — Deploy Readiness*  
*Last updated: 2026-10-16*
