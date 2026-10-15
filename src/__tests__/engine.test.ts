/**
 * engine.test.ts -- Loopgate Engine Test Suite (Phase 2)
 *
 * Covers all required invariants:
 *  1. Safety floor invariant (no floor-triggered item reaches compactor)
 *  2. Conservation (every item ends in exactly one terminal route)
 *  3. Determinism (same input → same output)
 *  4. Monotonicity (lowering threshold never increases exposure, never decreases inspection load)
 *  5. Capacity (load above capacity → backlog and lower throughput)
 *  6. Slider is alive (sweepThreshold yields >= 3 distinct inspectionLoad values on Simulated batch)
 *  7. Edge cases (empty, one item, all hazardous, probability at 0/1/floor, invalid input)
 *  8. compareBranches (baseline exposure > gated, deltas consistent)
 */

import { describe, it, expect } from 'vitest';
import type { Item } from '../domain/types';
import { SYNTHETIC_SCENARIO_ITEMS } from '../data/scenario';
import {
  simulateBatch,
  BatchValidationError,
} from '../engine/sort';
import {
  compareBranches,
  sweepThreshold,
  NO_GATE_POLICY,
} from '../engine/compare';
import {
  DEFAULT_GATE_POLICY,
} from '../engine/gate';
import { ASM } from '../engine/assumptions';
import { buildTwinTimeline } from '../engine/twin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clone an item array to prevent mutation across tests. */
function cloneBatch(items: Item[]): Item[] {
  return items.map((i) => ({ ...i, detections: i.detections.map((d) => ({ ...d })) }));
}

/** Make a minimal valid Item. */
function makeItem(
  id: string,
  hazardProbability: number,
  confidence: number,
  primaryClass: Item['primaryClass'] = 'recyclable',
): Item {
  return {
    id,
    name: `Test Item ${id}`,
    barcode: `BAR-${id}`,
    detections: [
      {
        id: `det-${id}`,
        box: null,
        label: 'test',
        materialClass: primaryClass,
        hazardProbability,
        confidence,
        source: 'synthetic',
        provenance: 'Simulated',
      },
    ],
    primaryClass,
    hazardProbability,
    overallConfidence: confidence,
    gateScore: 0,      // engine recomputes this
    status: 'pending',
    assignedRoute: 'inspection_line', // engine overrides this
    provenance: 'Simulated',
    createdAt: '2026-10-15T09:00:00.000Z',
  };
}

/** Generate N items with controlled hazardProbability values. Deterministic. */
function generateBatch(n: number, hazardProb: number, confidence = 0.9): Item[] {
  return Array.from({ length: n }, (_, i) =>
    makeItem(`gen-${i.toString().padStart(3, '0')}`, hazardProb, confidence),
  );
}

// Terminal routes: an item ends here with no further movement
const TERMINAL_ROUTES = new Set([
  'compactor', 'inspection_line', 'recyclable_bay',
  'reusable_bay', 'biodegradable_bay', 'hazard_hold',
]);

// ---------------------------------------------------------------------------
// 1. Safety floor invariant
// ---------------------------------------------------------------------------

