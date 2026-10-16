import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: '404 - Gate Routing Error | Loopgate',
  description: 'The requested facility routing path does not exist in the Loopgate material management system.',
};

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full border border-border-subtle bg-bg-surface p-6 sm:p-8 rounded-[2px] space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-[2px]" />
            <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">
              Routing Fault // 404
            </span>
          </div>
          <span className="text-xs font-mono text-text-muted">ERR_PATH_UNRESOLVED</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-text-primary tracking-tight">
            Item route not found in sorting manifold
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed font-sans">
            The conveyor target or sensor coordinates you requested are outside the active sorting line. No material was diverted.
          </p>
        </div>

        <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px] font-mono text-[11px] text-text-muted space-y-1">
          <div>STAGE: INTAKE_GATE_ROUTER</div>
          <div>STATUS: HALTED_ON_INVALID_COORDINATE</div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs uppercase tracking-wider font-bold rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            Return to Command Center
          </Link>
          <div className="flex items-center justify-center gap-4 text-xs font-mono text-text-muted pt-2">
            <Link href="/about" className="hover:text-amber-400">About</Link>
            <span>/</span>
            <Link href="/faq" className="hover:text-amber-400">FAQ</Link>
            <span>/</span>
            <Link href="/contact" className="hover:text-amber-400">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
