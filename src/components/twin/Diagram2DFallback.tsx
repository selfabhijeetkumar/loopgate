'use client';

import React, { useMemo } from 'react';
import type { Item, RouteId } from '@/domain/types';
import type { ItemDecision } from '@/engine';
import { ProvenanceChip } from '@/components/ProvenanceChip';

interface Diagram2DFallbackProps {
  items: Item[];
  decisions: ItemDecision[];
  currentTime: number; // in seconds
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}

export function Diagram2DFallback({
  items,
  decisions,
  currentTime,
  isPlaying,
  onTogglePlay,
  onRestart,
  onStepForward,
  onStepBackward,
  selectedItemId,
  onSelectItem,
}: Diagram2DFallbackProps) {
  // Compute positions of each item based on currentTime and decision route
  const itemStates = useMemo(() => {
    return items.map((item, index) => {
      const decision = decisions.find((d) => d.itemId === item.id);
      const route = decision?.route ?? 'recyclable_bay';
      const itemStartTime = index * 3.0; // 3 seconds spacing
      const elapsed = currentTime - itemStartTime;

      let stage: 'waiting' | 'intake' | 'scanning' | 'gate' | 'diverted' | 'compacting' | 'routed' = 'waiting';
      let x = 40; // pixel coordinate on SVG
      let y = 140;

      if (elapsed < 0) {
        stage = 'waiting';
        x = 30;
      } else if (elapsed < 3) {
        stage = 'intake';
        x = 40 + (elapsed / 3) * 120; // 40 -> 160
      } else if (elapsed < 6) {
        stage = 'scanning';
        x = 160 + ((elapsed - 3) / 3) * 120; // 160 -> 280 (scanner at 220)
      } else if (elapsed < 9) {
        stage = 'gate';
        x = 280 + ((elapsed - 6) / 3) * 120; // 280 -> 400 (diverter at 400)
      } else if (elapsed < 14) {
        // Post-gate routing
        const isDiverted = route === 'inspection_line' || route === 'hazard_hold';
        if (isDiverted) {
          stage = 'diverted';
          x = 400;
          y = 140 + ((elapsed - 9) / 5) * 140; // 140 -> 280 (inspection spur)
        } else {
          stage = 'compacting';
          x = 400 + ((elapsed - 9) / 5) * 220; // 400 -> 620
          y = 140;
        }
      } else {
        stage = 'routed';
        const isDiverted = route === 'inspection_line' || route === 'hazard_hold';
        if (isDiverted) {
          x = route === 'hazard_hold' ? 440 : 360;
          y = 290;
        } else {
          x = 680;
          y = route === 'recyclable_bay' ? 90 : route === 'reusable_bay' ? 120 : 160;
        }
      }

      return {
        item,
        decision,
        route,
        stage,
        x,
        y,
        isActive: elapsed >= 0 && elapsed < 16,
      };
    });
  }, [items, decisions, currentTime]);

  return (
    <div className="w-full flex flex-col gap-4 bg-bg-surface border border-border-subtle p-4 rounded-[2px]">
      {/* 2D HUD Header & Mode Indicator */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-none" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-text-primary">
            2D Facility Schematic // Engine-Synchronized Vector Twin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-text-muted">
            T = {currentTime.toFixed(1)}s
          </span>
          <ProvenanceChip provenance="Calculated" showPrefix={false} />
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full overflow-x-auto bg-[#0b0e11] border border-border-subtle/60 p-2 rounded-[2px]">
        <svg
          viewBox="0 0 760 360"
          className="w-full h-auto min-w-[680px] select-none font-mono"
          aria-label="2D Facility Schematic of the Loopgate Sorting Line"
        >
          {/* Main Conveyor Track */}
          <rect x="40" y="125" width="600" height="30" fill="#141920" stroke="#242d38" strokeWidth="2" />
          <line x1="40" y1="140" x2="640" y2="140" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />

          {/* Diverter Spur Track to Inspection */}
          <rect x="385" y="155" width="30" height="135" fill="#141920" stroke="#242d38" strokeWidth="2" />
          <line x1="400" y1="155" x2="400" y2="290" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />

          {/* 1. Intake Hopper */}
          <rect x="15" y="110" width="35" height="60" fill="#1e2630" stroke="#334155" />
          <text x="32" y="98" fill="#64748b" fontSize="8" textAnchor="middle">INTAKE</text>

          {/* 2. Optical Scanner Gate */}
          <rect x="200" y="85" width="40" height="110" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
          <rect x="205" y="80" width="30" height="12" fill="#0f172a" stroke="#f59e0b" />
          <text x="220" y="89" fill="#f59e0b" fontSize="7" textAnchor="middle">SCANNER</text>
          <line x1="220" y1="92" x2="220" y2="185" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />

          {/* 3. Diverter Arm Station */}
          <circle cx="400" cy="120" r="8" fill="#334155" stroke="#475569" />
          <line x1="400" y1="120" x2="400" y2="155" stroke="#f59e0b" strokeWidth="3" />
          <text x="400" y="105" fill="#94a3b8" fontSize="8" textAnchor="middle">DIVERTER</text>

          {/* 4. Inspection Station & Hazard Vault */}
          <rect x="320" y="290" width="160" height="55" fill="#141920" stroke="#f59e0b" strokeWidth="1.5" />
          <text x="400" y="308" fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="middle">
            INSPECTION BAY &amp; QUARANTINE
          </text>
          <rect x="330" y="318" width="65" height="20" fill="#0f172a" stroke="#475569" />
          <text x="362" y="331" fill="#94a3b8" fontSize="7" textAnchor="middle">INSPECT [01]</text>
          <rect x="405" y="318" width="65" height="20" fill="#451a03" stroke="#f59e0b" />
          <text x="437" y="331" fill="#f59e0b" fontSize="7" fontWeight="bold" textAnchor="middle">HAZ-VAULT</text>

          {/* 5. Compactor Chamber */}
          <rect x="500" y="105" width="70" height="70" fill="#1e2630" stroke="#475569" strokeWidth="1.5" />
          <text x="535" y="98" fill="#94a3b8" fontSize="8" textAnchor="middle">COMPACTOR</text>
          <rect x="510" y="112" width="50" height="10" fill="#475569" />
          <rect x="510" y="158" width="50" height="10" fill="#475569" />

          {/* 6. Terminal Material Bins */}
          <rect x="640" y="75" width="80" height="30" fill="#0c4a6e" stroke="#38bdf8" />
          <text x="680" y="93" fill="#bae6fd" fontSize="8" textAnchor="middle">RECYCLABLE</text>

          <rect x="640" y="115" width="80" height="30" fill="#1e293b" stroke="#94a3b8" />
          <text x="680" y="133" fill="#cbd5e1" fontSize="8" textAnchor="middle">REUSABLE</text>

          <rect x="640" y="155" width="80" height="30" fill="#14532d" stroke="#4ade80" />
          <text x="680" y="173" fill="#bbf7d0" fontSize="8" textAnchor="middle">BIODEGRADABLE</text>

          {/* Render Active Items */}
          {itemStates
            .filter((s) => s.isActive)
            .map((s) => {
              const isSelected = selectedItemId === s.item.id;
              const isHazard = s.item.primaryClass === 'hazardous' || s.item.hazardProbability >= 0.30;
              const color = isSelected ? '#f59e0b' : isHazard ? '#ef4444' : '#38bdf8';

              return (
                <g
                  key={s.item.id}
                  transform={`translate(${s.x}, ${s.y})`}
                  className="cursor-pointer"
                  onClick={() => onSelectItem(s.item.id)}
                >
                  <circle
                    cx="0"
                    cy="0"
                    r={isSelected ? "11" : "8"}
                    fill={color}
                    stroke={isSelected ? "#ffffff" : "#0d0f11"}
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="3"
                    fill="#000000"
                    fontSize="7"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {s.item.id.replace('item-', '')}
                  </text>
                  {/* Floating tag on select */}
                  {isSelected && (
                    <g transform="translate(0, -18)">
                      <rect x="-40" y="-12" width="80" height="16" fill="#0f172a" stroke="#f59e0b" rx="2" />
                      <text x="0" y="0" fill="#f59e0b" fontSize="7" textAnchor="middle">
                        p={fmtProb(s.item.hazardProbability)} [{s.route}]
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {/* Playback & Step Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="px-3 py-1.5 bg-bg-primary hover:bg-bg-elevated border border-border-subtle text-text-primary text-xs font-mono font-semibold transition-colors"
            aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
          >
            {isPlaying ? "PAUSE [Space]" : "PLAY [Space]"}
          </button>
          <button
            onClick={onStepBackward}
            className="px-2.5 py-1.5 bg-bg-primary hover:bg-bg-elevated border border-border-subtle text-text-secondary text-xs font-mono transition-colors"
            aria-label="Step backward"
          >
            &lt; STEP
          </button>
          <button
            onClick={onStepForward}
            className="px-2.5 py-1.5 bg-bg-primary hover:bg-bg-elevated border border-border-subtle text-text-secondary text-xs font-mono transition-colors"
            aria-label="Step forward"
          >
            STEP &gt;
          </button>
          <button
            onClick={onRestart}
            className="px-2.5 py-1.5 bg-bg-primary hover:bg-bg-elevated border border-border-subtle text-text-muted hover:text-text-primary text-xs font-mono transition-colors"
            aria-label="Restart simulation"
          >
            RESET [R]
          </button>
        </div>

        <div className="text-[11px] font-mono text-text-muted">
          Click any numbered item bubble to inspect &amp; apply manual overrides.
        </div>
      </div>
    </div>
  );
}

function fmtProb(p: number): string {
  return (p * 100).toFixed(0) + '%';
}
