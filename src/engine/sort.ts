/**
 * sort.ts -- Loopgate Batch Simulation Engine
 *
 * simulateBatch: processes a batch of Items through the uncertainty gate,
 *   produces per-item decisions, batch metrics, and a tick timeline for the digital twin.
 *
 * Inputs:  Array of Item from domain/types.ts + GatePolicy + EngineConfig (numeric assumptions)
 * Outputs: SimulationResult (decisions, metrics, ticks)
 *
 * Pure TypeScript. Zero UI, zero network, zero Math.random.
 * Deterministic: same input always produces the same output.
 */

import { z } from 'zod';
import type { Item, RouteId, SortingLineStage } from '../domain/types';
import { ItemSchema } from '../domain/schemas';
import { evaluateGate, type GatePolicy } from './gate';
import { ASM } from './assumptions';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 500;

const BatchInputSchema = z.array(ItemSchema).min(1, 'Batch must not be empty').max(MAX_BATCH_SIZE, `Batch exceeds max size of ${MAX_BATCH_SIZE}`);

/** Typed errors returned for invalid inputs. */
export class BatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchValidationError';
  }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Per-item routing decision produced by the engine. */
export interface ItemDecision {
  itemId: string;
  itemName: string;
  /** Input hazard probability (from Item). */
  hazardProbability: number;
  /** Computed gate score [0,1]. */
  gateScore: number;
  /** Computed uncertainty contribution [0,1]. */
  uncertainty: number;
  /** Assigned route after gate evaluation. */
  route: RouteId;
  /** Plain-language reason code. */
  reasonCode: string;
  /** Human-readable explanation for the audit trail. */
  explanation: string;
  /** Whether the safety floor rule was triggered. */
  safetyFloorTriggered: boolean;
  /** Residual hazard risk after this item's disposition */
  residualRisk: number;
  /** Status of operator override for this item, if one was provided. */
  overrideStatus?: 'accepted' | 'refused' | 'none';
  /** The route requested by the operator override, if any. */
  overrideRequestedRoute?: RouteId;
}

/** A single event in the digital twin timeline. */
export interface TickEvent {
  /** Elapsed seconds from batch start (t=0). Deterministic, not wall-clock. */
  t: number;
  itemId: string;
  stage: SortingLineStage;
  route: RouteId;
  /** Short label for 3D twin animation label. */
  label: string;
}

/** Route-level summary counts. */
export interface RouteSummary {
  route: RouteId;
  count: number;
  pct: number;
}

/** Aggregated batch metrics. All values are Calculated from engine inputs + assumptions. */
export interface BatchMetrics {
  /** Total items processed. Provenance: Calculated */
  totalItems: number;

  /** Items routed to hazard_hold. Provenance: Calculated */
  hazardHoldCount: number;

  /** Items routed to inspection_line. Provenance: Calculated */
  inspectionLineCount: number;

  /** Items reaching class bays (recyclable, reusable, biodegradable). Provenance: Calculated */
  classBayCount: number;

  /** Per-route breakdown. Provenance: Calculated */
  routeSummary: RouteSummary[];

  /**
   * Expected hazard exposure at the compactor:
   *   Sum over items AT compactor bays of (hazardProbability * compactionIgnitionFactor)
   *   PLUS residual risk from items at inspection_line = sum(hazardProb * (1 - inspectionAccuracy))
   * Provenance: Calculated
   * Assumptions: ea-04 (compactionIgnitionFactor), ea-05 (inspectionAccuracy)
   */
  expectedHazardExposure: number;

  /**
   * Inspection load: number of items per minute diverted to inspection_line.
   * = inspectionLineCount / (totalItems / lineThroughputPerMinute)
   * Provenance: Calculated
   * Assumptions: ea-07 (lineThroughputPerMinute)
   */
  inspectionLoad: number;

  /**
   * True if inspectionLoad exceeds inspectionCapacityPerMinute.
   * Assumptions: ea-06 (inspectionCapacityPerMinute)
   */
  backlogActive: boolean;

  /**
   * Delay (in minutes) introduced by backlog = max(0, (inspectionLineCount - inspectionCapacityPerMinute * batchDurationMinutes) / inspectionCapacityPerMinute)
   * Provenance: Calculated
   */
  backlogDelayMinutes: number;

  /**
   * Effective throughput after backlog penalty.
   * = min(lineThroughputPerMinute, totalItems / (batchDurationMinutes + backlogDelayMinutes))
   * Provenance: Calculated
   */
  throughputPerMinute: number;

