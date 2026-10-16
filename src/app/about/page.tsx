import type { Metadata } from 'next';
import Link from 'next/link';
import { ProvenanceChip } from '@/components/ProvenanceChip';

export const metadata: Metadata = {
  title: 'About Loopgate | Autonomous Uncertainty Gating for Materials Recovery',
  description:
    'Loopgate is a browser-native simulation of an uncertainty-gated waste sorting system. Learn about the project, its architecture, and how it was built for DSU Code Clash 2.0 (PS06).',
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
            Loopgate is a browser-native prototype that simulates autonomous uncertainty gating
            for high-speed materials recovery facilities. It was built for DSU Code Clash 2.0,
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
          <h2 id="team-heading" className="text-xl font-display font-bold text-text-primary mb-4">
            Built By
          </h2>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">
            Loopgate was designed and built by Abhijeet Kumar for DSU Code Clash 2.0,
            a 24-hour hackathon held at DSU, Problem Statement 06: autonomous waste sorting and
            uncertainty gating for materials recovery.
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
