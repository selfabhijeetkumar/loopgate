import React from 'react';
import type { Provenance } from '../domain/types';

interface ProvenanceChipProps {
  provenance: Provenance;
  className?: string;
  showPrefix?: boolean;
}

const PROVENANCE_CONFIG: Record<
  Provenance,
  {
    prefix: string;
    borderStyle: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  Observed: {
    prefix: '[OBS]',
    borderStyle: 'border-solid',
    textColor: 'text-slate-300 dark:text-slate-300',
    bgColor: 'bg-slate-800/40 dark:bg-slate-800/40',
    borderColor: 'border-slate-600',
    description: 'Direct optical observation',
  },
  'Model-inferred': {
    prefix: '[INF]',
    borderStyle: 'border-dashed',
    textColor: 'text-sky-300 dark:text-sky-300',
    bgColor: 'bg-sky-950/30 dark:bg-sky-950/30',
    borderColor: 'border-sky-700',
    description: 'Neural network inference output',
  },
  'Human-verified': {
    prefix: '[VER]',
    borderStyle: 'border-double border-2',
    textColor: 'text-emerald-300 dark:text-emerald-300',
    bgColor: 'bg-emerald-950/30 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-600',
    description: 'Operator confirmed inspection',
  },
  Configured: {
    prefix: '[CFG]',
    borderStyle: 'border-solid',
    textColor: 'text-zinc-300 dark:text-zinc-300',
    bgColor: 'bg-zinc-800/50 dark:bg-zinc-800/50',
    borderColor: 'border-zinc-600',
    description: 'Static system configuration parameter',
  },
  Simulated: {
    prefix: '[SIM]',
    borderStyle: 'border-dotted border-2',
    textColor: 'text-slate-300 dark:text-slate-300',
    bgColor: 'bg-slate-900/60 dark:bg-slate-900/60',
    borderColor: 'border-slate-500',
    description: 'Synthetic scenario projection',
  },
  Calculated: {
    prefix: '[CAL]',
    borderStyle: 'border-solid',
    textColor: 'text-zinc-200 dark:text-zinc-200',
    bgColor: 'bg-zinc-900/60 dark:bg-zinc-900/60',
    borderColor: 'border-zinc-500',
    description: 'Pure deterministic engine formula',
  },
  'AI-generated': {
    prefix: '[GEN]',
    borderStyle: 'border-dashed',
    textColor: 'text-amber-300 dark:text-amber-300',
    bgColor: 'bg-amber-950/30 dark:bg-amber-950/30',
    borderColor: 'border-amber-600',
    description: 'Generative AI second-opinion synthesis',
  },
};

export function ProvenanceChip({
  provenance,
  className = '',
  showPrefix = true,
}: ProvenanceChipProps) {
  const config = PROVENANCE_CONFIG[provenance] || PROVENANCE_CONFIG.Simulated;

  return (
    <span
      title={`${provenance}: ${config.description}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono rounded-[2px] border ${config.borderStyle} ${config.bgColor} ${config.borderColor} ${config.textColor} select-none ${className}`}
    >
      {showPrefix && (
        <span className="font-bold opacity-75">{config.prefix}</span>
      )}
      <span>{provenance}</span>
    </span>
  );
}
