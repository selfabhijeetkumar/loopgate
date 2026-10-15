# BUILD_PLAN.md
<!-- Loopgate hackathon build phases -->
<!-- Event: DSU Code Clash 2.0, 15-16 Oct 2026 -->
<!-- Window: 15 Oct 10:00 IST to 16 Oct 16:30 IST (30.5 hours) -->
<!-- Last updated: 2026-10-15 -->

## Timeline Overview

| Phase | Name | Duration | Window | Priority |
|-------|------|----------|--------|----------|
| 0 | Research + Docs (done) | 3h | 15 Oct 07:00-10:00 | P0 |
| 1 | Scaffold + Design System (done) | 2h | 15 Oct 10:00-12:00 | P1 |
| 2 | Deterministic Engine + Tests (done) | 2h | 15 Oct 12:00-14:00 | P1 |
| 3 | Styling Repair + Slider Repair + 3D Digital Twin | 3h | 15 Oct 14:00-17:00 | P1 |
| 4 | Real CV + Evidence Lab | 3h | 15 Oct 17:00-20:00 | P1 |
| 5 | Replay Theatre + Audit | 2h | 15 Oct 20:00-22:00 | P1 |
| 6 | Pages + Legal + SEO + Accessibility | 2.5h | 15 Oct 22:00-00:30 | P1 |
| 7 | GenAI + Fallback | 2h | 16 Oct 00:30-02:30 | P1 |
| 8 | Security Audit + Deploy + PPT | 3h | 16 Oct 02:30-05:30 | P1 |
| -- | Night buffer / sleep buffer | 5h | 16 Oct 05:30-10:30 | buffer |
| -- | PPT + Demo script | 3h | 16 Oct 10:30-13:30 | P1 |
| -- | Final polish + submission | 3h | 16 Oct 13:30-16:30 | P1 |

**Night work allowed.** Buffer absorbs overruns. P2 features added only if Phase 8 verifies clean before 16 Oct 13:30.

---

## Phase 1: Scaffold + Design System + Domain Contracts
**Duration:** 2h | **Window:** 15 Oct 10:00-12:00

### Goal
Running Next.js (App Router) + TypeScript + Tailwind CSS with Industrial HUD design system tokens, pure domain contracts in `src/domain` with Zod schemas, synthetic scenario in `src/data`, hardened security headers, and Home + 404 app shell. No placeholder copy, no Framer Motion.

### Tasks
1. Scaffold Next.js (App Router) + TypeScript + Tailwind CSS.
2. Install ONLY approved dependencies: `@react-three/fiber`, `@react-three/drei`, `three`, `@types/three`, `gsap`, `vitest`, `zod`. (STACK OVERRIDE: Zero Framer Motion; GSAP, CSS transitions, and R3F only).
3. Configure Industrial HUD tokens as CSS variables and Tailwind theme:
   - Base: Graphite (`#0d0f11` dark, crisp light companion)
   - Accent: Single signal color Amber (`#f59e0b` used strictly for hazard / uncertainty alert)
   - Fonts: Space Grotesk (headings/display) + JetBrains Mono (data/metrics) via `next/font`
   - Dark mode default with tested light mode; toggle persisted in localStorage with try/catch; zero flash on load.
   - Visible focus states, hover states, `prefers-reduced-motion` support.
   - Provenance chip component (`Observed`, `Model-inferred`, `Human-verified`, `Configured`, `Simulated`, `Calculated`, `AI-generated`) distinguishable without color alone.
4. App shell:
   - Skip-to-content link, sticky header with clickable SVG logo, navbar with ONLY links to existing pages (Home), mobile menu, footer with working links and dynamic copyright year.
   - Original SVG favicon mark (no AI imagery).
   - Custom 404 page.
   - Home page with real value statement, CTA above the fold, tagline *"Every item passes the gate. Risky ones never reach the compactor."*
   - Unique title + meta description via Next.js metadata. No horizontal scroll at 360px.
   - Zero placeholder text, zero lorem ipsum, zero TODO text in UI.
