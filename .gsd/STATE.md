# STATE.md -- Loopgate Project State
<!-- GSD Session Memory -->
<!-- Updated: 2026-10-15 (Phase 2 COMPLETE) -->

## Current Position
Phase: 3 (COMPLETE) -- Styling repair + slider repair + 3D Digital Twin
Next phase: Phase 4 (READY) -- Real CV + Evidence Lab
Subsequent phases:
- 5 = Replay Theatre + audit
- 6 = pages, legal, SEO, accessibility
- 7 = GenAI + fallback
- 8 = security audit, deploy, PPT
Status: PHASE 3 VERIFIED AND COMPLETE

## Phase 2 Execution & Verification Summary
Objective: Implement the deterministic sorting engine, digital twin timeline, branch comparison/sweep, comprehensive test suite, and a dev sandbox page. All invariants enforced and empirically verified.

### Completed Deliverables

1. **Engine Modules** (`src/engine/`):
   - `gate.ts` — `evaluateGate()`: safety floor invariant (hazardProbability >= safetyFloor → never reaches compactor), gateScore formula `0.65*hazard + 0.35*uncertainty`, hazard routing with confidence cutoff, inspection threshold routing.
   - `sort.ts` — `simulateBatch()`: processes Item[] through the gate, produces per-item `ItemDecision[]`, batch `BatchMetrics`, and tick `Timeline` for the digital twin.
   - `twin.ts` — `buildTwinTimeline()`: extracts and enriches tick events for 3D visualization.
   - `compare.ts` — `compareBranches()` (baseline vs gated side-by-side metrics + deltas) and `sweepThreshold()` (slider data over full [0,1] range).
   - `assumptions.ts` — All labeled estimates with provenance (`Configured`) clearly distinguished from measured facts.
   - `index.ts` — Single barrel export; all outside imports go through here.

2. **Domain Updates**:
   - `src/domain/types.ts`: Added `modelDisagreement?: number` to `Item`; added `hazardConfidentCutoff` to `EngineConfig`.
   - `src/domain/schemas.ts`: Zod schemas updated to match.
   - `src/data/scenario.ts`: `DEFAULT_ENGINE_CONFIG` updated to `safetyFloor: 0.30`, `hazardConfidentCutoff: 0.75`. Scenario items updated with `modelDisagreement` fields to produce distinct gate score distribution across slider range.

3. **Dev Sandbox** (`src/app/dev/engine/page.tsx`):
   - Live threshold slider (0.00–1.00, step 0.01) with real-time inspection load update.
   - Branch comparison table (baseline vs gated metrics + deltas).
   - Full sweep table (all threshold points).
   - Per-item audit trail with gateScore, route, safetyFloor flag.
   - Assumption registry (all engine assumptions with provenance).
   - `src/app/dev/layout.tsx`: Calls `notFound()` in production — route is completely hidden on Vercel.

4. **Home Page Wired to Engine**:
   - `src/app/page.tsx`: Telemetry bar and conveyor feed table now show live `simulateBatch()` results.
   - `ProvenanceChip` shows `[CAL]` for all engine-computed values.
   - Terminology: "Physical-Digital Twin" → "Digital Twin" throughout.

5. **Next.js Config**:
   - `next.config.ts`: Webpack fallback is now platform-conditional (`process.platform === 'win32'`) — Vercel Linux build runs clean SWC unaffected.

6. **Test Suite** (`src/__tests__/engine.test.ts`):
   - 29 engine tests covering: safety floor invariant, conservation (every item in exactly one terminal), gate score formula, threshold boundary behaviour, batch metrics accuracy, sweepThreshold monotonicity, compareBranches delta sign, twin timeline tick count, assumption provenance labels.

### Empirical Verification Results
- **TypeScript**: `npm run typecheck` ✅ 0 errors
- **ESLint**: `npm run lint` ✅ 0 warnings/errors
- **Vitest**: `npm run test` ✅ **33/33 tests pass** (4 domain + 29 engine)
- **Production Build**: `npm run build` ✅ exit 0 — routes: `/`, `/_not-found`, `/dev/engine`, `/icon.svg`
- **Gate Semantics**: Safety floor invariant confirmed — no floor-triggered item ever reaches compactor stream in any test case.

## Phase 1 Summary (Archived)
All Phase 1 deliverables complete and verified. See git log for details.
- Next.js 16 App Router scaffold + Industrial HUD design system
- Domain contracts (types.ts, schemas.ts), synthetic scenario (scenario.ts)
- App shell (Header, ThemeToggle, ProvenanceChip, Home, 404)
- Browser-verified responsive layout, keyboard navigation, provenance chip rendering

## Next Actions for Phase 3
1. User review and approval of Phase 2 repair report.
2. Implement CV pipeline in the browser (Transformers.js, zero server cost):
   - Stage 1: DETR (ResNet-50) or OWL-ViT Zero-Shot for per-item bounding box detection.
   - Stage 2: CLIP-ViT-Base-Patch32 crop classification into the 4 material classes + battery prompts.
   - Human-verified box fallback (interactive canvas) always available.
3. Map CLIP softmax output → `MaterialClass` using deterministic prompt-score lookup (no fixed 80-class detector).
4. Integrate Gemini optional second opinion: server route, SHA-256 cache, deterministic offline fallback templates, never in critical path.
5. Wire CV output into engine: detected items → `simulateBatch()` → live UI update.
6. Publish evaluation dataset (20 images, CC0 licensed): confusion matrix, TP/FP rates, empirical gate effectiveness.

