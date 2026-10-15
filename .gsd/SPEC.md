# SPEC.md
<!-- Status: FINALIZED -->
<!-- Last updated: 2026-10-15 -->
<!-- GSD Planning Lock: Implementation may begin. -->

> Status: FINALIZED
> This document finalizes requirements for Loopgate.
> All canonical spec is in docs/PROJECT_BRIEF.md.
> This file is the GSD Planning Lock trigger.

See docs/PROJECT_BRIEF.md for full specification.

## Summary Reference
- Project: Loopgate
- Event: DSU Code Clash 2.0, 15-16 Oct 2026
- Problem: PS-06 Smart Recycling Assistant
- Hero problem: Battery-containing devices causing catastrophic fires in waste compactors
- CV Chain: Stage 1 per-item detection (DETR / OWL-ViT) with Human-verified fallback; Stage 2 CLIP crop classification into 4 classes + battery prompts; Stage 3 optional Gemini second opinion (env var GEMINI_MODEL, default gemini-2.5-flash or flash-lite, ~5 RPM / 100 RPD, offline fallback templates)
- Uncertainty Gate: Gate score + Safety Floor (hazard probability above floor cannot auto-route to compaction) + Operator threshold + deterministic engine trade-off
- Stack: Next.js (App Router) + TypeScript + Tailwind + R3F + GSAP + Vitest + Zod (Zero Framer Motion)
- Deploy: Vercel free tier

## Status: FINALIZED (Phase 3 Active)
Current Phase: Phase 3 (Styling Repair + Slider Repair + 3D Digital Twin)

### Canonical Phase Order
- **Phase 0:** Research, architecture, and markdown documentation (COMPLETED)
- **Phase 1:** Next.js scaffold, Industrial HUD design tokens, domain contracts (COMPLETED)
- **Phase 2:** Deterministic engine, test suite, and dev sandbox (COMPLETED & REPAIRED)
- **Phase 3:** Styling repair + slider repair + 3D Digital Twin ("Sentinel Facility") (CURRENT)
- **Phase 4:** Real CV + Evidence Lab
- **Phase 5:** Replay Theatre + audit
- **Phase 6:** Pages, legal, SEO, accessibility
- **Phase 7:** GenAI + fallback
- **Phase 8:** Security audit, deploy, PPT

