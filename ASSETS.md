# ASSETS.md — Third-Party Asset Registry

All third-party libraries, models, and assets used in Loopgate are listed below.
Original application code (src/) is © 2026 Abhijeet Kumar, Apache 2.0.

---

## JavaScript / TypeScript Libraries

| Package | Version | License | Repository |
|---------|---------|---------|-----------|
| next | 15.x | MIT | https://github.com/vercel/next.js |
| react | 19.x | MIT | https://github.com/facebook/react |
| react-dom | 19.x | MIT | https://github.com/facebook/react |
| @react-three/fiber | 9.x | MIT | https://github.com/pmndrs/react-three-fiber |
| @react-three/drei | 10.x | MIT | https://github.com/pmndrs/drei |
| three | 0.170.x | MIT | https://github.com/mrdoob/three.js |
| @huggingface/transformers | 3.x | Apache-2.0 | https://github.com/huggingface/transformers.js |
| gsap | 3.x | GSAP Standard License | https://greensock.com/gsap/ |
| tailwindcss | 4.x | MIT | https://github.com/tailwindlabs/tailwindcss |
| typescript | 5.x | Apache-2.0 | https://github.com/microsoft/typescript |
| vitest | 3.x | MIT | https://github.com/vitest-dev/vitest |

> **Note on GSAP:** The free GSAP Standard License allows use in free and open-source projects.
> ScrollTrigger is bundled with the main `gsap` package. No Club GreenSock plugins are used.

---

## Machine Learning Models

| Model | License | Source |
|-------|---------|--------|
| Xenova/detr-resnet-50 | Apache-2.0 | https://huggingface.co/Xenova/detr-resnet-50 |
| Xenova/clip-vit-base-patch32 | MIT | https://huggingface.co/Xenova/clip-vit-base-patch32 |

Model weights are fetched at runtime from the Hugging Face CDN and cached in the
browser Cache API. They are not bundled with the application.

---

## ONNX Runtime Web (via @huggingface/transformers)

ONNX Runtime Web WASM binaries are included under:
- MIT License
- Copyright (c) Microsoft Corporation
- https://github.com/microsoft/onnxruntime

The `.wasm` files are served from `/public/ort/` (copied from `onnxruntime-web/dist/`).

---

## Fonts (Google Fonts via next/font)

| Font | License |
|------|---------|
| Space Grotesk | SIL OFL 1.1 |
| JetBrains Mono | SIL OFL 1.1 |
| Instrument Serif | SIL OFL 1.1 |

Fonts are loaded via Google Fonts CDN at build time via `next/font/google`.

---

## Icons and SVGs

All icons in the application are authored inline as SVG elements in TSX.
No third-party icon library is used.

---

## Image & Media Asset Provenance Registry

Every image file in `public/` and `docs/` is documented below with its provenance, source, and license:

| File Path | Description | Provenance & Source | License |
|---|---|---|---|
| `public/icon.svg` | Application logo / favicon | Custom vector illustration drawn for Loopgate | Apache-2.0 (Team NEXARC) |
| `public/file.svg` | Next.js default file glyph | Next.js starter template (Vercel Inc.) | MIT |
| `public/globe.svg` | Next.js default globe glyph | Next.js starter template (Vercel Inc.) | MIT |
| `public/next.svg` | Next.js framework wordmark | Next.js starter template (Vercel Inc.) | MIT |
| `public/vercel.svg` | Vercel platform triangle logo | Next.js starter template (Vercel Inc.) | MIT |
| `public/window.svg` | Next.js default window glyph | Next.js starter template (Vercel Inc.) | MIT |
| `docs/screenshots/01-hero.png` | Live hero twin interface | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/02-scan-and-gate.png` | Live scan & gate interface | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/03-interactive-twin.png` | Live 3D twin cinematic view | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/04-replay.png` | Live replay timeline theatre | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/05-evidence-lab-sample.png` | Live evidence lab evaluation | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/06-genai-explainer.png` | Live GenAI explanation card | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/07-faq.png` | Live FAQ & auditing screen | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/08-about.png` | Live about & team NEXARC page | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/09-mobile-hero.png` | Mobile viewport (375px) hero | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |
| `docs/screenshots/10-mobile-twin.png` | Mobile viewport (375px) 3D twin | Browser screenshot of live deployed site | Apache-2.0 (Team NEXARC) |

> **Sample Image Provenance:** The Evidence Lab sample photo is generated **100% in software via code** using HTML5 Canvas (`ctx.fillRect` silhouettes and geometric shapes on a dark `#0f172a` canvas). No stock photography or copyrighted third-party images are used anywhere in the repository.

---

*Last updated: October 2026*

