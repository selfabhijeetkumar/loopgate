/**
 * index.ts -- Loopgate Engine Public API
 *
 * Single barrel export for the engine module.
 * All imports from outside the engine should go through this file.
 */

// Gate evaluation
export { evaluateGate, DEFAULT_GATE_POLICY, HAZARD_WEIGHT, UNCERTAINTY_WEIGHT, HAZARD_CONFIDENT_DISAGREEMENT_CUTOFF, SAFETY_FLOOR } from './gate';
export type { GateInput, GatePolicy, GateDecision, ReasonCode } from './gate';

// Batch simulation
export { simulateBatch, BatchValidationError } from './sort';
export type {
  ItemDecision,
  TickEvent,
  RouteSummary,
  BatchMetrics,
  SimulationResult,
} from './sort';

// Digital twin timeline
export { buildTwinTimeline, buildTwinSnapshots } from './twin';
export type { TwinEvent, TwinSnapshot } from './twin';

// Branch comparison and threshold sweep
export { compareBranches, sweepThreshold, NO_GATE_POLICY, BatchValidationError as CompareError } from './compare';
export type { BranchSnapshot, BranchDeltas, CompareResult, SweepPoint } from './compare';

// Assumptions
export { ENGINE_ASSUMPTIONS, getAssumption, ASM } from './assumptions';
export type { EngineAssumption } from './assumptions';

// Quality auto-downgrade
export {
  createInitialQualityState,
  updateQualityState,
  AUTO_DOWNGRADE_FPS,
  AUTO_DOWNGRADE_WINDOW_MS,
} from './quality';
export type { QualityMode, QualityState, QualityStepResult } from './quality';
