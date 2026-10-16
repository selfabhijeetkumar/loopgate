# SUBMISSION.md — DSU Code Clash 2.0 (PS06)

**Project:** Loopgate — Autonomous Uncertainty Gating for High-Speed Materials Recovery  
**Problem Statement:** PS06  
**Competition:** DSU Code Clash 2.0  
**Author:** Abhijeet Kumar

---

## START HERE: How to Evaluate This Project

> **Judging is unattended.** There is no live pitch. Open the links below directly.

| Resource | Link |
|----------|------|
| **Live App** | https://loopgate.vercel.app *(deployed separately)* |
| **GitHub Repo** | https://github.com/selfabhijeetkumar/loopgate |
| **README** | [README.md](./README.md) |
| **Video Demo** | *(included in submission package)* |
| **Presentation** | *(included in submission package)* |

---

## What the Application Does

Loopgate simulates an **uncertainty-gated sorting system** for a municipal materials recovery
facility (MRF). It addresses PS06: automated waste sorting with ambiguity handling.

**Core capability:** Every item on the conveyor belt passes through a gate. Items with high
estimated hazard probability or high model uncertainty are diverted to a human-review lane
before reaching the compactor. The gate is deterministic and auditable.

---

## Key Features (Judge Checklist)

- [x] **3D Facility Digital Twin** — six-chapter scroll-driven tour of the facility
- [x] **In-Browser CV Pipeline** — DETR + CLIP running in a Web Worker, no server required
- [x] **Uncertainty Gate** — EA-01 invariant: P(hazard) >= 0.30 always diverts
- [x] **Evidence Lab** — upload a photo, run real object detection, see detection boxes
- [x] **Replay Player** — step through item decisions with full provenance
- [x] **Assumptions Table** — every constant is visible and labelled with its source
- [x] **Provenance System** — every data point tagged: Observed / Model-inferred / Simulated
- [x] **Works offline** — simulation runs without model download; CV enhances it optionally
- [x] **Accessible** — skip link, semantic HTML, ARIA labels, keyboard navigation
- [x] **Mobile-friendly** — responsive at 375px+

---

## Honesty Disclaimer

All throughput figures, diversion rates, and safety metrics are **simulation estimates**
computed from a deterministic engine. They are not measurements from physical sensors.
The application is honest about this fact in multiple places:

- Provenance chips label every number as [SIMULATED] or [CALCULATED]
- The hero copy says "Simulated estimates"
- The FAQ explicitly states that nothing is measured from hardware

---

## Technical Highlights

- Pure TypeScript engine with 89 passing unit tests (`npm test`)
- Web Worker CV pipeline: DETR ResNet-50 + CLIP ViT-B/32, WASM q8
- OWL-ViT removed: fails ONNX Runtime Cast node (documented in FAQ)
- Single WebGL context across the entire page (no context budget waste)
- GLSL custom shader starfield with three-layer parallax
- Critically damped camera motion smoother (no Framer Motion)
- CSP headers: no unsafe-inline JS executions except Next.js eval requirement

---

## Running Locally

```bash
git clone https://github.com/selfabhijeetkumar/loopgate
cd loopgate
npm install
npm run dev
# Open http://localhost:3000
```

Requirements: Node.js 20+, modern browser with WebGL + WASM support.

---

## Test Suite

```bash
npm test
# 89 passing tests across engine logic and CV pipeline mocks
```

---

*Submission prepared: October 2026*
