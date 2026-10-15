'use client';

import React from 'react';

function smoothScrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function HeroCTAs() {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
      <a
        href="#twin"
        onClick={(e) => {
          e.preventDefault();
          smoothScrollTo('twin-controls');
        }}
        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider rounded-[2px] transition-colors"
      >
        Run the demo scenario &darr;
      </a>
      <a
        href="#decision"
        onClick={(e) => {
          e.preventDefault();
          smoothScrollTo('decision');
        }}
        className="px-3.5 py-2 text-text-secondary hover:text-text-primary border border-transparent hover:border-border-subtle uppercase tracking-wider rounded-[2px] transition-colors"
      >
        Decision Logic &darr;
      </a>
    </div>
  );
}
