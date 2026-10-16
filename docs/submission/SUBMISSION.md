# SUBMISSION.md — DSU Code Clash 2.0 (Problem Statement 06)

**Project:** Loopgate — Autonomous Uncertainty Gating for High-Speed Materials Recovery  
**Problem Statement:** PS06  
**Competition:** DSU Code Clash 2.0  

---

## Submission Details

> **Note for Judge / Reviewer:** The fields below are populated by the submitter for evaluation.

| Field | Value |
|---|---|
| **Live Demo URL** |  |
| **Demo Video URL** |  |
| **PPT File Name** |  |
| **GitHub Repository URL** |  |
| **Team Members and Roles** |  |
| **Contact Email** |  |

---

## START HERE: Unattended Evaluation Guide

Judging is unattended (no live pitch). The application is fully self-guided and runs without requiring model downloads or cloud credentials:

1. **Step 1: Experience the 3D Digital Twin**  
   Open the home page. Scroll through the six chapters (Intake, Multispectral Scan, Diverter Gate, Route Audit, Run It Yourself, Stream Balancing). Every metric is labeled with its provenance (`[OBSERVED]`, `[CALCULATED]`, or `[SIMULATED]`).

2. **Step 2: Compare Lines in Replay Theatre**  
   Scroll down to `#replay` to observe side-by-side execution of the Standard Ungated Baseline line versus the Loopgate Autonomous Gate. Step through items and observe EA-01 Safety Floor invariant enforcement (`p(hazard) >= 0.30` automatically triggers diversion).

3. **Step 3: Test Real In-Browser CV in Evidence Lab**  
   Scroll down to `#evidence` and click **"Load simulated sample"** for instantaneous evaluation, or upload any photo of items (bottles, phones, remotes). Real vision detection (Xenova/detr-resnet-50) runs locally inside a dedicated Web Worker via ONNX WebAssembly, with CLIP crop zero-shot verification.

---

## Architecture & Technical Highlights

- **Pure TypeScript Engine:** 91 passing automated unit tests (`npm test`).
- **Single WebGL Context:** Full-viewport R3F world with GSAP ScrollTrigger camera choreographies, custom GLSL celestial dome shader, and DOM HUD overlays positioned without R3F React root unmounts.
- **In-Browser Machine Learning:** Zero-server Web Worker pipeline using HuggingFace Transformers.js (`detr-resnet-50` COCO detector + `clip-vit-base-patch32` crop classification).
- **Honest Grounding & Provenance:** Every single number, cost projection, and routing score is explicitly attributed to its mathematical source or marked as a simulated estimate.
- **Strict Disclaimers:** No false claims of fire prevention or actuarial certainty. Indian DPDP Act principles observed: zero PII collection, zero cookies, local-first image processing.

---

## Local Verification Commands

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Run production build validation
npm run build
```
