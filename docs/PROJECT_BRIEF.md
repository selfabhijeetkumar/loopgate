# PROJECT_BRIEF.md
<!-- Status: FINALIZED (Phase 0) -->
<!-- Last updated: 2026-10-15 -->

> Single source of truth for Loopgate. All phases reference this file. Do not duplicate — link here.

---

## 1. Event Context

| Field | Value |
|-------|-------|
| Event | DSU Code Clash 2.0 |
| Dates | 15-16 October 2026 |
| Submission deadline | 16 Oct 16:30 IST |
| Deliverables | Deployed link + GitHub repo + PPT |
| Problem Statement | 06 - Smart Recycling Assistant |
| Team start | 15 Oct 10:00 IST (after Phase 0 review) |

**Judging rubric:**

| Category | Points |
|----------|--------|
| Technical | 30 |
| Innovation | 25 |
| Practicality / Impact | 20 |
| Presentation / Demo | 15 |
| Teamwork | 10 |

---

## 2. Tagline and Hero Problem

**Tagline:** Every item passes the gate. Risky ones never reach the compactor.

**Hero problem:** Batteries and battery-containing devices (power banks, vapes, earbud cases, phones) in mixed waste cause fires in sorting and compaction machinery. This is the highest-stakes hazard class.

**All four PS-06 material classes:**

| Class | Examples | Priority |
|-------|----------|----------|
| Recyclable | Paper, glass, metal cans, PET bottles | Standard |
| Reusable | Intact electronics, clothes, furniture parts | Standard |
| Biodegradable | Food scraps, garden waste, cardboard | Standard |
| Hazardous | Batteries, power banks, vapes, medical waste, chemicals | HERO |

---

## 3. System Architecture

### 3.1 Connected Workflow (non-negotiable)

Waste image upload
  -> Multi-stage CV inference:
       - Stage 1: Item detection & bounding boxes (DETR / OWL-ViT) with Human-verified interactive fallback
       - Stage 2: CLIP crop classification (4 PS classes + battery device prompts)
  -> Uncertainty Gate:
       - Gate score computed from hazard probability, classification confidence, and cross-model disagreement
       - Safety Floor: Any item with hazard probability above floor can NEVER auto-route to compaction
       - User-adjustable inspection threshold (diverts to manual inspection line)
       - Engine reports expected hazard exposure vs. inspection load across all thresholds
  -> Deterministic TypeScript Engine (pure-TS, no external calls)
       Calculates: expected hazard exposure, throughput, inspection load per route, cost-of-error threshold
  -> Connected 3D Sorting-Line Digital Twin (React Three Fiber)
       Intake hopper -> scanner gate -> diverter arm -> compactor / inspection bay / bins
  -> Replay Theatre
       Same batch, two decision branches, side-by-side numbers
  -> Human Approval + Audit Trail
       Every decision logged with provenance labels
  -> GenAI Explanation (Optional Stage 3)
       Gemini API (env var GEMINI_MODEL, default gemini-2.5-flash or flash-lite, ~5 RPM / 100 RPD)
       Optional, never in critical path, SHA-256 hash cached, deterministic template fallback
       Grounded ONLY in calculated numbers, personalized by profile, labeled AI-generated

### 3.2 Provenance Labels (shown everywhere)

| Label | Meaning |
|-------|---------|
| Observed | Directly from the uploaded image |
| Model-inferred | CV model output |
| Human-verified | Confirmed by operator |
| Configured | User/admin setting |
| Simulated | Digital twin output |
| Calculated | Deterministic engine result |
| AI-generated | Gemini explanation text |

### 3.3 Honesty Rules (hard constraints)

- Never claim fire prediction or chemistry detection from image alone
- All rates are labeled estimates with visible assumptions
- Include an Eval screen with real measured accuracy and confusion matrix on 20-image labeled test set
- No fake functionality, no fake metrics, no fake counters

---

## 4. Three Experiences

### 4.1 Sentinel Facility
What: 3D sorting-line digital twin
Scenes: Intake hopper -> scanner gate (scan beam animation) -> diverter arm -> compactor / inspection bay -> four class bins
Key interactions: Real-time item routing, approve/override actions, throughput metrics

### 4.2 Evidence Lab
What: CV analysis detail view
Shows: Bounding boxes, confidence score, provenance chips, uncertainty ring
Key interactions: See why an item was classified; explore model confidence; view second-opinion chain

### 4.3 Replay Theatre
What: Same starting batch, two decision branches compared
Shows: Side-by-side metrics, cinematic camera sweep, hazard divergence highlight
Key interactions: Threshold slider, branch comparison, time-step scrubbing

---

## 5. Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js (App Router) + TypeScript | Modern SSR/SSG, API routes for Gemini key |
| Styling | Tailwind CSS | Utility-first, JIT, design token friendly |
| 3D | React Three Fiber + @react-three/drei + Three.js | Production-grade 3D in React |
| Animation | GSAP + CSS transitions | STACK OVERRIDE: Framer Motion banned; GSAP for 3D & UI timelines, CSS transitions |
| CV primary | Transformers.js (DETR/OWL-ViT + CLIP) | Client-side, zero-install, Apache 2.0 permissive licences |
| CV secondary | Gemini API (server-side route) | Optional second opinion, GEMINI_MODEL env var, ~5 RPM / 100 RPD design |
| Engine | Pure TypeScript module (src/domain) | Zero external deps, deterministic, fully testable |
| Storage | IndexedDB / Cache Storage + localStorage | Client-side persistence, no database |
| Testing | Vitest | Fast, ESM-native testing |
| Deployment | Vercel free tier | Global CDN, edge delivery |

Budget constraint: Free tiers and open-source only. No paid APIs.

---

## 6. Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | / | Value statement + CTA above fold |
| App | /app | Main three-experience hub |
| About | /about | Team roles (role cards; real photo only if provided) |
| FAQ | /faq | 5+ real questions, expandable |
| Contact | /contact | mailto only, no phone |
| Privacy | /privacy | What is processed; image/Gemini disclosure |
| Terms | /terms | Usage terms |
| 404 | -- | Custom not-found page |

---

## 7. Constraints Summary

- No auth unless real surface appears
- No database
- No paid APIs
- BANNED: purple gradients, pill buttons, fake reviews, fake metrics, fake counters, vague hero text, emoji icons, em dashes in UI copy, over-the-top scroll animation, AI-slop photos/copy, custom cursor, generic AI-SaaS cards with glow, "Made with AI" tags
- All API keys server-side only
- Images go to Gemini API (disclosed in Privacy page)
- Framer Motion installed by default (user global preference)

---

## 8. Demo Script (for judging)

1. Judge uploads own item (or selects from test set)
2. CV runs live in browser; confidence ring populates
3. Power bank -> low confidence -> uncertainty gate fires -> DIVERT TO INSPECTION
4. Operator views Evidence Lab: CV boxes, provenance chips, amber hazard chip
5. Approve routing -> item appears in 3D twin inspection bay
6. Open Replay Theatre: two branches (compactor vs inspection); numbers diverge
7. Show ambiguous item (old phone): threshold slider shows how setting affects routing
8. Show Eval screen: confusion matrix on 20-image test set, real accuracy numbers

---

All future phases inherit from this brief. Changes require updating this file.
