# Asset Inventory and Provenance Register

This document tracks all external and local assets used within the **Loopgate** system (Event: DSU Code Clash 2.0, Problem Statement 06).
In strict adherence to the project rules: **no scraped images, no downloaded third-party photo datasets, no AI-generated slop imagery, and no unauthorized proprietary assets** are permitted.

---

## 1. Evaluation Image Dataset (`public/eval/`)

| Asset Path | Material Class | Description / Ground Truth | Provenance | Source / License |
| :--- | :--- | :--- | :--- | :--- |
| `public/eval/eval_01_water_bottle.jpg` | recyclable | Crushed PET clear beverage bottle | Observed | Operator captured photograph |
| `public/eval/eval_02_aluminum_can.jpg` | recyclable | Standard aluminum soda beverage can | Observed | Operator captured photograph |
| `public/eval/eval_03_corrugated_cardboard.jpg` | recyclable | Brown corrugated shipping cardboard box scrap | Observed | Operator captured photograph |
| `public/eval/eval_04_power_bank.jpg` | hazardous | 10,000mAh external lithium battery pack | Observed | Operator captured photograph |
| `public/eval/eval_05_disposable_vape.jpg` | hazardous | Disposable vape pen with internal lithium cell | Observed | Operator captured photograph |
| `public/eval/eval_06_smartphone.jpg` | hazardous | Discarded cracked smartphone with lithium battery | Observed | Operator captured photograph |
| `public/eval/eval_07_food_scrap.jpg` | biodegradable | Mixed vegetable and fruit peel food scrap | Observed | Operator captured photograph |
| `public/eval/eval_08_denim_cloth.jpg` | reusable | Heavy denim cloth / cotton textile fragment | Observed | Operator captured photograph |
| `public/eval/eval_09_aerosol_can.jpg` | hazardous | Pressurized solvent spray canister | Observed | Operator captured photograph |
| `public/eval/eval_10_optical_mouse.jpg` | reusable | USB optical computer mouse (non-battery peripheral) | Observed | Operator captured photograph |

*Dataset Rules*: All images in `public/eval/` are authentic photos captured personally by the project author on standard consumer smartphone hardware. Metadata and ground truth annotations are defined in [`public/eval/labels.json`](file:///public/eval/labels.json).

---

## 2. In-Browser Machine Learning Models

| Component | Architecture / Checkpoint | Hosting / Provider | License | Execution Target |
| :--- | :--- | :--- | :--- | :--- |
| Open-Vocabulary Detector | `Xenova/owlvit-base-patch32` | Hugging Face Hub (CDN cached) | Apache-2.0 | Client-side Web Worker (WebGPU / WASM) |
| Zero-Shot Classifier | `Xenova/clip-vit-base-patch32` | Hugging Face Hub (CDN cached) | MIT | Client-side Web Worker (WebGPU / WASM) |
| Runtime Engine | `@huggingface/transformers` v3 | NPM | Apache-2.0 | Pure browser runtime; 0 paid API cost |

---

## 3. 3D World & Procedural Geometries

All 3D assets in the digital twin (`FacilityLine`, `WorldScene`, `ItemGeometry`, `Compactor`, `DiverterArm`, and sorting bays) are procedurally constructed using pure Three.js primitive geometries (`boxGeometry`, `cylinderGeometry`, `planeGeometry`).
No external 3D mesh files (.obj, .gltf, .fbx) or copyrighted textures are imported.
Photo tiles riding the conveyor belt are generated directly in-browser by cropping the user's uploaded evidence photograph.
