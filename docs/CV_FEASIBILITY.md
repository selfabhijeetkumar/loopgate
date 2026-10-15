# CV_FEASIBILITY.md
<!-- Computer Vision feasibility & architecture for Loopgate -->
<!-- Last updated: 2026-10-15 (Phase 0 Corrections Applied) -->

## 1. Classification & Detection Task Definition

The computer vision system operates on municipal sorting lines to identify waste items and prevent catastrophic compactor battery fires:

| Class | Sub-categories | Hazard Priority | Safety Implication |
|-------|---------------|-----------------|---------------------|
| Recyclable | Paper, cardboard, glass, clean metal, PET, HDPE plastics | Low | Standard sorting flow to baler |
| Reusable | Intact electronics, functional garments, repairable tools | Medium | Divert to refurbishment / reuse streams (may contain embedded batteries) |
| Biodegradable | Food scraps, compostable packaging, organic matter | Low | Divert to composting line |
| Hazardous | Lithium-ion batteries, power banks, vape pens, swollen cells, chemical aerosols | HERO | Compactor fire risk -- triggers Gate Score evaluation & Safety Floor |

### Key Insight: Uncertainty Gate & Safety Floor
Visual inspection cannot definitively verify internal battery chemistry or cell degradation. Therefore:
1. **Gate Score:** Computed from estimated hazard probability ($P_{hazard}$), model confidence ($C$), and cross-stage model disagreement ($\Delta_{models}$).
2. **Safety Floor ($S_{floor}$):** An absolute safety constraint. Any item with $P_{hazard} \ge S_{floor}$ (e.g., 0.30) can **never** be auto-routed to compaction under any circumstances; it must divert to the manual inspection line.
3. **User-Adjustable Inspection Threshold ($\tau$):** Facility operators adjust the sensitivity threshold $\tau \in [0.10, 0.90]$. Any item with $\text{GateScore} \ge \tau$ routes to manual inspection.
4. **Deterministic Exposure vs. Load Analysis:** The engine evaluates every threshold setting against historical/simulated data to output the exact trade-off between **Expected Hazard Exposure** (% hazardous escaping to compaction) and **Inspection Load** (% total items diverted to human review).

---

## 2. Multi-Stage Browser-Side CV Architecture

Whole-image classification (such as MobileNet) cannot detect item bounding boxes, cannot handle multi-item scenes, and lacks classes for hazardous battery-containing devices. Loopgate uses a rigorous multi-stage pipeline:

```
[ Uploaded Image / Camera Frame ]
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 1: Item Detection & Bounding Boxes                │
│ Primary: DETR (ResNet-50) or OWL-ViT Zero-Shot          │
│ Fallback: Human-Verified Box (User draws/taps bounding) │
│ Preview Only: MobileNet-v2 (Labeled fast scene preview) │
└──────────────────────────┬──────────────────────────────┘
                           │ Bounding Box Crops + Confidence
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Stage 2: Crop Classification & Battery Detection        │
│ Model: CLIP-ViT-Base-Patch32 (quantized ONNX)           │
│ Zero-shot prompts for 4 classes + battery devices       │
└──────────────────────────┬──────────────────────────────┘
                           │ Class Probabilities (P_hazard, etc.)
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Uncertainty Gate Evaluation                             │
│ Check Safety Floor (P_hazard >= S_floor)                │
│ Compute Gate Score (f(P_hazard, Conf, Disagreement))   │
│ Compare against Operator Threshold tau                  │
└──────────────────────────┬──────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    [ AUTO-ROUTE: Safe ]        [ DIVERT: Inspection Line ]
                                         │
                                         ▼ (Optional User Request)
                        ┌─────────────────────────────────┐
                        │ Stage 3: GenAI Second Opinion   │
                        │ Gemini API (Server Route)       │
                        │ SHA-256 Hash Cached / Rate-Safe │
                        └─────────────────────────────────┘
```

---

## 3. Component Details & Model Candidate Evaluation

### Stage 1: Per-Item Detection Stage (with Bounding Boxes)

| Candidate Model | Hugging Face ID | Licence | Model Size | Browser Load Time | Inference (CPU WASM) | Strengths / Trade-offs |
|-----------------|-----------------|---------|------------|-------------------|----------------------|------------------------|
| **DETR (ResNet-50)** | `Xenova/detr-resnet-50` | **Apache 2.0** | ~160 MB | 10–18 s cold | 500 ms – 1.2 s | Solid box localization on standard objects; COCO pre-trained. |
| **OWL-ViT Base** | `Xenova/owlvit-base-patch32` | **Apache 2.0** | ~340 MB | 18–30 s cold | 1.8 s – 3.5 s | Open-vocabulary zero-shot detection. Can query directly for "battery", "vape", "bottle". Heavier download. |
| **OWLv2 Base** | `Xenova/owlv2-base-patch16-ensemble` | **Apache 2.0** | ~300 MB | 15–25 s cold | 1.5 s – 3.0 s | Higher accuracy zero-shot detector. |
| **MobileNet-v2** | `Xenova/mobilenet-v2` | **Apache 2.0** | ~13 MB | 1–2 s | < 80 ms | **NOT item detection.** ImageNet whole-image classifier only. Kept solely as an optional fast scene preview if useful; never presented as item detection. |
| **Human Fallback** | *Interactive Canvas* | N/A | 0 MB | Instant | 0 ms | Operator/user taps or drags a bounding box around an item in the UI. Explicitly labeled **Human-verified** provenance chip. |

