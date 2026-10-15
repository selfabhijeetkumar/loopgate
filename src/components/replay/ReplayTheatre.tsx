'use client';

/**
 * src/components/replay/ReplayTheatre.tsx
 * Phase 5 — Side-by-side replay of Standard Line vs Loopgate Gated Policy.
 *
 * Uses SVG lanes driven by the engine timeline — NOT a second WebGL context.
 * Shared play/pause/restart/scrubber. Marks hazard items reaching compactor in Branch A.
 *
 * HONESTY: all numbers carry ProvenanceChip="Calculated".
 * Wording: "in this simulated scenario" — never "prevents fires".
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Item, RouteId } from '@/domain/types';
import {
  compareBranches,
  NO_GATE_POLICY,
  type CompareResult,
  type BranchSnapshot,
} from '@/engine';
import { DEFAULT_GATE_POLICY, SAFETY_FLOOR } from '@/engine/gate';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import {
  createAuditEvent,
  loadAuditLog,
  appendAuditEvent,
  clearAuditLog,
  exportAuditLogCSV,
  type AuditEvent,
} from '@/engine/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReplayTheatreProps {
  items?: Item[];
  simulatedItems?: Item[];
  photoItems?: Item[] | null;
  activeSource?: 'simulated' | 'photo';
  className?: string;
}

// ---------------------------------------------------------------------------
// SVG Lane constants
// ---------------------------------------------------------------------------
const LANE_W = 700;
const LANE_H = 90;
const BELT_Y = 44;
const ITEM_R = 9;
const STATION_POSITIONS: Record<string, number> = {
  intake: 30,
  scanner: 180,
  diverter: 380,
  compactor: 550,
  bins: 660,
};

// Route → label
const ROUTE_LABEL: Record<RouteId, string> = {
  compactor: 'Compactor',
  inspection_line: 'Inspection',
  recyclable_bay: 'Recyclable',
  reusable_bay: 'Reusable',
  biodegradable_bay: 'Biodegradable',
  hazard_hold: 'Haz-Vault',
};

// ---------------------------------------------------------------------------
// Item x position along the belt at time t
// ---------------------------------------------------------------------------
function itemX(item: Item, index: number, t: number, route: RouteId, branch: 'A' | 'B'): { x: number; y: number; phase: string } {
  const startT = index * 2.5;
  const elapsed = t - startT;

  if (elapsed < 0) return { x: STATION_POSITIONS.intake - 20, y: BELT_Y, phase: 'waiting' };

  const isDiverted = route === 'inspection_line' || route === 'hazard_hold';
  const isHazardRoute = route === 'hazard_hold';

  if (elapsed < 2) {
    // intake → scanner
    const x = STATION_POSITIONS.intake + (elapsed / 2) * (STATION_POSITIONS.scanner - STATION_POSITIONS.intake);
    return { x, y: BELT_Y, phase: 'intake' };
  } else if (elapsed < 4) {
    // scanner → diverter
    const x = STATION_POSITIONS.scanner + ((elapsed - 2) / 2) * (STATION_POSITIONS.diverter - STATION_POSITIONS.scanner);
    return { x, y: BELT_Y, phase: 'scanning' };
  } else if (elapsed < 6) {
    if (isDiverted && branch === 'B') {
      // branch B only diverts — drop down from belt
      const x = STATION_POSITIONS.diverter;
      const y = BELT_Y + ((elapsed - 4) / 2) * (LANE_H - BELT_Y - 12);
      return { x, y, phase: 'diverted' };
    }
    // straight through to compactor
    const x = STATION_POSITIONS.diverter + ((elapsed - 4) / 2) * (STATION_POSITIONS.compactor - STATION_POSITIONS.diverter);
    return { x, y: BELT_Y, phase: 'compacting' };
  } else {
    if (isDiverted && branch === 'B') {
      return { x: STATION_POSITIONS.diverter + (isHazardRoute ? 30 : 0), y: LANE_H - 16, phase: 'routed' };
    }
    return { x: STATION_POSITIONS.bins, y: BELT_Y, phase: 'routed' };
  }
}

// ---------------------------------------------------------------------------
// Single SVG Lane
// ---------------------------------------------------------------------------
function SvgLane({
  label,
  branchKey,
  items,
  snapshot,
  t,
  highlightHazardAtCompactor,
}: {
  label: string;
  branchKey: 'A' | 'B';
  items: Item[];
  snapshot: BranchSnapshot;
  t: number;
  highlightHazardAtCompactor: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Lane header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">{label}</span>
        {branchKey === 'A' && (
          <span className="text-[9px] font-mono text-slate-500 uppercase">No Gate</span>
        )}
        {branchKey === 'B' && (
          <span className="text-[9px] font-mono text-amber-500 uppercase">Loopgate Active</span>
        )}
      </div>

      <div className="relative w-full overflow-x-auto bg-[#070a0d] border border-border-subtle p-2 rounded-[2px]">
        <svg
          viewBox={`0 0 ${LANE_W} ${LANE_H}`}
          className="w-full h-auto min-w-[480px]"
          aria-label={`${label} replay lane`}
          style={{ minHeight: 60 }}
        >
          {/* Belt track */}
          <rect x={STATION_POSITIONS.intake} y={BELT_Y - 4} width={STATION_POSITIONS.compactor - STATION_POSITIONS.intake} height={8} fill="#141920" stroke="#242d38" strokeWidth="1" />
          <line x1={STATION_POSITIONS.intake} y1={BELT_Y} x2={STATION_POSITIONS.compactor} y2={BELT_Y} stroke="#334155" strokeDasharray="4 3" strokeWidth="1" />

          {/* Station labels */}
          <text x={STATION_POSITIONS.intake} y={BELT_Y - 10} fill="#475569" fontSize="7" textAnchor="middle">INTAKE</text>
          <text x={STATION_POSITIONS.scanner} y={BELT_Y - 10} fill="#f59e0b" fontSize="7" textAnchor="middle">SCAN</text>
          <text x={STATION_POSITIONS.diverter} y={BELT_Y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">DIVERT</text>
          <text x={STATION_POSITIONS.compactor} y={BELT_Y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">COMPACT</text>
          <text x={STATION_POSITIONS.bins} y={BELT_Y - 10} fill="#94a3b8" fontSize="7" textAnchor="middle">BINS</text>

          {/* Divert spur (Branch B only) */}
          {branchKey === 'B' && (
            <>
              <rect x={STATION_POSITIONS.diverter - 2} y={BELT_Y} width={4} height={LANE_H - BELT_Y - 8} fill="#1e2630" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
              <text x={STATION_POSITIONS.diverter + 8} y={LANE_H - 8} fill="#f59e0b" fontSize="7">INSPECTION / HAZ</text>
            </>
          )}

          {/* Hazard alert at compactor (Branch A) */}
          {highlightHazardAtCompactor && branchKey === 'A' && (
            <rect x={STATION_POSITIONS.compactor - 14} y={BELT_Y - 14} width={28} height={28} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />
          )}

          {/* Items */}
          {items.map((item, idx) => {
            const decision = snapshot.decisions.find((d) => d.itemId === item.id);
            const route = decision?.route ?? 'recyclable_bay';
            const { x, y, phase } = itemX(item, idx, t, route, branchKey);
            const isHazard = item.hazardProbability >= 0.30 || item.primaryClass === 'hazardous';
            const isVisible = x > STATION_POSITIONS.intake - 30 && x < LANE_W + 20;

            if (!isVisible) return null;

            const fill = isHazard ? '#f59e0b' : '#94a3b8';
            const stroke = phase === 'routed' ? '#0f172a' : '#0d0f11';

            return (
              <g key={item.id}>
                <circle cx={x} cy={y} r={ITEM_R} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={phase === 'waiting' ? 0.3 : 0.9} />
                <text x={x} y={y + 3} fill="#000" fontSize="6" textAnchor="middle" fontWeight="bold">
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Delta Cell
// ---------------------------------------------------------------------------
function DeltaCell({ label, aVal, bVal, unit, lowerIsBetter = false }: {
  label: string; aVal: number; bVal: number; unit: string; lowerIsBetter?: boolean;
}) {
  const delta = bVal - aVal;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const sign = delta > 0 ? '+' : '';
  return (
    <div className="flex flex-col gap-1 border border-border-subtle bg-bg-surface/60 p-3 rounded-[2px]">
      <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">{label}</div>
      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-mono text-slate-500">STANDARD</span>
          <span className="text-sm font-mono text-text-secondary">{aVal.toFixed(2)}{unit}</span>
        </div>
        <div className="text-xs font-mono text-text-muted">vs</div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-mono text-amber-500">LOOPGATE</span>
          <span className="text-sm font-mono text-text-primary">{bVal.toFixed(2)}{unit}</span>
        </div>
        <div className={`ml-auto text-sm font-mono font-bold ${improved ? 'text-amber-400' : 'text-slate-500'}`}>
          {sign}{delta.toFixed(2)}{unit}
        </div>
      </div>
      <ProvenanceChip provenance="Calculated" showPrefix={false} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Table
// ---------------------------------------------------------------------------
function AuditLogTable({ events, onClear }: { events: AuditEvent[]; onClear: () => void }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const csv = exportAuditLogCSV(events);
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API unavailable — silently ignore
    });
  }, [events]);

  const handleClear = useCallback(() => {
    if (confirmClear) {
      onClear();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  }, [confirmClear, onClear]);

  if (events.length === 0) {
    return (
      <div className="text-xs font-mono text-text-muted py-4 text-center border border-border-subtle rounded-[2px]">
        No audit events recorded yet. Interact with the twin to generate events.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-text-muted">{events.length} events recorded</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-[10px] font-mono border border-border-subtle text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Copy audit log as CSV"
          >
            {copied ? 'COPIED' : 'COPY CSV'}
          </button>
          <button
            onClick={handleClear}
            className={`px-2 py-1 text-[10px] font-mono border transition-colors ${confirmClear ? 'border-amber-500 text-amber-400' : 'border-border-subtle text-text-muted hover:text-text-primary'}`}
            aria-label={confirmClear ? 'Confirm clear audit log' : 'Clear audit log'}
          >
            {confirmClear ? 'CONFIRM CLEAR' : 'CLEAR LOG'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="px-2 py-1 text-[10px] font-mono border border-border-subtle text-text-muted"
              aria-label="Cancel clear"
            >
              CANCEL
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-64 overflow-y-auto border border-border-subtle rounded-[2px]">
        <table className="w-full text-[10px] font-mono" aria-label="Audit log">
          <thead className="sticky top-0 bg-bg-surface border-b border-border-subtle">
            <tr className="text-text-muted text-left">
              <th className="px-2 py-1.5 font-normal uppercase tracking-wider">Time</th>
              <th className="px-2 py-1.5 font-normal uppercase tracking-wider">Item</th>
              <th className="px-2 py-1.5 font-normal uppercase tracking-wider">Action</th>
              <th className="px-2 py-1.5 font-normal uppercase tracking-wider">Reason</th>
              <th className="px-2 py-1.5 font-normal uppercase tracking-wider">Provenance</th>
            </tr>
          </thead>
          <tbody>
            {[...events].reverse().map((ev, i) => (
              <tr key={ev.id} className={`border-b border-border-subtle/40 ${i % 2 === 0 ? 'bg-bg-surface/20' : ''}`}>
                <td className="px-2 py-1.5 text-text-muted whitespace-nowrap">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-2 py-1.5 text-text-secondary whitespace-nowrap">
                  {ev.itemName ?? ev.itemId ?? '-'}
                </td>
                <td className="px-2 py-1.5 text-text-primary max-w-[200px] truncate">
                  {ev.action}
                </td>
                <td className="px-2 py-1.5 text-amber-400 whitespace-nowrap">
                  {ev.reasonCode}
                </td>
                <td className="px-2 py-1.5">
                  <ProvenanceChip provenance={ev.provenance} showPrefix={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Replay Theatre
// ---------------------------------------------------------------------------
export function ReplayTheatre({
  items = [],
  simulatedItems = [],
  photoItems = null,
  className = '',
}: ReplayTheatreProps) {
  const [batchMode, setBatchMode] = useState<'simulated' | 'photo'>('simulated');
  const [t, setT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(performance.now());

  const activeItems = useMemo(() => {
    if (batchMode === 'photo') {
      return photoItems && photoItems.length > 0 ? photoItems : [];
    }
    return simulatedItems && simulatedItems.length > 0 ? simulatedItems : items;
  }, [batchMode, photoItems, simulatedItems, items]);

  const maxT = Math.max(4, activeItems.length * 2.5 + 8);

  // Check if current photo batch contains no hazardous items
  const photoHasNoHazards = useMemo(() => {
    if (batchMode !== 'photo' || activeItems.length === 0) return false;
    return !activeItems.some(
      (it) => it.hazardProbability >= SAFETY_FLOOR || it.primaryClass === 'hazardous'
    );
  }, [batchMode, activeItems]);

  // Compute branch comparison once per items change (only when items present)
  const compare: CompareResult | null = useMemo(() => {
    if (activeItems.length === 0) return null;
    return compareBranches(activeItems, NO_GATE_POLICY, DEFAULT_GATE_POLICY);
  }, [activeItems]);

  // Which items are hazardous in Branch A at the compactor phase?
  const hazardAtCompactorIds = useMemo(() => {
    if (!compare) return [];
    return compare.baseline.decisions
      .filter((d) => {
        const item = activeItems.find((it) => it.id === d.itemId);
        return item && item.hazardProbability >= 0.30 && d.route === 'compactor';
      })
      .map((d) => d.itemId);
  }, [compare, activeItems]);

  // Load audit events on mount
  useEffect(() => {
    setAuditEvents(loadAuditLog());
  }, []);

  // Record batch start audit event when items change
  useEffect(() => {
    if (activeItems.length === 0) return;
    const ev = createAuditEvent({
      itemId: null,
      itemName: null,
      action: `Replay batch loaded (${batchMode}): ${activeItems.length} items`,
      reasonCode: 'BATCH_START',
      fromRoute: null,
      toRoute: null,
      provenance: 'Calculated',
    });
    const updated = appendAuditEvent(ev);
    setAuditEvents(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems.length, batchMode]);

  // Playback loop
  useEffect(() => {
    const tick = (now: number) => {
      const delta = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setT((prev) => {
        const next = prev + delta;
        if (next >= maxT) {
          setIsPlaying(false);
          return maxT;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, maxT]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleRestart = useCallback(() => {
    setT(0);
    setIsPlaying(false);
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setT(parseFloat(e.target.value));
    setIsPlaying(false);
  }, []);

  const handleClearAudit = useCallback(() => {
    clearAuditLog();
    setAuditEvents([]);
  }, []);

  // Highlight hazard at compactor when any hazard item reaches it in Branch A
  const showHazardAlert = useMemo(() => {
    return hazardAtCompactorIds.some((id) => {
      const idx = activeItems.findIndex((it) => it.id === id);
      if (idx < 0) return false;
      const elapsed = t - idx * 2.5;
      return elapsed >= 4 && elapsed < 7;
    });
  }, [hazardAtCompactorIds, activeItems, t]);

  const baseline = compare?.baseline;
  const gated = compare?.gated;
  const deltas = compare?.deltas;

  return (
    <div className={`flex flex-col gap-6 ${className}`} id="replay" aria-label="Replay Theatre">

      {/* Header & Batch Switch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
            Branch Comparison // {batchMode === 'photo' ? 'Uploaded Photo Batch' : 'Simulated Scenario'}
          </div>
          <h3 className="text-lg font-display font-bold text-text-primary">
            Standard Line vs{' '}
            <span className="font-serif-italic font-normal text-amber-400">Loopgate</span>
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Batch switch */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-text-muted">Batch:</span>
            <div className="inline-flex border border-border-default rounded-[2px] overflow-hidden">
              <button
                type="button"
                id="replay-batch-simulated"
                onClick={() => {
                  setBatchMode('simulated');
                  setT(0);
                  setIsPlaying(false);
                }}
                className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${
                  batchMode === 'simulated'
                    ? 'bg-amber-500 text-bg-primary font-bold'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                Simulated scenario
              </button>
              <button
                type="button"
                id="replay-batch-photo"
                onClick={() => {
                  setBatchMode('photo');
                  setT(0);
                  setIsPlaying(false);
                }}
                className={`px-2.5 py-1 text-[11px] font-mono border-l border-border-default transition-colors ${
                  batchMode === 'photo'
                    ? 'bg-amber-500 text-bg-primary font-bold'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                My photo
              </button>
            </div>
          </div>
          <ProvenanceChip provenance="Calculated" showPrefix />
        </div>
      </div>

      {/* No photo batch loaded notice */}
      {activeItems.length === 0 && (
        <div className="bg-[#090c10] border border-border-default p-4 rounded-[2px] text-xs font-mono text-text-muted space-y-1.5">
          <div className="text-amber-400 font-bold uppercase tracking-wider">[NO PHOTO BATCH LOADED]</div>
          <p className="leading-relaxed">
            Upload an intake photo in the Evidence Lab below and click &ldquo;Send to Twin&rdquo; to populate custom photo items into the replay.
          </p>
        </div>
      )}

      {compare && baseline && gated && (
        <>
          {/* Photo batch with zero hazards notice */}
          {photoHasNoHazards && (
            <div className="bg-[#090c10] border border-border-default p-3.5 rounded-[2px] text-xs font-mono text-text-secondary leading-relaxed flex items-center gap-2.5">
              <span className="w-2 h-2 bg-slate-400 rounded-none shrink-0" />
              <span>
                This intake batch contains no hazardous items; Branch A (Standard Line) and Branch B (Loopgate) produce identical routing with zero compactor escapes.
              </span>
            </div>
          )}

          {/* Dual SVG Lanes with Solid Dark Background Scrim */}
          <div className="bg-[#090c10] border border-border-default p-4 rounded-[2px] space-y-4">
            <SvgLane
              label="Branch A — Standard Line (No Gate)"
              branchKey="A"
              items={activeItems}
              snapshot={baseline}
              t={t}
              highlightHazardAtCompactor={showHazardAlert}
            />
            <div className="border-t border-border-subtle/80" />
            <SvgLane
              label="Branch B — Loopgate Gated Policy"
              branchKey="B"
              items={activeItems}
              snapshot={gated}
              t={t}
              highlightHazardAtCompactor={false}
            />
          </div>

      {/* Shared playback controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="replay-play-pause"
          onClick={handlePlayPause}
          className="px-3 py-1.5 border border-border-subtle bg-bg-primary hover:bg-bg-elevated text-text-primary text-[11px] font-mono font-semibold transition-colors"
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          {isPlaying ? 'PAUSE [Space]' : 'PLAY [Space]'}
        </button>
        <button
          id="replay-restart"
          onClick={handleRestart}
          className="px-2.5 py-1.5 border border-border-subtle bg-bg-primary hover:bg-bg-elevated text-text-muted hover:text-text-primary text-[11px] font-mono transition-colors"
          aria-label="Restart replay"
        >
          RESTART [R]
        </button>
        <div className="flex-1 min-w-[120px]">
          <label htmlFor="replay-scrubber" className="sr-only">Replay time scrubber</label>
          <input
            id="replay-scrubber"
            type="range"
            min={0}
            max={maxT}
            step={0.1}
            value={t}
            onChange={handleScrub}
            className="w-full h-1 accent-amber-500 bg-bg-elevated rounded-none cursor-pointer"
            aria-label="Replay time"
          />
        </div>
        <span className="text-[10px] font-mono text-text-muted tabular-nums">
          T = {t.toFixed(1)}s / {maxT.toFixed(1)}s
        </span>
      </div>

      {/* Keyboard shortcut handler */}
      <KeyboardReplayControls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onRestart={handleRestart}
      />

      {/* Side-by-side metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DeltaCell
          label="Expected Hazard Exposure"
          aVal={baseline.metrics.expectedHazardExposure}
          bVal={gated.metrics.expectedHazardExposure}
          unit=""
          lowerIsBetter
        />
        <DeltaCell
          label="Inspection Load (items/min)"
          aVal={baseline.metrics.inspectionLoad}
          bVal={gated.metrics.inspectionLoad}
          unit=""
          lowerIsBetter={false}
        />
        <DeltaCell
          label="Throughput (items/min)"
          aVal={baseline.metrics.throughputPerMinute}
          bVal={gated.metrics.throughputPerMinute}
          unit=""
          lowerIsBetter={false}
        />
        <DeltaCell
          label="Compactor Escapes (hazard)"
          aVal={baseline.metrics.hazardHoldCount === 0 ? (baseline.decisions.filter(d => {
            const it = activeItems.find(i => i.id === d.itemId);
            return it && it.primaryClass === 'hazardous' && d.route === 'compactor';
          }).length) : 0}
          bVal={0}
          unit=" items"
          lowerIsBetter
        />
        <DeltaCell
          label="Safety Floor Triggers"
          aVal={baseline.metrics.safetyFloorTriggerCount}
          bVal={gated.metrics.safetyFloorTriggerCount}
          unit=""
          lowerIsBetter={false}
        />
        <div className="border border-border-subtle bg-bg-surface/60 p-3 rounded-[2px] flex flex-col gap-1 justify-center">
          <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Scenario Note</div>
          <p className="text-[10px] font-mono text-text-secondary leading-relaxed">
            Numbers shown apply to this simulated scenario only.
            Differences reflect deterministic engine calculations on the loaded batch.
          </p>
          <ProvenanceChip provenance="Simulated" showPrefix={false} />
        </div>
      </div>
        </>
      )}

      {/* Audit Trail */}
      <div className="flex flex-col gap-3 border-t border-border-subtle pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
            Audit Trail // Operator Actions
          </div>
          <ProvenanceChip provenance="Human-verified" showPrefix={false} />
        </div>
        <AuditLogTable events={auditEvents} onClear={handleClearAudit} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard controls (Space = play/pause, R = restart)
// ---------------------------------------------------------------------------
function KeyboardReplayControls({
  isPlaying,
  onPlayPause,
  onRestart,
}: {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRestart: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only fire when no input is focused
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onPlayPause();
      } else if (e.key === 'r' || e.key === 'R') {
        onRestart();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, onPlayPause, onRestart]);

  return null;
}
