import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ | Loopgate',
  description:
    'Frequently asked questions about Loopgate: how it works, what the simulation estimates, how the CV pipeline runs, and what the judges see.',
};

type FaqEntry = { q: string; a: string };

const FAQS: FaqEntry[] = [
  {
    q: 'Is Loopgate a real deployed sorting system?',
    a: 'No. Loopgate is a browser-native simulation prototype built for DSU Code Clash 2.0 (PS06). All throughput figures, diversion rates, and safety metrics are computed from a deterministic engine running against a fixed 10-item scenario manifest, not from physical hardware.',
  },
  {
    q: 'Why does the demo work without downloading a model?',
    a: 'The simulation layer is always available and uses pre-configured hazard probabilities, confidence scores, and material classifications stored in the scenario manifest (src/data/scenario.ts). The in-browser CV pipeline (DETR + CLIP) only activates when a user uploads a photo on the Evidence Lab. If the models fail to load, the simulation continues normally with deterministic values.',
  },
  {
    q: 'What models does the CV pipeline use?',
    a: 'Stage 1 uses Xenova/detr-resnet-50 (DETR, COCO object detector) running via ONNX Runtime Web in a Web Worker. Stage 2 uses Xenova/clip-vit-base-patch32 (CLIP zero-shot image classifier) to classify each detected crop into material categories. Both run entirely in the browser — no server-side inference.',
  },
  {
    q: 'How does the vision pipeline detect and classify items?',
    a: 'The pipeline uses a multi-stage chain: (1) generic DETR detector (Xenova/detr-resnet-50) to localize common objects, (2) CLIP zero-shot classification (Xenova/clip-vit-base-patch32) on cropped boxes into 4 recovery classes and battery indicators, and (3) an optional hand-drawn box tool for human verification of objects not recognized by the generic detector.',
  },
  {
    q: 'What is the safety floor (EA-01)?',
    a: 'EA-01 is the invariant that any item with estimated hazard probability >= 0.30 must be diverted to the human-review lane — the compactor is never allowed to bale it. This threshold is configurable but has a minimum floor of 0.30. It is implemented in pure TypeScript in the engine and cannot be bypassed by the model layer.',
  },
  {
    q: 'What do the provenance tags mean?',
    a: '"Observed" means a value was read from a real sensor or measurement (none in this simulation). "Model-inferred" means estimated by an ML model. "Human-verified" means a human drew or confirmed a bounding box. "Simulated" means derived from the deterministic scenario manifest. "Calculated" means computed mathematically from other inputs. Every number in the UI carries one of these tags.',
  },
  {
    q: 'Does Loopgate store my photos?',
    a: 'No. The Evidence Lab processes your photo entirely in your browser via a Web Worker. The image pixels are transferred to the worker thread as an ArrayBuffer, processed, and then discarded. Nothing is sent to any server.',
  },
  {
    q: 'What is the gate score?',
    a: 'Gate score = (hazardWeight * hazardProbability) + (uncertaintyWeight * (1 - confidence)). If gate score >= safetyFloor, the item is diverted. The weights and floor are listed in the Assumptions table on the main page.',
  },
  {
    q: 'Can I run this locally?',
    a: 'Yes. Clone the repository, run npm install, then npm run dev. Visit http://localhost:3000. The 3D world requires WebGL. The CV pipeline requires a browser with Web Worker + WASM support (all modern browsers). On Windows, run: npm run dev (Next.js will use webpack if SWC binaries are unavailable).',
  },
  {
    q: 'Where is the source code?',
    a: 'The source code is available on GitHub at https://github.com/selfabhijeetkumar/loopgate. It is licensed under Apache 2.0 for original code, with model weights licensed per their respective Hugging Face repositories.',
  },
];

export default function FaqPage() {
  return (
    <main
      id="main-content"
      className="relative z-10 flex-1 flex flex-col min-h-screen text-text-primary"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">FAQ</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-none" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
              Documentation // Frequently Asked Questions
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
            Frequently Asked <span className="text-amber-400">Questions</span>
          </h1>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">
            Quick answers about the simulation, the CV pipeline, the scoring model, and the
            project&apos;s limitations.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-0 divide-y divide-border-subtle" role="list">
          {FAQS.map((faq, i) => (
            <div key={i} className="py-6" role="listitem">
              <h2 className="text-base font-display font-bold text-text-primary mb-2">
                {faq.q}
              </h2>
              <p className="text-sm text-text-secondary font-sans leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="pt-8 mt-8 border-t border-border-subtle flex flex-wrap gap-4 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/about" className="hover:text-text-primary transition-colors">About</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </main>
  );
}