*Licence constraint:* Zero AGPL models permitted. All candidate models are Apache 2.0.

### Stage 2: Crop Classification into 4 PS Classes + Battery Prompts

**Model:** `Xenova/clip-vit-base-patch32`
- **Licence:** Apache 2.0 (Commercial & hackathon safe)
- **Model Size:** ~150 MB (quantized ONNX shards)
- **Inference Speed:** 300–800 ms per cropped box on CPU WASM
- **Engineered Prompts:**
  - Recyclable: *"a photo of recyclable waste such as a clean plastic bottle, glass container, aluminum can, or cardboard box"*
  - Reusable: *"a functional second-hand item, intact electronic device, unbroken tool, or wearable clothing"*
  - Biodegradable: *"organic waste, food scraps, compostable material, fruit peels, or paper food soiled packaging"*
  - Hazardous (Hero Prompts):
    - *"a lithium-ion battery, bare pouch cell, or rechargeable battery pack"*
    - *"a vape pen, disposable e-cigarette, or electronic vaporizer"*
    - *"a portable power bank or external battery charger"*
    - *"a damaged consumer electronic device with an internal rechargeable lithium battery"*
    - *"a chemical spray aerosol canister, pesticide bottle, or hazardous substance"*

### Stage 3: Optional GenAI Second Opinion (Server-Side)

**Model:** Google Gemini (`GEMINI_MODEL` env var, default `gemini-2.5-flash` or `gemini-2.5-flash-lite`, whichever is free and available)
- **Status & Limits (2026 Free Tier):**
  - Gemini 2.0 Flash is retired/deprecated in 2026. Free-tier quotas have been tightened.
  - Designed strictly for worst-case limits: **~5 RPM / 100 RPD**.
  - All claims of "15 RPM / 1,500 RPD" are removed.
- **Critical Architectural Invariant:**
  - Gemini is **OPTIONAL and NEVER in the critical sorting path**.
  - At most **one call per uploaded image**, triggered on operator demand ("Request AI Second Opinion").
  - **Deduplication & Cache:** Responses cached in browser/server memory by client-side SHA-256 image hash.
  - **Deterministic Fallback:** 12 offline deterministic scenario templates ensure zero UI failure even with zero internet or 429 quota exhaustion.
  - **Provenance:** Labeled strictly with the **AI-generated** provenance chip.

---

## 4. Model Loading & Performance Optimization Strategy

1. **Staged Prefetching:**
   - Landing page loads instantly with zero model overhead (< 150 KB JS).
   - Prefetching begins in a Web Worker after initial landing and idle window.
2. **Persistent Cache Storage:**
   - Models are stored using browser Cache Storage / IndexedDB (Transformers.js native cache) across sessions.
   - Subsequent visits achieve instant model instantiation from local disk.
3. **Visible Progress UI:**
   - Shows true byte download progress, model shard names, and status (e.g. `Downloading clip-vit-base-patch32 [72MB / 150MB]`).
   - No simulated or fake progress bars.
4. **Instant Interactive Scenario Samples:**
   - 12 pre-computed deterministic synthetic scenarios in `src/data` are functional immediately upon page load without waiting for any neural network to download.
5. **Venue Preparation Note:**
   - **Crucial Demo Rule:** Pre-warm the browser cache on venue Wi-Fi / local network prior to judging presentations.
6. **Privacy Disclosure:**
   - The privacy notice explicitly discloses that on-demand model weight files are fetched from the Hugging Face CDN (`https://huggingface.co`), with zero image data uploaded to third-party model servers.

---

## 5. Evaluation Set Plan (Phase 3 Execution)

Real, measured accuracy will be established in Phase 3 on a curated 20-image evaluation dataset spanning all four classes:
- Ground-truth labeled images (CC0 / permissive open datasets).
- Multi-item scenes and high-risk battery decoys (vapes, power banks, damaged electronics).
- Published confusion matrix, true positive / false positive rates, and empirical gate effectiveness.
- Strict honesty policy: All evaluation results are labeled **Simulated** or **Observed** with methodology assumptions visible.
