'use client';

import React from 'react';
import { useSimulation, type QualityMode } from '@/components/twin/SimulationContext';

export function QualityControl() {
  const { qualityMode, setQualityMode, qualityTier, fps } = useSimulation();

  const modes: { id: QualityMode; label: string }[] = [
    { id: 'auto', label: 'AUTO' },
    { id: 'high', label: 'HIGH' },
    { id: 'medium', label: 'MED' },
    { id: 'low', label: 'LOW' },
  ];

  return (
    <div
      role="region"
      aria-label="3D rendering quality controls"
      className="inline-flex items-center gap-2 px-2.5 py-1 bg-bg-surface/90 border border-border-subtle rounded-[2px] font-mono text-[10px] text-text-secondary select-none"
    >
      <span className="text-text-muted uppercase tracking-wider">RENDER:</span>
      <div className="inline-flex items-center border border-border-subtle rounded-[2px] bg-bg-primary p-0.5" role="group" aria-label="Quality mode">
        {modes.map((m) => {
          const isActive = qualityMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setQualityMode(m.id)}
              aria-pressed={isActive}
              className={`px-1.5 py-0.5 text-[9px] font-mono tracking-wider transition-colors rounded-[1px] ${
                isActive
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pl-1 border-l border-border-subtle text-[10px]">
        <span className={fps < 45 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
          {fps} FPS
        </span>
        <span className="text-text-muted">({qualityTier})</span>
      </div>
    </div>
  );
}
