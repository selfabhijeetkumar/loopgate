'use client';

/**
 * /dev/engine -- Development-only engine playground
 *
 * Runs the Simulated scenario through compareBranches and sweepThreshold.
 * Shows two plain tables (branch comparison + sweep data) and a live threshold slider.
 * Every number carries a ProvenanceChip(Calculated).
 *
 * Hidden in production: the layout.tsx for this route calls notFound() when
 * NODE_ENV is not 'development'.
 *
 * HARD BANS enforced: no purple gradients, no pill buttons, no glow, no emoji icons,
 * no em dashes in UI copy, no fake metrics, no Framer Motion.
 */

import React, { useState, useMemo } from 'react';
import { ProvenanceChip } from '@/components/ProvenanceChip';
import { SYNTHETIC_SCENARIO_ITEMS } from '@/data/scenario';
import {
  compareBranches,
  sweepThreshold,
  NO_GATE_POLICY,
  DEFAULT_GATE_POLICY,
  ENGINE_ASSUMPTIONS,
} from '@/engine';
import type { SweepPoint } from '@/engine';
import type { ItemDecision } from '@/engine';
import type { EngineAssumption } from '@/engine';

const SWEEP_THRESHOLDS = [0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40, 0.44, 0.48];

function fmt(n: number, decimals = 3): string {
  return n.toFixed(decimals);
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export default function DevEnginePage() {
  // Strictness in [0, 100]%: maps inversely to useful threshold range [0.48, 0.08]
  const [strictness, setStrictness] = useState<number>(50); // default 50% strictness -> tau = 0.28

  // tau mapped from strictness: 0% strictness -> 0.48 (balanced), 100% strictness -> 0.08 (hyper-paranoid)
  const tau = Number((0.48 - (strictness / 100) * 0.40).toFixed(3));

  // Live policy for the slider preview
  const livePolicy = useMemo(
    () => ({ ...DEFAULT_GATE_POLICY, inspectionThreshold: tau }),
    [tau],
  );

  // Branch comparison: baseline (no gate) vs default gated policy
  const compareResult = useMemo(
    () => compareBranches(SYNTHETIC_SCENARIO_ITEMS, NO_GATE_POLICY, DEFAULT_GATE_POLICY),
    [],
  );

  // Sweep across all thresholds for the trade-off table
  const sweepPoints = useMemo(
    () =>
      sweepThreshold(
        SYNTHETIC_SCENARIO_ITEMS,
        {
          safetyFloor: DEFAULT_GATE_POLICY.safetyFloor,
          hazardConfidentCutoff: DEFAULT_GATE_POLICY.hazardConfidentCutoff,
        },
        SWEEP_THRESHOLDS,
      ),
    [],
  );

  // Live single-threshold result for slider preview
  const liveResult = useMemo(
    () =>
      sweepThreshold(
        SYNTHETIC_SCENARIO_ITEMS,
        {
          safetyFloor: livePolicy.safetyFloor,
          hazardConfidentCutoff: livePolicy.hazardConfidentCutoff,
        },
        [tau],
      )[0],
    [tau, livePolicy],
  );

  const { baseline, gated, deltas } = compareResult;

  return (
    <div className="flex-1 flex flex-col gap-8 py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      {/* Page header */}
      <div className="border-b border-border-subtle pb-6 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-none animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-widest text-text-secondary">
            Development Mode // Engine Sandbox
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-text-primary tracking-tight">
          Gate Engine: Branch Comparison + Threshold Sweep
        </h1>
        <p className="text-sm text-text-secondary font-sans max-w-3xl">
          Runs the 20-item Simulated scenario through the deterministic engine. All numbers are engine outputs
          carrying a Calculated provenance chip. Routes risky waste before it reaches the compactor. Simulated estimates. Not rendered in production builds.
        </p>
        <div className="flex gap-3 flex-wrap">
          <ProvenanceChip provenance="Calculated" />
          <ProvenanceChip provenance="Simulated" />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Branch comparison table                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Branch Comparison // src/engine/compare.ts
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">
            Baseline (No Gate) vs Gated Policy
          </h2>
          <p className="text-xs text-text-secondary font-sans">
            Same batch, two different policies. Deltas = gated minus baseline.
            Negative exposure delta in this simulated scenario indicates lower compactor hazard exposure.
          </p>
        </div>

        <div className="border border-border-subtle bg-bg-surface rounded-[2px] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary text-text-muted text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Baseline (No Gate)</th>
                <th className="py-3 px-4">Gated Policy</th>
                <th className="py-3 px-4">Delta (Gated - Baseline)</th>
                <th className="py-3 px-4">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary">
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Expected Hazard Exposure</td>
                <td className="py-3 px-4 text-amber-400 font-bold">
                  {fmt(baseline.metrics.expectedHazardExposure)}
                </td>
                <td className="py-3 px-4 text-emerald-400 font-bold">
                  {fmt(gated.metrics.expectedHazardExposure)}
                </td>
                <td className={`py-3 px-4 font-bold ${deltas.expectedHazardExposureDelta < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {deltas.expectedHazardExposureDelta > 0 ? '+' : ''}{fmt(deltas.expectedHazardExposureDelta)}
                </td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Hazard Hold Count</td>
                <td className="py-3 px-4">{baseline.metrics.hazardHoldCount}</td>
                <td className="py-3 px-4">{gated.metrics.hazardHoldCount}</td>
                <td className={`py-3 px-4 font-bold ${deltas.hazardHoldCountDelta > 0 ? 'text-emerald-400' : ''}`}>
                  {deltas.hazardHoldCountDelta > 0 ? '+' : ''}{deltas.hazardHoldCountDelta}
                </td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Inspection Line Count</td>
                <td className="py-3 px-4">{baseline.metrics.inspectionLineCount}</td>
                <td className="py-3 px-4">{gated.metrics.inspectionLineCount}</td>
                <td className="py-3 px-4">
                  {deltas.inspectionLoadDelta > 0 ? '+' : ''}{fmt(deltas.inspectionLoadDelta, 1)} items/min
                </td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Inspection Load</td>
                <td className="py-3 px-4">{fmt(baseline.metrics.inspectionLoad, 1)} items/min</td>
                <td className="py-3 px-4">{fmt(gated.metrics.inspectionLoad, 1)} items/min</td>
                <td className="py-3 px-4">{deltas.inspectionLoadDelta > 0 ? '+' : ''}{fmt(deltas.inspectionLoadDelta, 1)}</td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Throughput</td>
                <td className="py-3 px-4">{fmt(baseline.metrics.throughputPerMinute, 1)} items/min</td>
                <td className="py-3 px-4">{fmt(gated.metrics.throughputPerMinute, 1)} items/min</td>
                <td className="py-3 px-4">{deltas.throughputDelta >= 0 ? '+' : ''}{fmt(deltas.throughputDelta, 1)}</td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Safety Floor Triggers</td>
                <td className="py-3 px-4">{baseline.metrics.safetyFloorTriggerCount}</td>
                <td className="py-3 px-4">{gated.metrics.safetyFloorTriggerCount}</td>
                <td className="py-3 px-4">+{deltas.safetyFloorTriggerDelta}</td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50 bg-amber-950/10">
                <td className="py-3 px-4 text-amber-400 font-semibold">Safety Floor Escape Count</td>
                <td className="py-3 px-4 text-amber-400 font-bold">{baseline.metrics.safetyFloorEscapeCount}</td>
                <td className={`py-3 px-4 font-bold ${gated.metrics.safetyFloorEscapeCount === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gated.metrics.safetyFloorEscapeCount}
                </td>
                <td className="py-3 px-4 text-text-muted text-[10px]">Safety invariant: must be 0</td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
              <tr className="hover:bg-bg-elevated/50">
                <td className="py-3 px-4 text-text-primary font-semibold">Backlog Active</td>
                <td className="py-3 px-4">{baseline.metrics.backlogActive ? 'YES' : 'no'}</td>
                <td className="py-3 px-4">{gated.metrics.backlogActive ? 'YES' : 'no'}</td>
                <td className="py-3 px-4 text-text-muted">--</td>
                <td className="py-3 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Live threshold slider                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Live Threshold Slider // Inspection Strictness
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">
            Adjust Gate Strictness
          </h2>
          <p className="text-xs text-text-secondary font-sans">
            The safety floor ({fmtPct(DEFAULT_GATE_POLICY.safetyFloor)}) is fixed.
            Strictness controls the gate sensitivity (0% = baseline balanced, 100% = maximum diversion).
            Mapped onto the active threshold range [0.50, 0.10]. Every part of the slider changes engine outputs.
          </p>
        </div>

        <div className="border border-border-subtle bg-bg-surface rounded-[2px] p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="strictness-slider" className="text-xs font-mono text-text-secondary">
                Inspection Strictness: <span className="text-amber-400 font-bold">{strictness}%</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-bg-primary px-2 py-0.5 border border-border-subtle text-amber-500">
                  tau = {tau.toFixed(3)}
                </span>
                <ProvenanceChip provenance="Calculated" showPrefix={false} />
              </div>
            </div>
            <input
              id="strictness-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={strictness}
              onChange={(e) => setStrictness(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-text-muted">
              <span>0% Strictness (tau = 0.50, minimal load)</span>
              <span>50% (tau = 0.30, optimal)</span>
              <span>100% Strictness (tau = 0.10, max inspection)</span>
            </div>
          </div>

          {liveResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border-subtle pt-4">
              <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Inspection Load</div>
                <div className="text-base font-mono font-bold text-text-primary mt-1">
                  {fmt(liveResult.inspectionLoad, 1)} <span className="text-[10px] text-text-muted">items/min</span>
                </div>
                <div className="mt-1"><ProvenanceChip provenance="Calculated" showPrefix={false} /></div>
              </div>
              <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Inspection Count</div>
                <div className="text-base font-mono font-bold text-text-primary mt-1">
                  {liveResult.inspectionLineCount} <span className="text-[10px] text-text-muted">items</span>
                </div>
                <div className="mt-1"><ProvenanceChip provenance="Calculated" showPrefix={false} /></div>
              </div>
              <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Hazard Exposure</div>
                <div className={`text-base font-mono font-bold mt-1 ${liveResult.expectedHazardExposure > 1 ? 'text-amber-400' : 'text-text-primary'}`}>
                  {fmt(liveResult.expectedHazardExposure)}
                </div>
                <div className="mt-1"><ProvenanceChip provenance="Calculated" showPrefix={false} /></div>
              </div>
              <div className="p-3 border border-border-subtle bg-bg-primary rounded-[2px]">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Throughput</div>
                <div className="text-base font-mono font-bold text-text-primary mt-1">
                  {fmt(liveResult.throughputPerMinute, 1)} <span className="text-[10px] text-text-muted">items/min</span>
                </div>
                <div className="mt-1"><ProvenanceChip provenance="Calculated" showPrefix={false} /></div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Full sweep table                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Threshold Sweep // sweepThreshold()
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">
            Full Trade-off Curve (21 points)
          </h2>
        </div>

        <div className="border border-border-subtle bg-bg-surface rounded-[2px] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary text-text-muted text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Tau</th>
                <th className="py-3 px-4">Inspection Count</th>
                <th className="py-3 px-4">Inspection Load (items/min)</th>
                <th className="py-3 px-4">Hazard Exposure</th>
                <th className="py-3 px-4">Throughput (items/min)</th>
                <th className="py-3 px-4">Hazard Hold</th>
                <th className="py-3 px-4">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary">
              {sweepPoints.map((point: SweepPoint) => {
                const isActive = Math.abs(point.threshold - tau) < 0.001;
                return (
                  <tr
                    key={point.threshold}
                    className={`hover:bg-bg-elevated/50 transition-colors ${isActive ? 'bg-amber-950/20 border-l-2 border-l-amber-500' : ''}`}
                  >
                    <td className={`py-2 px-4 font-bold ${isActive ? 'text-amber-400' : 'text-text-primary'}`}>
                      {fmt(point.threshold, 2)}
                    </td>
                    <td className="py-2 px-4">{point.inspectionLineCount}</td>
                    <td className="py-2 px-4">{fmt(point.inspectionLoad, 2)}</td>
                    <td className={`py-2 px-4 ${point.expectedHazardExposure > 1 ? 'text-amber-400 font-bold' : ''}`}>
                      {fmt(point.expectedHazardExposure)}
                    </td>
                    <td className="py-2 px-4">{fmt(point.throughputPerMinute, 1)}</td>
                    <td className="py-2 px-4">{point.hazardHoldCount}</td>
                    <td className="py-2 px-4"><ProvenanceChip provenance="Calculated" showPrefix={false} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Per-item decisions from gated run                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Per-Item Decisions // Gated Policy Run
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">
            Item Decision Audit Trail
          </h2>
        </div>

        <div className="border border-border-subtle bg-bg-surface rounded-[2px] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary text-text-muted text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Hazard Prob</th>
                <th className="py-3 px-4">Gate Score</th>
                <th className="py-3 px-4">Uncertainty</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Floor</th>
                <th className="py-3 px-4">Residual Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary">
              {gated.decisions.map((d: ItemDecision) => (
                <tr
                  key={d.itemId}
                  className={`hover:bg-bg-elevated/50 ${d.safetyFloorTriggered ? 'bg-amber-950/10' : ''}`}
                >
                  <td className="py-2 px-4">
                    <span className="text-text-primary font-bold">{d.itemId}</span>
                    <span className="block text-[10px] text-text-muted font-sans">{d.itemName.slice(0, 32)}</span>
                  </td>
                  <td className={`py-2 px-4 font-bold ${d.hazardProbability >= DEFAULT_GATE_POLICY.safetyFloor ? 'text-amber-400' : ''}`}>
                    {(d.hazardProbability * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 px-4">{fmt(d.gateScore)}</td>
                  <td className="py-2 px-4">{fmt(d.uncertainty)}</td>
                  <td className={`py-2 px-4 font-bold ${d.route === 'hazard_hold' ? 'text-amber-400' : d.route === 'inspection_line' ? 'text-sky-400' : 'text-text-primary'}`}>
                    {d.route}
                  </td>
                  <td className="py-2 px-4 text-[10px] text-text-muted">{d.reasonCode}</td>
                  <td className="py-2 px-4">
                    {d.safetyFloorTriggered ? (
                      <span className="text-amber-400 font-bold">FLOOR</span>
                    ) : (
                      <span className="text-text-muted">--</span>
                    )}
                  </td>
                  <td className="py-2 px-4">{fmt(d.residualRisk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Assumptions                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-amber-500">
            Engine Assumptions // src/engine/assumptions.ts
          </div>
          <h2 className="text-lg font-display font-bold text-text-primary">
            Labeled Estimates (Not Measured Facts)
          </h2>
        </div>

        <div className="border border-border-subtle bg-bg-surface rounded-[2px] overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary text-text-muted text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Value</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Rationale</th>
                <th className="py-3 px-4">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-text-secondary">
              {ENGINE_ASSUMPTIONS.map((asm: EngineAssumption) => (
                <tr key={asm.id} className="hover:bg-bg-elevated/50">
                  <td className="py-2 px-4 text-text-primary font-bold">{asm.id}</td>
                  <td className="py-2 px-4 text-text-primary">{asm.label}</td>
                  <td className="py-2 px-4 font-bold text-amber-400">{asm.value}</td>
                  <td className="py-2 px-4 text-text-muted">{asm.unit ?? '--'}</td>
                  <td className="py-2 px-4 text-[10px] text-text-secondary font-sans max-w-xs">{asm.description.slice(0, 120)}</td>
                  <td className="py-2 px-4"><ProvenanceChip provenance={asm.provenance} showPrefix={false} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