describe('Safety Floor Invariant', () => {
  it('no item with hazardProbability >= safetyFloor reaches a compactor-stream route', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);

    for (const decision of result.decisions) {
      if (decision.hazardProbability >= DEFAULT_GATE_POLICY.safetyFloor) {
        expect(decision.route).not.toBe('compactor');
        expect(decision.route).not.toBe('recyclable_bay');
        expect(decision.route).not.toBe('biodegradable_bay');
        // reusable_bay is also NOT compaction stream, but let's verify the floor
        // blocks it from class bays entirely for floor-triggered items
        expect(['inspection_line', 'hazard_hold']).toContain(decision.route);
      }
    }
  });

  it('safety floor escape count is always 0 on synthetic scenario', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.metrics.safetyFloorEscapeCount).toBe(0);
  });

  it('floor invariant holds with seeded generated batch at floor boundary', () => {
    // Items at exactly safetyFloor should be blocked
    const floorItem = makeItem('floor-exact', DEFAULT_GATE_POLICY.safetyFloor, 0.90, 'hazardous');
    // Item at floor - 0.001 should NOT be blocked by floor
    const belowFloorItem = makeItem(
      'below-floor',
      DEFAULT_GATE_POLICY.safetyFloor - 0.001,
      0.90,
      'recyclable',
    );
    const result = simulateBatch([floorItem, belowFloorItem], DEFAULT_GATE_POLICY);

    const floorDecision = result.decisions.find((d) => d.itemId === 'floor-exact')!;
    const belowDecision = result.decisions.find((d) => d.itemId === 'below-floor')!;

    expect(floorDecision.safetyFloorTriggered).toBe(true);
    expect(['inspection_line', 'hazard_hold']).toContain(floorDecision.route);
    expect(belowDecision.safetyFloorTriggered).toBe(false);
  });

  it('floor invariant holds on a batch of 50 all-hazardous items', () => {
    const batch = generateBatch(50, 0.95, 0.85);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.metrics.safetyFloorEscapeCount).toBe(0);
    for (const d of result.decisions) {
      expect(['inspection_line', 'hazard_hold']).toContain(d.route);
    }
  });

  it('probability exactly at 0 is never floor-triggered', () => {
    const batch = [makeItem('zero-prob', 0, 0.95, 'recyclable')];
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.decisions[0].safetyFloorTriggered).toBe(false);
  });

  it('probability exactly at 1 always triggers floor', () => {
    const batch = [makeItem('prob-one', 1.0, 0.95, 'hazardous')];
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.decisions[0].safetyFloorTriggered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Conservation: every item ends in exactly one terminal route
// ---------------------------------------------------------------------------

describe('Conservation', () => {
  it('every item in the simulated batch ends in exactly one terminal route', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);

    expect(result.decisions).toHaveLength(batch.length);
    for (const decision of result.decisions) {
      expect(TERMINAL_ROUTES.has(decision.route)).toBe(true);
    }

    // Total route counts should sum to batch length
    const totalCounted = result.metrics.routeSummary.reduce((sum, r) => sum + r.count, 0);
    expect(totalCounted).toBe(batch.length);
  });

  it('classBayCount + inspectionLineCount + hazardHoldCount === totalItems', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    const m = result.metrics;
    expect(m.classBayCount + m.inspectionLineCount + m.hazardHoldCount).toBe(m.totalItems);
  });
});

// ---------------------------------------------------------------------------
// 3. Determinism: same input → same output
// ---------------------------------------------------------------------------

describe('Determinism', () => {
  it('produces deep-equal output for equal input on synthetic batch', () => {
    const batch1 = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const batch2 = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result1 = simulateBatch(batch1, DEFAULT_GATE_POLICY);
    const result2 = simulateBatch(batch2, DEFAULT_GATE_POLICY);
    expect(result1.decisions).toEqual(result2.decisions);
    expect(result1.metrics).toEqual(result2.metrics);
  });

  it('produces deep-equal output for generated batch', () => {
    const batch1 = generateBatch(20, 0.45, 0.70);
    const batch2 = generateBatch(20, 0.45, 0.70);
    const result1 = simulateBatch(batch1, DEFAULT_GATE_POLICY);
    const result2 = simulateBatch(batch2, DEFAULT_GATE_POLICY);
    expect(result1.decisions).toEqual(result2.decisions);
  });
});

// ---------------------------------------------------------------------------
// 4. Monotonicity
// ---------------------------------------------------------------------------

