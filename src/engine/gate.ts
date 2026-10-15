/**
 * gate.ts -- Loopgate Uncertainty Gate Engine
 *
 * Implements the canonical gate policy (Step 0.1 corrected semantics):
 *
 *   gateScore in [0,1]. HIGHER = MORE reason for human inspection.
 *
 *   Gate Score Formula:
 *     uncertainty = ((1 - confidence) + modelDisagreement) / 2
 *     gateScore   = HAZARD_WEIGHT * hazardProbability + (1 - HAZARD_WEIGHT) * uncertainty
 *
 *   Routing policy (in priority order):
 *   1. If hazardProbability >= safetyFloor:
 *        NEVER routes to compactor.
 *        If confidence >= hazardConfidentCutoff AND modelDisagreement <= 0.3:
 *          → hazard_hold   (model is confident it is hazardous)
 *        Else:
 *          → inspection_line  (too uncertain to assert class, human must verify)
 *   2. Else if gateScore >= inspectionThreshold:
 *        → inspection_line   (above-floor item but gate deems it too uncertain)
 *   3. Else:
 *        → class bay for predictedClass (recyclable_bay | reusable_bay | biodegradable_bay)
 *           Recyclable and biodegradable may proceed through the compactor stage as configured.
 *           Reusable goes to refurbishment bay (not compactor).
 *
 * Pure TypeScript. Zero UI or network imports.
 * No Math.random usage -- all outputs are deterministic given inputs.
 */

import type { MaterialClass, RouteId } from '../domain/types';

/** Weight given to hazardProbability vs uncertainty in gate score computation. */
export const HAZARD_WEIGHT = 0.65;

/**
 * Hard safety floor. Items with hazardProbability >= SAFETY_FLOOR are categorically
 * barred from the compactor stream under any policy setting (invariant EA-01).
 * SINGLE SOURCE OF TRUTH -- import from here; do not duplicate this value.
 */
export const SAFETY_FLOOR = 0.30;

/** Max modelDisagreement below which a floor-triggered item is confidently hazardous. */
export const HAZARD_CONFIDENT_DISAGREEMENT_CUTOFF = 0.30;

export interface GateInput {
  hazardProbability: number;   // [0, 1] estimated probability item is hazardous
  confidence: number;          // [0, 1] classification model confidence in predicted class
  modelDisagreement: number;   // [0, 1] disagreement between Stage 1 and Stage 2 predictions
  predictedClass: MaterialClass;
}

export interface GatePolicy {
  /** Hard safety floor: items with hazardProbability >= safetyFloor cannot reach compactor. */
  safetyFloor: number;
  /** Minimum confidence to confidently assign floor-triggered item to hazard_hold (vs inspection). */
  hazardConfidentCutoff: number;
  /** Gate score threshold above which an above-floor item goes to inspection_line. */
  inspectionThreshold: number;
}

export interface GateDecision {
  /** Computed gate score in [0,1]. Higher = more inspection pressure. */
  gateScore: number;
  /** Computed uncertainty contribution in [0,1]. */
  uncertainty: number;
  /** Routing decision. */
  route: RouteId;
  /** Plain-language reason code for audit trail and GenAI explainer. */
  reasonCode: ReasonCode;
  /** Human-readable explanation. */
  explanation: string;
  /** Whether the safety floor was triggered. */
  safetyFloorTriggered: boolean;
}

export type ReasonCode =
  | 'FLOOR_CONFIDENT_HAZARD'    // Above floor, confident → hazard_hold
  | 'FLOOR_UNCERTAIN_HAZARD'    // Above floor, uncertain → inspection (ambiguous device)
  | 'GATE_ABOVE_THRESHOLD'      // Below floor but gate score too high → inspection
  | 'AUTO_ROUTED_CLASS_BAY'     // Confident, low hazard → direct class stream
  | 'OVERRIDE_REFUSED_SAFETY_FLOOR' // Operator override refused by safety floor
  | 'OPERATOR_OVERRIDE_ACCEPTED';   // Operator override accepted

/**
 * Compute the gate score and routing decision for a single item.
 * Deterministic: same inputs always produce the same output.
 */