5. Domain contracts in `src/domain` (pure TS types + Zod schemas, zero UI imports):
   - `MaterialClass`: `'recyclable' | 'reusable' | 'biodegradable' | 'hazardous'`
   - `Provenance`: `'Observed' | 'Model-inferred' | 'Human-verified' | 'Configured' | 'Simulated' | 'Calculated' | 'AI-generated'`
   - `Detection`: `{ id, box: BoundingBox | null, label, materialClass, hazardProbability, confidence, source, provenance }`
   - `Item`: `{ id, barcode?, detections, primaryClass, hazardScore, status, routeId?, provenance, timestamp }`
   - `RouteId`: `'compactor' | 'inspection_line' | 'recyclable_bay' | 'reusable_bay' | 'biodegradable_bay' | 'hazard_hold'`
   - `EngineConfig`: `{ threshold, safetyFloor, assumptions: Assumption[] }`
   - `Assumption`: `{ id, label, value, unit, description, provenance }`
   - `ReplayBranch`: `{ id, label, threshold, itemsRouted, hazardDivertedCount, escapeCount, inspectionLoadPct }`
   - `AuditEvent`: `{ id, timestamp, itemId, stage, action, reason, actor, provenance }`
   - `SortingLineStage`: `'intake' | 'scanning' | 'uncertainty_gate' | 'diverting' | 'routed'`
6. Deterministic synthetic scenario in `src/data/scenario.ts`:
   - 12 realistic sorting items spanning all 4 classes, including ambiguous battery items (e.g., disposable vape, damaged power bank, smartphone with swollen battery).
   - Every record labeled `Simulated` provenance.
7. Security baseline:
   - `.gitignore` (comprehensive)
   - `.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`, no secret values)
   - `next.config.ts` security headers (CSP tailored for R3F, WASM, web workers, Hugging Face CDN in connect-src; `Permissions-Policy`, `Referrer-Policy`, `X-Frame-Options`), `productionBrowserSourceMaps: false`, zero `dangerouslySetInnerHTML`.
8. Verification gate:
   - Typecheck (`tsc --noEmit`), lint (`npm run lint`), build (`npm run build`), Vitest schema test passing, npm audit clean, viewports (360px, 768px, 1280px) responsive, keyboard-only tab pass. Index with Code Review Graph.

### Domain Contracts (locked after Phase 1)
All subsequent phases consume and produce these types. No phase may invent new domain objects without updating `src/domain` AND this doc.

---

## Phase 2: Deterministic TypeScript Engine + Tests
**Duration:** 2h | **Window:** 15 Oct 12:00-14:00

### Goal
Pure-TS engine that computes routing decisions, hazard exposure, throughput, inspection load, and cost-of-error. 100% unit tested. No UI, no API calls.

### Tasks
1. Create `src/lib/engine/index.ts` with pure functions:
   - `computeRoute(input: EngineInput): EngineOutput`
   - `computeHazardExposure(class, throughputRate): number` (probability * consequence model)
   - `computeInspectionLoad(diversionRate, throughputRate): number` (items/hour needing human check)
   - `computeCostOfError(class, errorType): number` (financial + safety cost estimate)
   - `compareRoutes(branch1: ReplayBranch, branch2: ReplayBranch): BranchComparison`
2. Write assumptions file: `src/lib/engine/assumptions.ts` -- all numeric constants labeled with source
3. Write Vitest tests: `src/lib/engine/__tests__/engine.test.ts`
   - Happy path: all 4 classes
   - Edge cases: confidence at threshold boundary
   - Hazardous override: always diverts regardless of confidence
   - Branch comparison: verify math
4. Run tests: `npx vitest run`
5. Document API in `docs/ENGINE_API.md` (brief, lists functions + return types)

### Verification Gate
- [ ] `npx vitest run` -- all tests pass
- [ ] 100% function coverage on engine module
- [ ] `tsc --noEmit` exits 0
- [ ] No external API calls in engine (grep for fetch/axios/import from external)
- [ ] All numeric constants in assumptions.ts (none hardcoded inline)

---

