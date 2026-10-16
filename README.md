# Loopgate

> **Uncertainty-Gated Waste Routing (Simulated Digital Twin)**  
> Problem Statement 06 // DSU Code Clash 2.0  
> **Live Demo:** [https://loopgate-rose.vercel.app](https://loopgate-rose.vercel.app)  
> **Team:** NEXARC | **Repository:** [selfabhijeetkumar/loopgate](https://github.com/selfabhijeetkumar/loopgate)

Loopgate is an epistemic uncertainty router and 3D digital twin that identifies and intercepts hazardous waste items (lithium-ion batteries, vape pens, aerosol canisters) before they reach automated municipal baling compactors.

---

## Architecture

```mermaid
graph TD
    A[Conveyor Stream Input] --> B[In-Browser Perception Engine]
    B --> C[Object Detection: DETR ResNet-50]
    B --> D[Zero-Shot Verification: CLIP ViT]
    C --> E[Uncertainty Estimator]
    D --> E
    E --> F[Epistemic Gate Calculation<br>gateScore = 0.65·P_hazard + 0.35·Uncertainty]
    F --> G{P_hazard >= 0.30<br>Safety Floor EA-01}
    G -- Yes (Hard Floor) --> H[Hazardous Hold Stream]
    G -- No --> I{gateScore >= Threshold}
    I -- Yes --> J[Human Inspection Lane]
    I -- No --> K[Class Bay / Compactor Stream]
    
    style H fill:#e74c3c,stroke:#c0392b,color:#fff
    style J fill:#f39c12,stroke:#d68910,color:#fff
    style K fill:#2ecc71,stroke:#27ae60,color:#fff
```

---

## Live Screenshots

| 01. Hero & Digital Twin | 02. Scan & Gate Split View |
|:---:|:---:|
| ![Hero View](docs/screenshots/01-hero.png) | ![Scan & Gate](docs/screenshots/02-scan-and-gate.png) |

| 03. Interactive 3D Twin | 04. Replay Theatre |
|:---:|:---:|
| ![3D Twin](docs/screenshots/03-interactive-twin.png) | ![Replay](docs/screenshots/04-replay.png) |

| 05. Evidence Lab Real CV | 06. GenAI Explanation Engine |
|:---:|:---:|
| ![Evidence Lab](docs/screenshots/05-evidence-lab-sample.png) | ![GenAI Explainer](docs/screenshots/06-genai-explainer.png) |

| 07. FAQ & Auditing | 08. About & Team NEXARC |
|:---:|:---:|
| ![FAQ](docs/screenshots/07-faq.png) | ![About Team](docs/screenshots/08-about.png) |

| 09. Mobile View (375px) | 10. Mobile 3D Canvas Responsive |
|:---:|:---:|
| ![Mobile Hero](docs/screenshots/09-mobile-hero.png) | ![Mobile Twin](docs/screenshots/10-mobile-twin.png) |

---

## Key Capabilities

1. **In-Browser Vision Perception**:
   - Zero-shot classification and open-vocabulary detection in software.
   - Fallback chain: DETR ResNet-50 + zero-shot CLIP classification + verified bounding crops.
   - Strict provenance discipline: every metric and label is explicitly marked (`Calculated`, `Simulated`, `Model-inferred`).

2. **Deterministic Uncertainty Engine**:
   - Closed-form gate score calculation:
     $$\text{gateScore} = 0.65 \times p(\text{hazard}) + 0.35 \times \text{uncertainty}$$
   - **Invariant EA-01**: Hard safety floor at $p(\text{hazard}) \ge 0.30$. Any item meeting or exceeding this threshold is strictly barred from the compactor stream under all operator configurations.

3. **Full-Viewport 3D Facility Digital Twin**:
   - Interactive line visualization built with React Three Fiber and Three.js.
   - Critically damped spring camera smoothing ($\omega = 7.2\,\text{rad/s}$, zero overshoot, frame-rate independent).
   - Seeded procedural deep-space backdrop with 3 parallax layers and twinkle animation.
   - Dynamic floor ripple shader with horizon fade into industrial background `#070a0d`.
   - Quality tiers (`HIGH`, `MEDIUM`, `LOW`) with dynamic performance downgrade and `prefers-reduced-motion` compliance.

---

## Getting Started & Reproduction Steps

### Prerequisites
- Node.js 18+ (tested on Node 20+)
- npm or pnpm

### Installation
```bash
git clone https://github.com/selfabhijeetkumar/loopgate.git
cd loopgate
npm install
```

### Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

### Verification & Testing
```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Unit and integration tests (Vitest - 114 passing tests)
npm test

# Production build
npm run build
```

---

## License
Private repository for DSU Code Clash 2.0 evaluation.

