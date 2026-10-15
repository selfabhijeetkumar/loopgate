# STATE.md -- Loopgate Project State
<!-- GSD Session Memory -->
<!-- Updated: 2026-10-15 (Phase 3C COMPLETE) -->

## Current Position
Phase: 3C (COMPLETE) -- Cinematic 3D World, Single WebGL Canvas, Scroll-Driven Camera & Quality Tiers
Next phase: Phase 4 (READY) -- Real In-Browser CV Pipeline & Evidence Lab
Subsequent phases:
- 5 = Replay Theatre + audit
- 6 = pages, legal, SEO, accessibility
- 7 = GenAI + fallback
- 8 = security audit, deploy, PPT
Status: PHASE 3C VERIFIED AND COMPLETE

## Phase 3C Execution & Verification Summary
Objective: Build the cinematic 3D world as a single full-viewport React-Three-Fiber WebGL canvas behind all content, driven by GSAP ScrollTrigger across 6 keyframed chapters with native scrolling, 3D cursor probe, floor spotlight and acoustic ripple shader, auto-downgrading quality tiers, and zero boxed duplicate viewports.

### Completed Deliverables

1. **Single Full-Viewport World** (`src/components/world/World.tsx` & `WorldClient.tsx`):
   - One WebGL `<Canvas>` with `position: fixed, inset: 0, z-index: 0, pointer-events: none` (switches to `pointer-events: auto` in Chapter 4).
   - Dynamic client loading with SSR disabled; zero duplicate WebGL contexts in the app.
   - Connected via `SimulationProvider` to shared simulation state (`currentTime`, `strictnessPct`, `tau`, `overrides`, `decisions`).

2. **Scroll-Driven Camera Rig (6 Chapters)** (`src/components/world/WorldScene.tsx`):
   - Catmull-Rom 3D spline interpolation for position and look-at target with smooth FOV transitions.
   - Native scrolling preserved (no scroll hijack).
   - Chapter 0 (Hero): Wide establishing view of facility hall with floating hazard objects (power bank, vape pen, phone) slowly drifting with rim lights.
   - Chapter 1 (Scan): Dolly to overhead scanner gate, sweeping amber planar beam, item bounding markers.
   - Chapter 2 (Gate): Diverter close-up with 3D telemetry readout of real engine calculations for `item-08` and ambiguous `item-04`.
   - Chapter 3 (Route): Side profile showing compactor stroke and 3 terminal classification bins.
   - Chapter 4 (Run It Yourself): Orbit view with full interactive controls (scrubber, strictness slider, item select, manual override modal, 2D fallback).
   - Chapter 5 (Streams & Assumptions): Elevated oblique view, darker ambient world.

3. **Pointer-Reactive 3D Probe Cursor & Parallax**:
   - Damped camera parallax tracking mouse cursor.
   - Real pointLight spotlight on industrial floor following mouse coordinates.
   - 3D low-poly faceted scanner probe ring with core sphere inside canvas following pointer on camera plane.
   - SVG reticle overlay (`WorldCursor.tsx`) with corner brackets and item telemetry lock-on.

4. **Dynamic Floor Ripple Shader**:
   - High-contrast graphite industrial grid with vertex displacement radiating from pointer coordinates on floor plane.
   - GPU-accelerated acoustic wave equation with amber wave-crest highlight.
   - Scaled by quality tier (`rippleDensity`: 64 HIGH, 32 MED, 16 LOW).

5. **Quality Tiers & Tab Visibility Auto-Pause**:
   - HIGH (dpr [1, 2], shadow maps 1024, ripple 64), MEDIUM (dpr 1.5, shadow maps off, ripple 32), LOW (dpr 1.0, 2D twin, ripple 16).
   - Auto step-down if average FPS stays < 45 for 3s in Auto mode.
   - Quality control HUD component (`QualityControl.tsx`) with live FPS and tier indicator.
   - Canvas frameloop switches to `'never'` when browser tab is hidden.

6. **Small Fixes**:
   - Single source of truth: `SAFETY_FLOOR = 0.30` exported from `src/engine/gate.ts` and imported across data, UI, and tests.
   - Removed fake LAT/LON HUD text.
   - Copy calibrated: "Residual compactor fire risk" → "Estimated residual hazard (simulated)".
   - Strictness slider labels dynamically generated from exact mapping formula `tau = 0.48 - (pct / 100) * 0.40` (0% -> 0.480, 50% -> 0.280, 100% -> 0.080).
   - 2D schematic: removed nested double scrollbar and clipped caption.

### Empirical Verification Results
- **TypeScript**: `npx tsc --noEmit` ✅ 0 errors
- **ESLint**: `npm run lint` ✅ 0 warnings/errors
- **Vitest**: `npm test` ✅ **49/49 tests pass** (including single-source safety floor and slider label tests)
- **Production Build**: `npm run build` ✅ Clean compilation & static generation
- **Production Server**: `npm start` ✅ Ready on port 3000 in 243ms
- **Security Audit**: `npm audit` ✅ 0 vulnerabilities
- **Secret Scan**: Clean; 0 credentials or private tokens