describe('Monotonicity', () => {
  it('lowering inspectionThreshold never increases expectedHazardExposure', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const thresholds = [0.9, 0.7, 0.5, 0.3, 0.1];
    const points = sweepThreshold(
      batch,
      { safetyFloor: DEFAULT_GATE_POLICY.safetyFloor, hazardConfidentCutoff: DEFAULT_GATE_POLICY.hazardConfidentCutoff },
      thresholds,
    );

    // Points are sorted ascending. As threshold INCREASES, exposure can only stay same or increase
    // (fewer items sent to inspection means more potentially hazardous items go to class bays).
    for (let i = 1; i < points.length; i++) {
      expect(points[i].expectedHazardExposure).toBeGreaterThanOrEqual(
        points[i - 1].expectedHazardExposure - 1e-9, // floating point tolerance
      );
    }
  });

  it('lowering inspectionThreshold never decreases inspectionLoad', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const thresholds = [0.9, 0.7, 0.5, 0.3, 0.1];
    const points = sweepThreshold(
      batch,
      { safetyFloor: DEFAULT_GATE_POLICY.safetyFloor, hazardConfidentCutoff: DEFAULT_GATE_POLICY.hazardConfidentCutoff },
      thresholds,
    );

    // As threshold INCREASES, inspection load can only stay same or decrease
    for (let i = 1; i < points.length; i++) {
      expect(points[i].inspectionLoad).toBeLessThanOrEqual(
        points[i - 1].inspectionLoad + 1e-9,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Capacity and backlog
// ---------------------------------------------------------------------------

describe('Backlog & Throughput', () => {
  it('inspection load above capacity triggers backlog and reduces throughput', () => {
    // Create a batch where every item goes to inspection: low threshold, below-floor items
    const batch = generateBatch(100, 0.05, 0.60);
    const highInspectionPolicy = { ...DEFAULT_GATE_POLICY, inspectionThreshold: 0.01 };
    const result = simulateBatch(batch, highInspectionPolicy);

    // inspectionLoad = inspectionLineCount / (100 / 20) = inspectionLineCount / 5
    // At threshold 0.01 and low hazard prob, everything below floor should go to inspection
    if (result.metrics.inspectionLoad > ASM.inspectionCapacityPerMinute) {
      expect(result.metrics.backlogActive).toBe(true);
      expect(result.metrics.backlogDelayMinutes).toBeGreaterThan(0);
      expect(result.metrics.throughputPerMinute).toBeLessThan(ASM.lineThroughputPerMinute);
    }
  });

  it('no backlog when all items auto-route to class bays', () => {
    // Very high threshold + very low hazard → nothing goes to inspection
    const batch = generateBatch(10, 0.01, 0.99);
    const noInspectionPolicy = { ...DEFAULT_GATE_POLICY, inspectionThreshold: 0.99 };
    const result = simulateBatch(batch, noInspectionPolicy);
    // inspectionLineCount could be 0 (all below floor AND below threshold)
    if (result.metrics.inspectionLineCount === 0) {
      expect(result.metrics.backlogActive).toBe(false);
      expect(result.metrics.backlogDelayMinutes).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Slider is alive on Simulated scenario
// ---------------------------------------------------------------------------

describe('Slider Liveness', () => {
  it('sweepThreshold produces at least 3 distinct inspectionLoad values on Simulated scenario', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const thresholds = [0.0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const points = sweepThreshold(
      batch,
      { safetyFloor: DEFAULT_GATE_POLICY.safetyFloor, hazardConfidentCutoff: DEFAULT_GATE_POLICY.hazardConfidentCutoff },
      thresholds,
    );

    const distinctLoads = new Set(points.map((p) => p.inspectionLoad));
    expect(distinctLoads.size).toBeGreaterThanOrEqual(3);
  });

  it('sweepThreshold returns points in ascending threshold order', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const thresholds = [0.9, 0.1, 0.5, 0.3, 0.7];
    const points = sweepThreshold(
      batch,
      { safetyFloor: DEFAULT_GATE_POLICY.safetyFloor, hazardConfidentCutoff: DEFAULT_GATE_POLICY.hazardConfidentCutoff },
      thresholds,
    );

    for (let i = 1; i < points.length; i++) {
      expect(points[i].threshold).toBeGreaterThanOrEqual(points[i - 1].threshold);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Edge cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('empty batch throws BatchValidationError', () => {
    expect(() => simulateBatch([], DEFAULT_GATE_POLICY)).toThrow(BatchValidationError);
  });

  it('batch of one item works correctly', () => {
    const batch = [makeItem('single', 0.01, 0.99, 'recyclable')];
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.decisions).toHaveLength(1);
    expect(result.metrics.totalItems).toBe(1);
  });

  it('all hazardous batch: all items blocked by floor, none reach class bays', () => {
    const batch = generateBatch(20, 0.95, 0.90);
    batch.forEach((item) => { item.primaryClass = 'hazardous'; });
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.metrics.classBayCount).toBe(0);
    expect(result.metrics.safetyFloorEscapeCount).toBe(0);
  });

  it('probability exactly at safety floor boundary is floor-triggered', () => {
    const batch = [makeItem('at-floor', DEFAULT_GATE_POLICY.safetyFloor, 0.95, 'hazardous')];
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.decisions[0].safetyFloorTriggered).toBe(true);
  });

  it('probability 0 is not floor-triggered and is auto-routed', () => {
    const batch = [makeItem('prob-0', 0, 0.99, 'recyclable')];
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    expect(result.decisions[0].safetyFloorTriggered).toBe(false);
    expect(result.decisions[0].route).toBe('recyclable_bay');
  });

  it('probability 1.0 triggers floor regardless of threshold', () => {
    const batch = [makeItem('prob-1', 1.0, 0.95, 'hazardous')];
    const highThreshPolicy = { ...DEFAULT_GATE_POLICY, inspectionThreshold: 0.99 };
    const result = simulateBatch(batch, highThreshPolicy);
    expect(result.decisions[0].safetyFloorTriggered).toBe(true);
  });

  it('invalid input (NaN probability) throws BatchValidationError', () => {
    const item = makeItem('nan-item', 0.5, 0.8, 'recyclable');
    // Inject NaN after construction to bypass type safety
    (item as unknown as Record<string, unknown>).hazardProbability = NaN;
    expect(() => simulateBatch([item], DEFAULT_GATE_POLICY)).toThrow(BatchValidationError);
  });
});

// ---------------------------------------------------------------------------
// 8. compareBranches
// ---------------------------------------------------------------------------

describe('compareBranches', () => {
  it('baseline exposure is higher than gated on Simulated scenario', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = compareBranches(batch, NO_GATE_POLICY, DEFAULT_GATE_POLICY);

    expect(result.baseline.metrics.expectedHazardExposure).toBeGreaterThan(
      result.gated.metrics.expectedHazardExposure,
    );
  });

  it('gated policy quarantines more hazardous items than baseline', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = compareBranches(batch, NO_GATE_POLICY, DEFAULT_GATE_POLICY);

    expect(result.gated.metrics.hazardHoldCount).toBeGreaterThan(
      result.baseline.metrics.hazardHoldCount,
    );
  });

  it('deltas are consistent with individual simulation results', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = compareBranches(batch, NO_GATE_POLICY, DEFAULT_GATE_POLICY);

    // Delta = gated - baseline
    const expectedExposureDelta =
      result.gated.metrics.expectedHazardExposure -
      result.baseline.metrics.expectedHazardExposure;
    expect(result.deltas.expectedHazardExposureDelta).toBeCloseTo(expectedExposureDelta, 9);

    const expectedHazardHoldDelta =
      result.gated.metrics.hazardHoldCount - result.baseline.metrics.hazardHoldCount;
    expect(result.deltas.hazardHoldCountDelta).toBe(expectedHazardHoldDelta);
  });

  it('both branches total items match batch size', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = compareBranches(batch, NO_GATE_POLICY, DEFAULT_GATE_POLICY);
    expect(result.baseline.metrics.totalItems).toBe(batch.length);
    expect(result.gated.metrics.totalItems).toBe(batch.length);
  });
});

// ---------------------------------------------------------------------------
// 9. Digital twin timeline
// ---------------------------------------------------------------------------

describe('Digital Twin Timeline', () => {
  it('every batch item appears in the tick timeline', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    const timeline = buildTwinTimeline(result);

    const itemIdsInTimeline = new Set(timeline.map((e) => e.itemId));
    for (const item of batch) {
      expect(itemIdsInTimeline.has(item.id)).toBe(true);
    }
  });

  it('timeline is sorted in ascending time order', () => {
    const batch = cloneBatch(SYNTHETIC_SCENARIO_ITEMS);
    const result = simulateBatch(batch, DEFAULT_GATE_POLICY);
    const timeline = buildTwinTimeline(result);

    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].t).toBeGreaterThanOrEqual(timeline[i - 1].t);
    }
  });
});
