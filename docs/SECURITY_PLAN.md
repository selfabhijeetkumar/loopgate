# SECURITY_PLAN.md
<!-- Applies only to real attack surfaces in Loopgate -->
<!-- Last updated: 2026-10-15 -->

> Rule: Apply only what is real for this app. No decorative security theatre.

---

## 1. Real Attack Surfaces Identified

| Surface | Risk | Mitigation |
|---------|------|------------|
| Gemini API route (Next.js) | Key exposure, prompt injection, cost abuse | See Section 3 |
| Image upload | Malicious file, oversized payload | See Section 4 |
| Environment variables | Key leak via git history or client bundle | See Section 5 |
| HTTP headers | Clickjacking, XSS, content sniffing | See Section 6 |
| npm dependencies | Supply chain vulnerabilities | See Section 7 |
| Git history | Accidentally committed secrets | See Section 8 |
| AI output rendering | XSS from Gemini text | See Section 9 |

---

## 2. Surfaces Skipped (Not Applicable)

| Surface | Why Skipped |
|---------|-------------|
| Authentication / password hashing | No login in scope; zero real auth surface |
| Admin routes | No admin panel |
| Database security / RLS | No database |
| Password visibility toggle | No passwords |
| Session management | No sessions |
| CSRF tokens | No state-mutating server forms |

These are NOT added as decoration. They are not in scope.

---

## 3. Gemini API Route

**File:** `src/app/api/analyze/route.ts`

Controls:
- API key stored ONLY in `GEMINI_API_KEY` env var (server-side)
- Key NEVER exposed to client bundle (Next.js App Router server component separation enforced)
- Rate limiting: 10 requests per minute per IP using in-memory sliding window (no Redis needed for hackathon volume)
- Input validation: prompt template is hardcoded; user supplies only classification result + profile type (enum, not free text)
- Maximum prompt tokens: capped at 1,000 input tokens
- Response: text only, parsed and sanitized before render
- CORS: locked to own Vercel origin (`Access-Control-Allow-Origin: https://loopgate.vercel.app`)
- Error responses: generic messages only, no stack traces

---

## 4. Image Upload

Controls:
- Maximum file size: 4MB (enforced both client-side and in API route)
- Allowed MIME types: image/jpeg, image/png, image/webp (allowlist, not blocklist)
- Images processed client-side by Transformers.js first (no server upload for CV)
- If Gemini second-opinion requested: image sent to Gemini API via server route, NOT stored anywhere
- No image stored on any server; no persistent image storage
- Privacy page discloses that images may be sent to Gemini API

---

## 5. Environment Variables

- `.env.local` is gitignored (standard Next.js default)
- `.env.example` committed with placeholder values only:
  ```
  GEMINI_API_KEY=your_gemini_api_key_here
  NEXT_PUBLIC_SITE_URL=https://loopgate.vercel.app
  ```
- Env var presence checked at startup:
  ```typescript
  if (!process.env.GEMINI_API_KEY) {
    console.error('[Loopgate] GEMINI_API_KEY not set -- AI route will use fallback templates');
  }
  ```
- No `NEXT_PUBLIC_` prefix on secret vars (client-exposed by design only for SITE_URL)

---

## 6. HTTP Security Headers

Configured in `next.config.ts`:

```typescript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",   // needed for Next.js HMR in dev only
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",         // blob: needed for canvas/CV output
      "connect-src 'self' https://generativelanguage.googleapis.com",
      "worker-src 'self' blob:",            // needed for Transformers.js WASM worker
    ].join('; ')
  }
]
```

Note: `unsafe-eval` is scoped to dev only via environment check; production CSP removes it.

---

## 7. Dependencies

- Run `npm audit` before each phase commit and at Phase 8 final audit
- Remove all unused packages before final build
- Use `npm audit --audit-level=high` to fail on high/critical CVEs
- No packages with AGPL licence (would force open-source of proprietary code)
- Pinned versions in package.json for reproducibility

---

## 8. Git / Secret Scanning

Before first push:
- Verify `.gitignore` includes: `.env.local`, `.env*.local`, `*.pem`, `*.key`
- Run gitleaks scan: `gitleaks detect --source . --verbose`
- Confirm no API keys in commit history with: `git log --all --full-history -- .env*`

---

## 9. AI Output Rendering

- Gemini explanation text rendered using React's `{text}` (JSX text node), never `dangerouslySetInnerHTML`
- Output is plain text + structured JSON (classification result), not HTML
- Sanitization: strip any HTML tags from Gemini response before display
- No markdown rendering of AI output (plain text only in explanation cards)

---

## 10. Source Maps and Debug Info

- `next.config.ts` sets `productionBrowserSourceMaps: false`
- No `console.log` calls referencing secrets in production
- Next.js automatically omits server-only code from client bundles

---

## 11. Checklist (Phase 8 Verification Gate)

- [ ] `npm audit --audit-level=high` passes clean
- [ ] gitleaks scan returns no findings
- [ ] `.env.local` confirmed absent from git history
- [ ] Security headers verified with securityheaders.com
- [ ] No API key visible in browser DevTools Network tab
- [ ] Image upload rejects oversized and wrong-type files
- [ ] Rate limiter tested: 11th request in 1 minute returns 429
- [ ] CSP header active in production (verify with browser console)
