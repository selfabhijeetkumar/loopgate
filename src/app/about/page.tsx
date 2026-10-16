import type { Metadata } from 'next';
import Link from 'next/link';
import { ProvenanceChip } from '@/components/ProvenanceChip';

export const metadata: Metadata = {
  title: 'About | Loopgate (Simulated Digital Twin)',
  description:
    'About Loopgate: uncertainty-gated waste diversion simulation prototype built for DSU Code Clash 2.0 (PS06).',
};

export default function AboutPage() {
  return (
    <main
      id="main-content"
      className="relative z-10 flex-1 flex flex-col min-h-screen text-text-primary"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-text-secondary">About</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-none" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
              DSU Code Clash 2.0 // PS06 // Documentation
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-4 tracking-tight">
            About <span className="text-amber-400">Loopgate</span>
          </h1>
          <p className="text-base text-text-secondary font-sans leading-relaxed max-w-2xl">
            Loopgate is a browser-native prototype that simulates uncertainty-gated waste diversion
            for materials recovery facilities. It was built for DSU Code Clash 2.0,
            Problem Statement 06.
          </p>
        </div>

        {/* Honesty Notice */}
        <div className="mb-10 border border-amber-500/40 bg-amber-500/5 p-4 rounded-[2px]">
          <div className="flex items-start gap-3">
            <span className="text-amber-400 font-mono text-xs font-bold uppercase tracking-wider mt-0.5">
              Honesty Notice
            </span>
          </div>
          <p className="text-sm text-text-secondary font-sans leading-relaxed mt-2">
            All throughput figures, diversion rates, and safety metrics shown in this application
            are <strong>simulation-only estimates</strong>. They are computed from deterministic
            engine logic applied to a fixed 10-item scenario manifest, not from physical hardware
            sensor data. Nothing on this site should be interpreted as a claim about real-world
            recycling performance.
          </p>
        </div>

        {/* Problem Statement */}
        <section className="mb-10" aria-labelledby="problem-heading">
          <h2 id="problem-heading" className="text-xl font-display font-bold text-text-primary mb-4">
            The Problem
          </h2>
          <p className="text-sm text-text-secondary font-sans leading-relaxed mb-3">
            High-pressure compactors at municipal materials recovery facilities (MRFs) face severe
            thermal-runaway events when lithium cells, vape pens, or pressurised aerosol canisters
            enter the baling line. Current sorting systems either reject too aggressively (low
            throughput) or insufficiently (safety risk).
          </p>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">
            Loopgate models a middle path: an uncertainty gate that routes items whose hazard
            probability exceeds a configurable safety floor to a human-review lane, while letting
            clearly safe items pass to compaction. The gate score is a weighted combination of
            hazard probability and model uncertainty — neither metric alone.
          </p>
        </section>

        {/* Architecture */}
        <section className="mb-10" aria-labelledby="architecture-heading">
          <h2 id="architecture-heading" className="text-xl font-display font-bold text-text-primary mb-4">
            Architecture
          </h2>
          <div className="space-y-4">
            {[
              {
                layer: 'Engine',
                path: 'src/engine/',
                desc: 'Pure TypeScript decision engine. Deterministic gate scoring, invariant enforcement (EA-01 safety floor), and route assignment. Zero external dependencies.',
              },
              {
                layer: 'CV Pipeline',
                path: 'src/cv/',
                desc: 'In-browser Web Worker running @huggingface/transformers. DETR ResNet-50 detector + CLIP zero-shot classifier. Falls back to a deterministic simulation manifest if models fail to load.',
              },
              {
                layer: '3D World',
                path: 'src/components/world/',
                desc: 'React Three Fiber (R3F) facility digital twin. Six-chapter scroll-driven cinematic tour of the sorting facility. Single WebGL context, quality-tier adaptive rendering.',
              },
              {
                layer: 'App',
                path: 'src/app/',
                desc: 'Next.js App Router. Static pages for legal, legal notices, and information. API routes for the optional GenAI explanation endpoint.',
              },
            ].map((item) => (
              <div key={item.layer} className="border border-border-subtle bg-bg-surface/50 p-4 rounded-[2px]">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-amber-400 font-mono text-xs font-bold uppercase">{item.layer}</span>
                  <code className="text-xs text-text-muted font-mono">{item.path}</code>
                </div>
                <p className="text-sm text-text-secondary font-sans leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-10" aria-labelledby="stack-heading">
          <h2 id="stack-heading" className="text-xl font-display font-bold text-text-primary mb-4">
            Technology Stack
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono" aria-label="Technology stack">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted text-left">
                  <th className="pb-2 pr-6 font-normal uppercase tracking-wider">Category</th>
                  <th className="pb-2 pr-6 font-normal uppercase tracking-wider">Library / Tool</th>
                  <th className="pb-2 font-normal uppercase tracking-wider">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {[
                  ['Framework', 'Next.js 15 (App Router)', 'SSR + static routing'],
                  ['3D Rendering', 'React Three Fiber + Three.js', 'WebGL facility twin'],
                  ['CV Runtime', '@huggingface/transformers', 'In-browser ONNX inference'],
                  ['CV Models', 'DETR ResNet-50 + CLIP ViT-B/32', 'Object detection + classification'],
                  ['Animation', 'GSAP + ScrollTrigger', 'Scroll-driven camera tours'],
                  ['Styling', 'Tailwind CSS (utility-first)', 'Consistent design system'],
                  ['Language', 'TypeScript (strict)', 'Type safety throughout'],
                  ['Testing', 'Vitest', 'Engine + CV unit tests'],
                ].map(([cat, lib, purpose]) => (
                  <tr key={cat} className="border-b border-border-subtle/50 hover:bg-bg-surface/30">
                    <td className="py-2 pr-6 text-amber-400 font-bold">{cat}</td>
                    <td className="py-2 pr-6">{lib}</td>
                    <td className="py-2 text-text-muted">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Provenance System */}
        <section className="mb-10" aria-labelledby="provenance-heading">
          <h2 id="provenance-heading" className="text-xl font-display font-bold text-text-primary mb-4">
            Provenance System
          </h2>
          <p className="text-sm text-text-secondary font-sans leading-relaxed mb-4">
            Every data point displayed in Loopgate carries a provenance tag so judges and users
            can immediately understand whether a number is real, inferred, or assumed.
          </p>
          <div className="flex flex-wrap gap-3">
            {(['Observed', 'Model-inferred', 'Human-verified', 'Simulated', 'Calculated'] as const).map(
              (p) => <ProvenanceChip key={p} provenance={p as any} showPrefix={false} />
            )}
          </div>
        </section>

        {/* Team */}
        <section className="mb-10" aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-xl font-display font-bold text-text-primary mb-2">
            Team NEXARC
          </h2>
          <div className="text-xs font-mono text-amber-400 mb-4">
            Dayananda Sagar University, Bengaluru &bull; DSU Code Clash 2.0 &bull; Problem Statement 06
          </div>

          <div className="space-y-4 mb-6">
            <div className="border border-border-subtle bg-bg-surface/50 p-4 rounded-[2px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold text-text-primary">Abhijeet Kumar</span>
                <span className="text-xs font-mono text-amber-400 uppercase font-bold">Team lead</span>
              </div>
              <p className="text-xs text-text-secondary font-sans leading-relaxed">
                Concept and system design, engineering direction, integration, testing and deployment. Built the application with AI-assisted development tools (Antigravity).
              </p>
            </div>

            <div className="border border-border-subtle bg-bg-surface/50 p-4 rounded-[2px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold text-text-primary">Vaishnavi Isrannanvar</span>
                <span className="text-xs font-mono text-text-muted uppercase">Team member</span>
              </div>
              <ul className="text-xs text-text-secondary font-sans space-y-1 list-disc list-inside leading-relaxed mt-2">
                <li>Quality testing: tested the deployed app on her own devices and reported bugs.</li>
                <li>Eval photo set: took the object photos used in public/eval/ with her own phone.</li>
                <li>Content review: reviewed the FAQ, README and presentation for clarity and mistakes.</li>
                <li>Demo video: contributed to the demo video.</li>
              </ul>
            </div>
          </div>

          <h3 className="text-sm font-mono uppercase tracking-wider text-amber-400 font-bold mb-2">
            How this project was built
          </h3>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">
            The concept, design and engineering decisions were made by the team lead, the code was produced with AI-assisted development tools under his direction, and every number in the app comes from the deterministic engine or is labelled Simulated.
          </p>
        </section>

        {/* Footer links */}
        <div className="pt-8 border-t border-border-subtle flex flex-wrap gap-4 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-text-primary transition-colors">Home</Link>
          <Link href="/faq" className="hover:text-text-primary transition-colors">FAQ</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
        </div>
      </div>
    </main>
  );
}