export function evaluateGate(input: GateInput, policy: GatePolicy): GateDecision {
  const { hazardProbability, confidence, modelDisagreement, predictedClass } = input;
  const { safetyFloor, hazardConfidentCutoff, inspectionThreshold } = policy;

  // Clamp inputs to valid range for safety
  const p = Math.min(1, Math.max(0, hazardProbability));
  const c = Math.min(1, Math.max(0, confidence));
  const d = Math.min(1, Math.max(0, modelDisagreement));

  // Gate score formula: weight hazard probability more heavily than uncertainty
  const uncertainty = ((1 - c) + d) / 2;
  const gateScore = HAZARD_WEIGHT * p + (1 - HAZARD_WEIGHT) * uncertainty;

  // --- Priority 1: Safety floor check ---
  if (p >= safetyFloor) {
    const confidentlyHazardous =
      c >= hazardConfidentCutoff && d <= HAZARD_CONFIDENT_DISAGREEMENT_CUTOFF;

    if (confidentlyHazardous) {
      return {
        gateScore,
        uncertainty,
        route: 'hazard_hold',
        reasonCode: 'FLOOR_CONFIDENT_HAZARD',
        explanation:
          `Hazard probability ${(p * 100).toFixed(1)}% meets or exceeds safety floor ` +
          `${(safetyFloor * 100).toFixed(0)}% and model confidence ${(c * 100).toFixed(1)}% ` +
          `is above the cutoff ${(hazardConfidentCutoff * 100).toFixed(0)}% with low disagreement. ` +
          `Item routed to hazard quarantine hold.`,
        safetyFloorTriggered: true,
      };
    } else {
      return {
        gateScore,
        uncertainty,
        route: 'inspection_line',
        reasonCode: 'FLOOR_UNCERTAIN_HAZARD',
        explanation:
          `Hazard probability ${(p * 100).toFixed(1)}% meets or exceeds safety floor ` +
          `${(safetyFloor * 100).toFixed(0)}% but model confidence ${(c * 100).toFixed(1)}% ` +
          `or model disagreement ${(d * 100).toFixed(1)}% is too high to auto-quarantine. ` +
          `Human inspection required before any routing decision.`,
        safetyFloorTriggered: true,
      };
    }
  }

  // --- Priority 2: Gate score threshold check (above-floor items) ---
  if (gateScore >= inspectionThreshold) {
    return {
      gateScore,
      uncertainty,
      route: 'inspection_line',
      reasonCode: 'GATE_ABOVE_THRESHOLD',
      explanation:
        `Gate score ${gateScore.toFixed(3)} meets or exceeds inspection threshold ` +
        `${inspectionThreshold.toFixed(2)}. Item has sufficient uncertainty to warrant ` +
        `human verification before entering the material stream.`,
      safetyFloorTriggered: false,
    };
  }

  // --- Priority 3: Auto-route to class bay ---
  const route = classBayRoute(predictedClass);
  return {
    gateScore,
    uncertainty,
    route,
    reasonCode: 'AUTO_ROUTED_CLASS_BAY',
    explanation:
      `Gate score ${gateScore.toFixed(3)} is below inspection threshold ` +
      `${inspectionThreshold.toFixed(2)} and hazard probability ${(p * 100).toFixed(1)}% ` +
      `is below safety floor ${(safetyFloor * 100).toFixed(0)}%. ` +
      `Item auto-routed to ${route} for predicted class ${predictedClass}.`,
    safetyFloorTriggered: false,
  };
}

/** Map a material class to its target class bay route. */
function classBayRoute(cls: MaterialClass): RouteId {
  switch (cls) {
    case 'recyclable':    return 'recyclable_bay';
    case 'reusable':      return 'reusable_bay';
    case 'biodegradable': return 'biodegradable_bay';
    case 'hazardous':     return 'inspection_line'; // Class=hazardous but below floor → inspect
  }
}

/** Default gate policy values. These are labeled estimates, not measured facts.
 *  See ASSUMPTIONS in assumptions.ts for full rationale.
 *
 *  safetyFloor: 0.30 -- chosen so that items 4, 8-12 of the Simulated scenario
 *    (hazardProbability >= 0.30) are always blocked from compaction, while items
 *    1-3, 5-7 (hazardProbability <= 0.03) are not affected by the floor.
 *    The slider (inspectionThreshold) produces at least 3 distinct inspection
 *    loads across its range on the Simulated scenario.
 *    NOTE: Changed from Phase 1 default of 0.25. Both values block the same 6
 *    items in the Simulated scenario; 0.30 gives cleaner margin.
 */
export const DEFAULT_GATE_POLICY: GatePolicy = {
  safetyFloor: SAFETY_FLOOR,
  hazardConfidentCutoff: 0.75,
  inspectionThreshold: 0.50,
};
