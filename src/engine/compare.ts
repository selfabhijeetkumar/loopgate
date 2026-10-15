/**
 * compare.ts -- Loopgate Branch Comparison & Threshold Sweep
 *
 * compareBranches: runs the same batch under two policies (baseline vs gated)
 *   and produces side-by-side metrics and deltas.
 *   Branch A = no gate (all items auto-routed to class bays / compactor).
 *   Branch B = full gate policy (safety floor + inspection threshold).
 *
 * sweepThreshold: runs the same batch across a range of inspectionThreshold values
 *   to produce the exposure vs inspection load trade-off curve (slider data).
 *
 * Pure TypeScript. Zero UI, zero network, zero Math.random.
 */

import type { Item, RouteId } from '../domain/types';
import type { GatePolicy } from './gate';
import { simulateBatch, type BatchMetrics, type SimulationResult } from './sort';
import { BatchValidationError } from './sort';

// ---------------------------------------------------------------------------
// Branch comparison
// ---------------------------------------------------------------------------

/** Per-branch snapshot for comparison display. */
export interface BranchSnapshot {
  id: string;
  label: string;
  policy: GatePolicy;
  metrics: BatchMetrics;
  decisions: SimulationResult['decisions'];
}

/** Deltas (gated minus baseline) for key safety and throughput metrics. */
export interface BranchDeltas {
  /** Negative = gated is safer (lower exposure). */
  expectedHazardExposureDelta: number;
  /** Positive = gated sends more to inspection. */
  inspectionLoadDelta: number;
  /** Negative = gated may reduce throughput. */
  throughputDelta: number;
  /** Positive = gated quarantines more hazardous items. */
  hazardHoldCountDelta: number;
  /** Positive = gated catches more floor-trigger items. */
  safetyFloorTriggerDelta: number;
}

export interface CompareResult {
  baseline: BranchSnapshot;
  gated: BranchSnapshot;
  deltas: BranchDeltas;
}

/**
 * No-gate baseline policy: no safety floor, no inspection threshold, all items auto-routed.
 * Equivalent to a naive line with no uncertainty gate.
 */
export const NO_GATE_POLICY: GatePolicy = {
  safetyFloor: 1.1,           // Floor above 1 → never triggers (no floor)
  hazardConfidentCutoff: 1.0, // Never triggers
  inspectionThreshold: 1.1,   // Threshold above 1 → never sends to inspection
};

/**
 * Compare the same batch under two policies.
 * Branch A is the baseline (no gate), Branch B is the gated policy.
 *
 * @throws BatchValidationError if batch is invalid.
 */
export function compareBranches(
  batch: Item[],
  policyA: GatePolicy,
  policyB: GatePolicy,
  overridesB?: Record<string, RouteId>,
): CompareResult {
  const resultA = simulateBatch(batch, policyA);
  const resultB = simulateBatch(batch, policyB, overridesB);

  const deltas: BranchDeltas = {
    expectedHazardExposureDelta:
      resultB.metrics.expectedHazardExposure - resultA.metrics.expectedHazardExposure,
    inspectionLoadDelta:
      resultB.metrics.inspectionLoad - resultA.metrics.inspectionLoad,
    throughputDelta:
      resultB.metrics.throughputPerMinute - resultA.metrics.throughputPerMinute,
    hazardHoldCountDelta:
      resultB.metrics.hazardHoldCount - resultA.metrics.hazardHoldCount,
    safetyFloorTriggerDelta:
      resultB.metrics.safetyFloorTriggerCount - resultA.metrics.safetyFloorTriggerCount,
  };

  return {
    baseline: {
      id: 'branch-a',
      label: 'Baseline (No Gate)',
      policy: policyA,
      metrics: resultA.metrics,
      decisions: resultA.decisions,
    },
    gated: {
      id: 'branch-b',
      label: 'Gated Policy',
      policy: policyB,
      metrics: resultB.metrics,
      decisions: resultB.decisions,
    },
    deltas,
  };
}

// ---------------------------------------------------------------------------
// Threshold sweep
// ---------------------------------------------------------------------------

/** A single data point in the threshold sweep. */
export interface SweepPoint {
  /** The inspectionThreshold value applied. [0, 1] */
  threshold: number;
  /** Expected hazard exposure at this threshold. Provenance: Calculated */
  expectedHazardExposure: number;
  /** Inspection load (items/minute) at this threshold. Provenance: Calculated */
  inspectionLoad: number;
  /** Throughput (items/minute) at this threshold. Provenance: Calculated */
  throughputPerMinute: number;
  /** Number of items routed to inspection_line. Provenance: Calculated */
  inspectionLineCount: number;
  /** Number of items routed to hazard_hold. Provenance: Calculated */
  hazardHoldCount: number;
}

/**
 * Sweep the inspectionThreshold parameter across the provided values and record
 * key metrics at each point. The safetyFloor and hazardConfidentCutoff remain fixed.
 *
 * Returns an array of SweepPoints sorted by ascending threshold.
 *
 * This is the data source for the live threshold slider on the dev page.
 *
 * @throws BatchValidationError if batch is invalid.
 */
export function sweepThreshold(
  batch: Item[],
  basePolicy: Omit<GatePolicy, 'inspectionThreshold'>,
  thresholds: number[],
): SweepPoint[] {
  if (thresholds.length === 0) {
    throw new BatchValidationError('sweepThreshold requires at least one threshold value');
  }

  const sorted = [...thresholds].sort((a, b) => a - b);

  return sorted.map((threshold) => {
    const policy: GatePolicy = { ...basePolicy, inspectionThreshold: threshold };
    const result = simulateBatch(batch, policy);
    const m = result.metrics;
    return {
      threshold,
      expectedHazardExposure: m.expectedHazardExposure,
      inspectionLoad: m.inspectionLoad,
      throughputPerMinute: m.throughputPerMinute,
      inspectionLineCount: m.inspectionLineCount,
      hazardHoldCount: m.hazardHoldCount,
    };
  });
}

// Re-export error type for consumers.
export { BatchValidationError };
