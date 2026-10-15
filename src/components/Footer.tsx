import React from 'react';
import { ProvenanceChip } from './ProvenanceChip';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border-subtle bg-bg-surface text-text-secondary text-xs font-mono transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-border-subtle">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wider text-text-primary">
                LOOP<span className="text-amber-500">GATE</span>
              </span>
              <span className="text-text-muted text-[10px]">DSU Code Clash 2.0 (PS06)</span>
            </div>
            <p className="text-text-muted text-[11px] max-w-md font-sans">
              Routes risky waste before it reaches the compactor. Simulated estimates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wider">Provenance Registry:</span>
            <ProvenanceChip provenance="Observed" showPrefix={false} />
            <ProvenanceChip provenance="Model-inferred" showPrefix={false} />
            <ProvenanceChip provenance="Human-verified" showPrefix={false} />
            <ProvenanceChip provenance="Simulated" showPrefix={false} />
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[11px] text-text-muted">
          <div>
            &copy; {currentYear} Loopgate Project. Built for DSU Code Clash 2.0.
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://huggingface.co"
              target="_blank"
              rel="noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              Models via Hugging Face CDN
            </a>
            <span>/</span>
            <span className="text-text-secondary">Open Source (Apache 2.0 / MIT)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