## Phase 3: CV Pipeline + Uncertainty Gate + Eval Set
**Duration:** 3h | **Window:** 15 Oct 14:00-17:00

### Goal
Working browser-side CV inference chain (MobileNet -> CLIP fallback), uncertainty gate logic, and 20-image eval set with real accuracy metrics.

### Tasks
1. Install Transformers.js: `npm install @xenova/transformers`
2. Create `src/lib/cv/mobilenet.ts`: wrapper around Xenova/mobilenet-v2, label mapping to WasteClass
3. Create `src/lib/cv/clip.ts`: wrapper around Xenova/clip-vit-base-patch32, engineered prompts
4. Create `src/lib/cv/gate.ts`: UncertaintyGate logic
   - Inputs: tier1Result, tier2Result (if run), classificationHistory
   - Output: GateDecision { route: 'compactor' | 'inspection', reason, provenance }
   - Rules: confidence < threshold -> inspection; hazardous class -> always inspection
5. Create `src/lib/cv/pipeline.ts`: orchestrator (run Tier1, decide if Tier2 needed, combine, gate)
6. Create `src/components/cv/ModelLoader.tsx`: progress indicator (real bytes, not fake)
7. Create `src/components/cv/EvidenceLab.tsx`: image upload, CV boxes overlay, confidence ring, provenance chips
8. Collect 20 eval images (freely licensed, see CV_FEASIBILITY.md Section 7), store in `public/eval/`
9. Create `src/lib/eval/evalSet.ts`: labeled eval set definition
10. Run eval: `src/scripts/runEval.ts` (Node script, outputs confusion matrix JSON)
11. Store results in `src/lib/eval/results.json`
12. Eval screen component: `src/components/eval/EvalScreen.tsx` -- renders confusion matrix

### Verification Gate
- [ ] Model loads in browser (check DevTools Network tab: model files fetched)
- [ ] Image upload -> classification result appears < 5 seconds (after model loaded)
- [ ] Uncertainty gate correctly diverts: manually test power bank image -> INSPECTION
- [ ] Eval screen shows real confusion matrix (not placeholder)
- [ ] `npm run build` exits 0
- [ ] Mobile: upload works at 360px

---

## Phase 4: Replay Theatre + Audit Trail
**Duration:** 2h | **Window:** 15 Oct 17:00-19:00

### Goal
Replay Theatre showing same batch with two decision branches side-by-side; audit trail with print-safe incident report.

### Tasks
1. Create `src/lib/replay/replay.ts`: batch state management
   - Store batch of N items with classifications and gate decisions
   - Generate two branches: one with current thresholds, one with alternative
   - `computeBranchDivergence(batch, threshold1, threshold2): BranchComparison`
2. Create `src/components/replay/ReplayTheatre.tsx`:
   - Two-panel layout (left: branch A, right: branch B)
   - Items list showing routing per branch
   - Threshold slider affecting branch B in real time (engine recalculates)
   - Hazard divergence count: "X more items diverted in branch B"
   - Cinematic transition: camera/scroll animation when opening (GSAP)
3. Create `src/lib/audit/trail.ts`: IndexedDB (Dexie) storage
   - saveAuditEntry(entry: AuditEntry)
   - getAuditEntries(): Promise<AuditEntry[]>
   - exportCSV(): string (for print/copy)
4. Create `src/components/audit/AuditLog.tsx`:
   - Table view of all decisions
   - Copy button (copies CSV to clipboard)
   - Print button (triggers @media print stylesheet)
5. Confirmation modals: Reset Replay, Divert for Inspection, Approve Routing

### Verification Gate
- [ ] Replay shows different routings when threshold changes
- [ ] Branch comparison numbers match engine output (manual spot check)
- [ ] Audit entry created after every approve/divert action
- [ ] Print: audit log prints cleanly (test browser print preview)
- [ ] Confirmation modals work with keyboard (Enter/Esc)

---

## Phase 5: 3D Digital Twin (Sentinel Facility Scene)
**Duration:** 3h | **Window:** 15 Oct 19:00-22:00

