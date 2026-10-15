/**
 * src/app/evidence/page.tsx
 * Dedicated route for the Evidence Lab.
 */

import React from 'react';
import { Header } from '@/components/Header';
import Link from 'next/link';
import EvidenceLabClient from './EvidenceLabClient';

export const metadata = {
  title: 'Evidence Lab // Loopgate',
  description: 'In-browser computer vision inspection and live link to the Sentinel 3D digital twin.',
};

export default function EvidencePage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-amber-500/20 selection:text-amber-300">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
          <Link href="/" className="hover:text-amber-400 transition-colors">
            LOOPGATE
          </Link>
          <span>/</span>
          <span className="text-amber-400">EVIDENCE LAB</span>
        </div>

        {/* Section Heading */}
        <div className="space-y-2 border-b border-border-subtle pb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Vision Pipeline // Material Recovery Telemetry
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary">
            Evidence <span className="font-serif-italic font-normal text-amber-400">Lab</span>
          </h1>
          <p className="text-xs font-mono text-text-secondary max-w-2xl leading-relaxed">
            Direct in-browser vision inference using open-vocabulary detection and zero-shot CLIP classification.
            Detected physical items can be refined and dispatched directly to ride the Sentinel 3D digital twin.
          </p>
        </div>

        {/* Evidence Lab Component — needs SimulationProvider (client boundary) */}
        <EvidenceLabClient />
      </main>
    </div>
  );
}
