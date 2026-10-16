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

*Last updated: October 2026*