  /** Safety floor triggers (items with hazardProbability >= safetyFloor). Provenance: Calculated */
  safetyFloorTriggerCount: number;

  /** Items that escaped to compactor with hazardProbability >= safetyFloor (should be 0). */
  safetyFloorEscapeCount: number;
}

/** Full simulation result. */
export interface SimulationResult {
  decisions: ItemDecision[];
  metrics: BatchMetrics;
  /** Tick timeline for the 3D digital twin. */
  ticks: TickEvent[];
  /** The policy applied in this simulation. */
  policy: GatePolicy;
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a batch of items through the uncertainty gate and produce routing decisions,
 * metrics, and a tick timeline.
 *
 * @param batch  Array of Item objects to process.
 * @param policy GatePolicy (safetyFloor, hazardConfidentCutoff, inspectionThreshold).
 * @throws BatchValidationError if batch is empty, oversized, or contains invalid items.
 */
export function simulateBatch(
  batch: Item[],
  policy: GatePolicy,
  overrides?: Record<string, RouteId>,
): SimulationResult {
  // Validate input
  const parsed = BatchInputSchema.safeParse(batch);
  if (!parsed.success) {
    throw new BatchValidationError(`Invalid batch: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }

  // Validate probability values
  for (const item of batch) {
    if (isNaN(item.hazardProbability) || isNaN(item.overallConfidence)) {
      throw new BatchValidationError(`Item ${item.id} contains NaN probability values`);
    }
  }

  const decisions: ItemDecision[] = [];
  const ticks: TickEvent[] = [];
  const routeCounts = new Map<RouteId, number>();

  // Nominal time step: items arrive at lineThroughputPerMinute rate
  // t is in seconds from batch start
  const secondsPerItem = 60 / ASM.lineThroughputPerMinute;

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const t = i * secondsPerItem;

    // Derive modelDisagreement from item: use the spread of hazardProbabilities across detections
    // If only one detection, disagreement is 0.
    const modelDisagreement = computeModelDisagreement(item);

    const gateInput = {
      hazardProbability: item.hazardProbability,
      confidence: item.overallConfidence,
      modelDisagreement,
      predictedClass: item.primaryClass,
    };

    const decision = evaluateGate(gateInput, policy);
    let finalRoute = decision.route;
    let reasonCode = decision.reasonCode;
    let explanation = decision.explanation;
    let overrideStatus: 'accepted' | 'refused' | 'none' = 'none';
    const requestedOverride = overrides?.[item.id];

    if (requestedOverride) {
      const isFloorItem = item.hazardProbability >= policy.safetyFloor;
      const isCompactorStream =
        requestedOverride === 'recyclable_bay' ||
        requestedOverride === 'biodegradable_bay' ||
        requestedOverride === 'compactor';

      if (isFloorItem && isCompactorStream) {
        // SAFETY FLOOR INVARIANT: An override can NEVER push a floor item into the compactor stream
        overrideStatus = 'refused';
        reasonCode = 'OVERRIDE_REFUSED_SAFETY_FLOOR';
        explanation = `Override to ${requestedOverride} refused: Item hazard probability ${(item.hazardProbability * 100).toFixed(1)}% meets or exceeds the safety floor ${(policy.safetyFloor * 100).toFixed(0)}%. Compaction barred.`;
      } else {
        overrideStatus = 'accepted';
        finalRoute = requestedOverride;
        reasonCode = 'OPERATOR_OVERRIDE_ACCEPTED';
        explanation = `Operator manual override accepted: routed to ${requestedOverride}.`;
      }
    }

    // Compute residual risk for this item's disposition
    const residualRisk = computeResidualRisk(item.hazardProbability, finalRoute);

    decisions.push({
      itemId: item.id,
      itemName: item.name,
      hazardProbability: item.hazardProbability,
      gateScore: decision.gateScore,
      uncertainty: decision.uncertainty,
      route: finalRoute,
      reasonCode,
      explanation,
      safetyFloorTriggered: decision.safetyFloorTriggered,
      residualRisk,
      overrideStatus,
      overrideRequestedRoute: requestedOverride,
    });

    // Tick timeline: intake → scanning → uncertainty_gate → diverting → routed
    ticks.push({ t, itemId: item.id, stage: 'intake', route: finalRoute, label: 'INTAKE' });
    ticks.push({ t: t + 1, itemId: item.id, stage: 'scanning', route: finalRoute, label: 'SCAN' });
    ticks.push({ t: t + 2, itemId: item.id, stage: 'uncertainty_gate', route: finalRoute, label: 'GATE' });
    ticks.push({ t: t + 3, itemId: item.id, stage: 'diverting', route: finalRoute, label: 'DIVERT' });
    ticks.push({ t: t + 4, itemId: item.id, stage: 'routed', route: finalRoute, label: finalRoute.toUpperCase() });

    // Accumulate route counts
    routeCounts.set(finalRoute, (routeCounts.get(finalRoute) ?? 0) + 1);
  }

  const metrics = computeMetrics(batch.length, decisions, routeCounts, policy);

  return { decisions, metrics, ticks, policy };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute model disagreement for an item as the range of hazardProbability
 * across its detections, normalized to [0,1].
 */
function computeModelDisagreement(item: Item): number {
  if (item.detections.length <= 1) return 0;
  const probs = item.detections.map((d) => d.hazardProbability);
  const range = Math.max(...probs) - Math.min(...probs);
  return Math.min(1, range); // already in [0,1] since probs are in [0,1]
}

/**
 * Compute residual risk based on disposition route:
 * - compactor bays: hazardProbability * compactionIgnitionFactor
 * - inspection_line: hazardProbability * (1 - inspectionAccuracy)
 * - hazard_hold: 0 (successfully quarantined)
 */
function computeResidualRisk(hazardProbability: number, route: RouteId): number {
  if (route === 'hazard_hold') return 0;
  if (route === 'inspection_line') {
    return hazardProbability * (1 - ASM.inspectionAccuracy);
  }
  // Class bays (recyclable_bay, reusable_bay, biodegradable_bay) — some go through compactor
  // Reusable bay does not use compactor, but we apply a conservative factor for all class bays
  // since the engine does not know downstream facility layout.
  return hazardProbability * ASM.compactionIgnitionFactor;
}

/**
 * Compute batch-level metrics from decisions.
 */
function computeMetrics(
  totalItems: number,
  decisions: ItemDecision[],
  routeCounts: Map<RouteId, number>,
  policy: GatePolicy,
): BatchMetrics {
  const hazardHoldCount = routeCounts.get('hazard_hold') ?? 0;
  const inspectionLineCount = routeCounts.get('inspection_line') ?? 0;
  const classBayCount = totalItems - hazardHoldCount - inspectionLineCount;

  // Route summary
  const allRoutes: RouteId[] = [
    'hazard_hold', 'inspection_line', 'recyclable_bay', 'reusable_bay',
    'biodegradable_bay', 'compactor',
  ];
  const routeSummary: RouteSummary[] = allRoutes
    .map((route) => ({
      route,
      count: routeCounts.get(route) ?? 0,
      pct: totalItems > 0 ? ((routeCounts.get(route) ?? 0) / totalItems) * 100 : 0,
    }))
    .filter((r) => r.count > 0);

  // Expected hazard exposure = sum of residual risks
  const expectedHazardExposure = decisions.reduce((sum, d) => sum + d.residualRisk, 0);

  // Safety floor stats
  const safetyFloorTriggerCount = decisions.filter((d) => d.safetyFloorTriggered).length;
  const safetyFloorEscapeCount = decisions.filter(
    (d) => d.hazardProbability >= policy.safetyFloor &&
      (d.route === 'recyclable_bay' || d.route === 'reusable_bay' ||
       d.route === 'biodegradable_bay' || d.route === 'compactor'),
  ).length;

  // Throughput and backlog
  const batchDurationMinutes = totalItems / ASM.lineThroughputPerMinute;
  const inspectionLoad = batchDurationMinutes > 0
    ? inspectionLineCount / batchDurationMinutes
    : 0;
  const backlogActive = inspectionLoad > ASM.inspectionCapacityPerMinute;
  const excessItems = Math.max(0, inspectionLineCount - ASM.inspectionCapacityPerMinute * batchDurationMinutes);
  const backlogDelayMinutes = backlogActive
    ? excessItems / ASM.inspectionCapacityPerMinute
    : 0;
  const effectiveDuration = batchDurationMinutes + backlogDelayMinutes;
  const throughputPerMinute = effectiveDuration > 0
    ? Math.min(ASM.lineThroughputPerMinute, totalItems / effectiveDuration)
    : 0;

  return {
    totalItems,
    hazardHoldCount,
    inspectionLineCount,
    classBayCount,
    routeSummary,
    expectedHazardExposure,
    inspectionLoad,
    backlogActive,
    backlogDelayMinutes,
    throughputPerMinute,
    safetyFloorTriggerCount,
    safetyFloorEscapeCount,
  };
}
