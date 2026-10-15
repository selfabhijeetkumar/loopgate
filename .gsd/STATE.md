# STATE.md -- Loopgate Project State
<!-- GSD Session Memory -->
<!-- Updated: 2026-10-16 (Phase 4 Repair + Phase 5 COMPLETE) -->

## Current Position
Phase: Phase 4 Repair + Phase 5 (COMPLETE) -- Real CV Pipeline Integrity, Honest Fallback, 5-Box Sanity Mapping, Dual-Lane SVG Replay Theatre, Typed Audit Trail Engine
Next phase: Phase 6 (READY) -- Dedicated Pages, Legal / Compliance, SEO & Accessibility (WCAG 2.1 AA)
Subsequent phases:
- 7 = GenAI second-opinion + deterministic fallback
- 8 = End-to-end security audit, deployment, pitch presentation
Status: PHASE 4 REPAIR + PHASE 5 VERIFIED AND COMPLETE

## Phase 4 Repair + Phase 5 Execution & Verification Summary
Objective: Repair CV pipeline CSP and honest error handling, fix 2D schematic and camera viewport, enforce safety floor for detector-labeled hazardous objects, and build the Dual-Lane Replay Theatre (Standard Line vs Loopgate Gated Policy) with side-by-side calculated metrics and localStorage persistent Audit Trail.

### Completed Deliverables
1. **CSP Repair (`next.config.ts`)**:
   - Added `blob:` to `connect-src` (for Next.js worker bundle fetches) and `*.huggingface.co` wildcard for LFS CDN shards.
   - Zero CSP errors in browser console during page loads and asset operations.

2. **Honest Fallback (`src/cv/pipeline.ts`)**:
   - Completely eliminated synthetic fake detections (`bottle 78%, power bank 84%`).
   - Implemented designed error state when model weights are not downloadable in constrained environments.
   - Preserved manual box drawing (Human-verified) and simulated scenario.

3. **Hazard Safety Floor in `toItems.ts` (`src/cv/toItems.ts`)**:
   - Fixed potential escape mode where an item detected as `power bank` with 84% confidence could be assigned 5% hazard if CLIP crop was confused.
   - Enforced `SAFETY_FLOOR` (0.30) for all items where `expectedClass === 'hazardous'`, guaranteeing they trigger the gate and divert to `inspection_line`.
   - Verified via unit test `cv.test.ts` and empirical 5-box sanity test.

4. **Replay Theatre (`src/components/replay/ReplayTheatre.tsx`, `ReplayClient.tsx`)**:
   - Dual-lane SVG visualization driven by pure engine timeline: Branch A (Standard Line, No Gate) vs Branch B (Loopgate Gated Policy).
   - Amber warning highlight at compactor when hazardous items reach it in Branch A.
   - Diverter drop animation in Branch B routing hazardous/uncertain items to Diverted / Inspection bay.
   - Shared transport controls: Play/Pause/Restart and scrubber driving both branches synchronously. Keyboard shortcuts (Space, R).
   - Side-by-side calculated metrics with `Calculated` chips: Expected Hazard Exposure, Inspection Load, Throughput, Compactor Escapes, Safety Floor Triggers.

5. **Audit Trail Engine (`src/engine/audit.ts`)**:
   - Typed audit events for manual diverts, standard line dispatches, safety floor refusals, and human corrections.
   - Reverse-chronological audit log table with Item ID, Action, Reason Code, and Provenance.
   - LocalStorage persistence with try/catch, Copy to Clipboard CSV export, and 2-step confirmation dialog for "Clear Log".
   - 11 unit tests in `src/__tests__/audit.test.ts`.

6. **Responsive & Mobile Viewport**:
   - Mobile 360px layout tested with horizontal scroll container for SVG lanes (`min-w-[480px]`) and stacked responsive metric cards.

### Empirical Verification Results
- **TypeScript**: `npx tsc --noEmit` ✅ 0 errors
- **ESLint**: `npm run lint` ✅ 0 warnings/errors
- **Vitest**: `npm test` ✅ **71/71 tests pass** (6 test suites)
- **Production Build**: `npm run build` ✅ Exit 0, 9 static & dynamic routes compiled
- **Security Audit**: `npm audit` ✅ 0 vulnerabilities (npmjs.org official registry)
- **Secret Scan**: Clean; 0 credentials or secrets in code or commits
- **Git Commit**: `feat(phase4-repair-phase5): CV pipeline CSP repair, honest fallback, 5-box sanity floor, Replay Theatre, and Audit Trail`

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