### Goal
Working 3D sorting-line scene in React Three Fiber. Intake hopper, scanner gate with scan beam, diverter arm, compactor, inspection bay, four bins. Animated item routing. Low-power fallback.

### Tasks
1. Create `src/components/twin/SentinelScene.tsx`: main R3F Canvas
2. Scene objects (simple geometries, no complex meshes):
   - `ConveyorBelt.tsx`: animated UV texture, BoxGeometry x3 (belt sections)
   - `ScannerGate.tsx`: arch shape, scan beam plane (amber, animated opacity + position)
   - `DiverterArm.tsx`: rotates when diverting (GSAP rotation tween)
   - `InspectionBay.tsx`: side track, amber spotlight ring
   - `Compactor.tsx`: box with crush animation (scale Y tween on "process")
   - `WasteBin.tsx` x4: labeled bins, hazardous bin has amber edge light
   - `WasteItem.tsx`: box/cylinder geometry, color by class, amber highlight if hazardous
3. Create `src/lib/twin/twinState.ts`: real-time state (Zustand or useReducer)
   - currentItem, route, scanProgress, binCounts, inspectionQueue
4. Camera: OrbitControls with min/max polar angle locked (no upside-down view), auto-reset on route change
5. Lighting: HemisphereLight (base) + DirectionalLight (main) + PointLight (hazard item) + SpotLight (scanner)
6. GSAP timeline: item moves along conveyor, gate scans (beam sweeps), diverter flips OR item continues, drops into bin
7. Low-power mode: `src/components/twin/FallbackDiagram.tsx` -- SVG version of same scene
8. Device detection: navigator.hardwareConcurrency + deviceMemory, toggle in header

### Verification Gate
- [ ] Scene renders in browser without WebGL errors
- [ ] Full routing animation plays: intake -> scan -> (divert or proceed) -> bin/inspection
- [ ] Amber light ONLY on hazardous items (spot check: plastic bottle has no amber light)
- [ ] OrbitControls: user can rotate scene; polar limits enforced
- [ ] Low-power mode: 2D SVG renders correctly, same routing animation in CSS
- [ ] Performance: 60fps on modern laptop (Chrome DevTools Performance tab)
- [ ] Mobile: scene renders at 360px (may auto-switch to low-power)

---

## Phase 6: Main UI + All Pages
**Duration:** 2.5h | **Window:** 15 Oct 22:00-00:30

### Goal
All 8 pages complete, all navigation working, all P1 UI features in, SEO metadata on every page.

### Tasks
1. Home page (app/page.tsx):
   - H1 above fold, CTA "Try the Scanner" (links to /app)
   - What is Loopgate section (3 experience cards: Sentinel Facility, Evidence Lab, Replay Theatre)
   - How it works (3-step diagram, no fake metrics)
   - Honest limitation box: "What Loopgate cannot do" (chemistry detection, fire prediction)
2. App page (app/app/page.tsx):
   - Tab/section switcher: Sentinel Facility | Evidence Lab | Replay Theatre | Eval
   - Profile selector: household / hostel / facility operator
   - Compose: SentinelScene + EvidenceLab + ReplayTheatre + EvalScreen components
3. About page: team role cards, project context, event name
4. FAQ page: 7 expandable questions with smooth animation
5. Contact page: mailto form, inline success state
6. Privacy page: full honest policy, "no cookies" statement
7. Terms page: key disclaimer clause, usage terms
8. 404 page: styled, CTA to home
9. sitemap.ts, robots.ts (Next.js App Router)
10. All SEO metadata via generateMetadata() on each page
11. OG tags on all pages
12. Favicon (generate SVG-based, import in layout.tsx)
13. P1 UI features: breadcrumbs (About/FAQ/Privacy/Terms), print stylesheet (Evidence Lab), reduced-motion

### Verification Gate
- [ ] `npm run build` exits 0 (zero TypeScript errors, zero lint errors)
- [ ] All 8 pages render at localhost:3000/[route]
- [ ] sitemap.xml accessible at /sitemap.xml
- [ ] robots.txt accessible at /robots.txt
- [ ] OG tags verified with browser DevTools
- [ ] Mobile: all pages at 360px (no horizontal scroll)
- [ ] Keyboard nav: Tab through all interactive elements in order
- [ ] Dark mode: all pages correct in both modes
- [ ] `npm run lint` exits 0

