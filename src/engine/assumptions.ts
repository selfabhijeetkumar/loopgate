/**
 * assumptions.ts -- Loopgate Engine Assumptions
 *
 * All assumption values are labeled estimates. They are NOT measured operational facts.
 * Each assumption carries provenance "Configured" to signal its origin.
 *
 * These values feed the metrics engine and the audit trail.
 * They are designed to be operator-adjustable in future phases.
 *
 * Pure TypeScript. Zero UI or network imports.
 */

import type { Assumption } from '../domain/types';

/** A fully typed engine assumption with a numeric value. */
export interface EngineAssumption extends Assumption {
  value: number;
}

/** All assumptions exported as a typed list for display and calculation. */
export const ENGINE_ASSUMPTIONS: EngineAssumption[] = [
  {
    id: 'ea-01',
    label: 'Safety Floor',
    value: 0.30,
    unit: 'ratio',
    description:
      'Hard safety floor: any item with estimated hazard probability >= safetyFloor ' +
      'is barred from automatic compaction. Changed from Phase 1 default 0.25 to give ' +
      'cleaner margin. Both values block the same 6 items in the Simulated scenario.',
    provenance: 'Configured',
  },
  {
    id: 'ea-02',
    label: 'Hazard Confident Cutoff',
    value: 0.75,
    unit: 'ratio',
    description:
      'Minimum classification confidence required to route a floor-triggered item ' +
      'directly to hazard_hold. Below this cutoff, the item goes to inspection_line ' +
      'for human verification first.',
    provenance: 'Configured',
  },
  {
    id: 'ea-03',
    label: 'Inspection Threshold (tau)',
    value: 0.50,
    unit: 'ratio',
    description:
      'Gate score above which a below-floor item is diverted to the inspection line. ' +
      'Operator adjustable from 0 to 1. Lower values increase inspection load. ' +
      'Produces at least 3 distinct inspection loads across its range on the Simulated scenario.',
    provenance: 'Configured',
  },
  {
    id: 'ea-04',
    label: 'Compaction Ignition Factor',
    value: 0.72,
    unit: 'ratio',
    description:
      'Estimated probability that a hazardous item reaching the compactor results in ' +
      'a thermal event (fire, explosion, or chemical release). Derived from recycling ' +
      'industry incident data analogues. Labeled estimate only.',
    provenance: 'Configured',
  },
  {
    id: 'ea-05',
    label: 'Inspection Accuracy',
    value: 0.92,
    unit: 'ratio',
    description:
      'Estimated probability that a human inspector correctly identifies and quarantines ' +
      'a genuinely hazardous item during manual inspection. Residual risk = ' +
      'hazardProbability * (1 - inspectionAccuracy).',
    provenance: 'Configured',
  },
  {
    id: 'ea-06',
    label: 'Inspection Capacity',
    value: 8,
    unit: 'items/minute',
    description:
      'Maximum rate at which a single inspector can evaluate and re-route diverted items. ' +
      'When inspection load exceeds this rate, a backlog forms causing throughput reduction.',
    provenance: 'Configured',
  },
  {
    id: 'ea-07',
    label: 'Line Throughput',
    value: 20,
    unit: 'items/minute',
    description:
      'Nominal maximum throughput of the sorting line before inspection backlog penalties. ' +
      'Actual throughput is reduced when inspection_load > inspectionCapacityPerMinute.',
    provenance: 'Configured',
  },
  {
    id: 'ea-08',
    label: 'Simulated Incident Cost',
    value: 45000,
    unit: 'USD/incident',
    description:
      'Estimated direct cost (mechanical damage, downtime, emergency response) per ' +
      'compactor battery thermal event in this simulated scenario. Labeled estimate; not an actuarial figure.',
    provenance: 'Configured',
  },
  {
    id: 'ea-09',
    label: 'Manual Inspection Cost',
    value: 0.85,
    unit: 'USD/item',
    description:
      'Estimated labor cost per item for operator manual verification on the ' +
      'diverted inspection line.',
    provenance: 'Configured',
  },
];

/** Look up a single assumption by id. Throws if not found. */
export function getAssumption(id: string): EngineAssumption {
  const asm = ENGINE_ASSUMPTIONS.find((a) => a.id === id);
  if (!asm) throw new Error(`Assumption ${id} not found`);
  return asm;
}

/** Convenience accessors for the values used in metric calculations. */
export const ASM = {
  safetyFloor:                ENGINE_ASSUMPTIONS[0].value,
  hazardConfidentCutoff:      ENGINE_ASSUMPTIONS[1].value,
  inspectionThreshold:        ENGINE_ASSUMPTIONS[2].value,
  compactionIgnitionFactor:   ENGINE_ASSUMPTIONS[3].value,
  inspectionAccuracy:         ENGINE_ASSUMPTIONS[4].value,
  inspectionCapacityPerMinute:ENGINE_ASSUMPTIONS[5].value,
  lineThroughputPerMinute:    ENGINE_ASSUMPTIONS[6].value,
} as const;
