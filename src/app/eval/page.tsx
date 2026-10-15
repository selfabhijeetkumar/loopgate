/**
 * src/app/eval/page.tsx
 * Dedicated route for the Evaluation Harness & Screen.
 */

import React from 'react';
import { Header } from '@/components/Header';
import { EvalHarness } from '@/components/eval/EvalHarness';
import Link from 'next/link';

export const metadata = {
  title: 'Evaluation Screen // Loopgate',
  description: 'Empirical model accuracy, confusion matrix, hazard recall, and abstention rate on validation photos.',
};

export default function EvalPage() {
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
          <span className="text-amber-400">EMPIRICAL EVALUATION</span>
        </div>

        {/* Section Heading */}
        <div className="space-y-2 border-b border-border-subtle pb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Model Validation // Ground Truth Testing
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text-primary">
            Empirical <span className="font-serif-italic font-normal text-amber-400">Evaluation</span>
          </h1>
          <p className="text-xs font-mono text-text-secondary max-w-2xl leading-relaxed">
            Measures observed performance of the open-vocabulary detector and zero-shot classifier on real waste photos.
            Displays per-class accuracy, full confusion matrix, hazardous-item recall, and safety floor abstention rate.
          </p>
        </div>

        {/* Evaluation Harness */}
        <EvalHarness />
      </main>
    </div>
  );
}