---

## Phase 7: GenAI Integration + Fallback + Personalization
**Duration:** 2h | **Window:** 16 Oct 00:30-02:30

### Goal
Gemini 2.0 Flash vision API route for second-opinion; plain-text explanation grounded in engine numbers; deterministic fallback when API is down; profile-based personalization.

### Tasks
1. Create `src/app/api/analyze/route.ts`:
   - POST endpoint receiving: image (base64), classificationResult, profile
   - Validates: file size <= 4MB, MIME type allowlist
   - Rate limiter: 10 req/min per IP (in-memory Map, sliding window)
   - Builds Gemini prompt from hardcoded template + calculated engine numbers
   - Calls `@google/generative-ai` with GEMINI_API_KEY from env
   - Returns: { explanation: string, geminiClass: WasteClass, confidence: number }
   - On error: returns 503 with fallback flag
2. Create `src/lib/genai/templates.ts`: deterministic fallback templates
   - One template per WasteClass x UserProfile (12 templates)
   - Templates use engine output numbers: "This item has an estimated hazard exposure of {value}..."
   - Templates labeled: "AI-generated (template -- service unavailable)"
3. Create `src/lib/genai/client.ts`: fetch wrapper with fallback logic
4. Create `src/components/genai/ExplanationCard.tsx`:
   - Shows explanation text (plain text, no dangerouslySetInnerHTML)
   - Shows provenance chip: AI-generated or AI-generated (template)
   - Profile switcher affects language (household: simple, facility: technical)
5. Env check at startup: log warning if GEMINI_API_KEY not set
6. Security: CSP header confirms Gemini API domain allowed

### Verification Gate
- [ ] API route returns 200 with valid JSON when GEMINI_API_KEY set
- [ ] API route returns 503 + fallback template when GEMINI_API_KEY not set
- [ ] Rate limiter: 11th request in 1 minute returns 429 (test with curl loop)
- [ ] Oversized image (> 4MB) returns 413
- [ ] Wrong MIME type returns 415
- [ ] AI output renders as text, no HTML injection possible (test with XSS payload in prompt response)
- [ ] Profile switching changes explanation language
- [ ] Provenance chip shows correctly for both real AI and template

---

## Phase 8: Integration + Security Audit + SEO + Deploy + PPT
**Duration:** 3h | **Window:** 16 Oct 02:30-05:30

### Goal
End-to-end flow verified, security audit passed, production deployed on Vercel, PPT outline ready.

### Tasks
1. Full end-to-end smoke test: upload image -> CV -> gate -> engine -> 3D twin -> approve -> replay -> AI explanation
2. `npm audit --audit-level=high` -- must pass clean
3. gitleaks scan: `gitleaks detect --source . --verbose` -- must return no findings
4. Verify `.env.local` not in git history
5. Production build: `npm run build` -- zero warnings, zero errors
6. Test production build locally: `npm run start`
7. Vercel deployment:
   - Connect GitHub repo to Vercel
   - Set GEMINI_API_KEY env var in Vercel dashboard
   - Set NEXT_PUBLIC_SITE_URL env var
   - Deploy: push to main triggers auto-deploy
8. Verify deployed URL:
   - All 8 pages load
   - CV inference works (check browser console, no errors)
   - AI route works (network tab shows /api/analyze returning 200)
   - Security headers: verify with securityheaders.com or curl -I
9. PPT outline (create in parallel or after deploy):
   - Slide 1: Title -- Loopgate, DSU Code Clash 2.0
   - Slide 2: The Problem (battery fires, real data)
   - Slide 3: Our Solution (connected workflow diagram)
   - Slide 4: Tech Stack (honest, all open-source)
   - Slide 5: Three Experiences (screenshots)
   - Slide 6: Live Demo (show this slide, then switch to app)
   - Slide 7: Honesty First (what we DON'T claim + Eval screen)
   - Slide 8: Scoring alignment (rubric table)
   - Slide 9: Team roles
10. Demo script rehearsal (time it: aim for < 5 minutes)

### Verification Gate
- [ ] Deployed URL loads within 3 seconds (first load)
- [ ] CV inference completes in browser (model loads from HF hub)
- [ ] Full demo flow works end-to-end on deployed URL
- [ ] `npm audit --audit-level=high` passes
- [ ] gitleaks: no findings
- [ ] securityheaders.com: A rating or better
- [ ] Mobile: deployed URL works at 360px
- [ ] Sitemap and robots.txt live at deployed URL
- [ ] No placeholder text on any page
- [ ] No "Made with AI" tag anywhere
- [ ] Demo rehearsed: < 5 minutes end-to-end

---

## P2 Features (add only if time before 16 Oct 13:30 after Phase 8 verified)

| Feature | Time estimate |
|---------|---------------|
| Scroll progress bar (landing) | 30min |
| Back-to-top button | 20min |
| Floating contact button | 20min |
| Site search | 90min |

---

## Demo Script for Judging (detailed)

### Sequence (target: 4-5 minutes)

**00:00 - 00:30** -- Landing page
- Open loopgate.vercel.app
- Read tagline aloud: "Every item passes the gate..."
- Click "Try the Scanner"

**00:30 - 01:30** -- Evidence Lab (CV demo)
- Upload image: power bank (the hero case)
- Watch model load progress ring
- CV results appear: HAZARDOUS, confidence 34% (amber)
- Uncertainty gate fires: "DIVERT FOR INSPECTION"
- Show provenance chips: Model-inferred, not Human-verified
- Click "Get AI second opinion": Gemini confirms hazardous
- Show: "Loopgate does not claim to detect battery chemistry -- only visual similarity"

**01:30 - 02:30** -- Sentinel Facility (3D twin)
- Click "Approve Divert" confirmation modal
- 3D scene: item moves from scanner gate to inspection bay (amber spotlight)
- Show bin counts update
- Switch profile: "Facility Operator" mode -- technical metrics visible
- Show: throughput 3 items/min, inspection load 0.8 items/min, cost-of-error estimate

**02:30 - 03:30** -- Replay Theatre
- Open Replay Theatre
- Cinematic camera sweep from intake to divergence point
- Branch A: current thresholds (4 items to inspection)
- Branch B: lower threshold -- slider to 50% -- (8 items to inspection, fewer hazard escapes)
- Show ambiguous item: old phone -- "Classified hazardous due to visual similarity to battery device"
- Show divergence metric: "Branch B prevents X additional potential hazard events"

**03:30 - 04:30** -- Eval Screen + Honesty
- Open Eval tab
- Show confusion matrix (20-image test set)
- Read accuracy number: "85% overall, but only 60% for vapes -- we flag this honestly"
- Show "Assumptions" button: all estimates labeled

**04:30 - 05:00** -- Wrap-up
- Return to landing page
- "All four PS-06 classes. Real CV. Real digital twin. Real numbers. No fake claims."

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CLIP model cold-start > 30s | HIGH | HIGH | Progressive loading; MobileNet runs in 1s; show partial result |
| Gemini API unavailable during judging | MEDIUM | MEDIUM | Deterministic templates; labeled as template |
| 3D scene crashes low-end laptop | MEDIUM | HIGH | Low-power 2D fallback; manual toggle |
| Phase 5 (3D) runs over time | HIGH | MEDIUM | Simplify geometries; defer complex animations to P2 |
| Phase 3 eval accuracy too low to show | LOW | MEDIUM | Honest display; frame as "this is why the uncertainty gate exists" |
| git push reveals API key | LOW | HIGH | gitleaks pre-commit; .env.local gitignored |
| Vercel cold-start > 3s for /api/analyze | LOW | LOW | Warm-up request on app load; users expect some delay |
| TrashNet model AGPL found at build time | LOW | MEDIUM | Use only Apache 2.0 models (CLIP + MobileNet as safe fallback) |
