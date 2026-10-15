/**
 * Pure Domain Contracts for Loopgate
 * Event: DSU Code Clash 2.0 (Problem Statement 06)
 * Strictly pure TypeScript definitions with zero UI imports.
 */

export type MaterialClass = 'recyclable' | 'reusable' | 'biodegradable' | 'hazardous';

export type Provenance =
  | 'Observed'
  | 'Model-inferred'
  | 'Human-verified'
  | 'Configured'
  | 'Simulated'
  | 'Calculated'
  | 'AI-generated';

export interface BoundingBox {
  /** Normalized coordinates [0.0 - 1.0] */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  box: BoundingBox | null;
  label: string;
  materialClass: MaterialClass;
  hazardProbability: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  source: string; // e.g. "detr-resnet-50", "clip-vit-base", "human-box", "synthetic"
  provenance: Provenance;
}

export type RouteId =
  | 'compactor'
  | 'inspection_line'
  | 'recyclable_bay'
  | 'reusable_bay'
  | 'biodegradable_bay'
  | 'hazard_hold';

export type ItemStatus = 'pending' | 'scanning' | 'diverted' | 'routed';

export interface Item {
  id: string;
  name: string;
  barcode?: string;
  detections: Detection[];
  primaryClass: MaterialClass;
  hazardProbability: number; // 0.0 to 1.0
  overallConfidence: number; // 0.0 to 1.0
  gateScore: number; // Computed uncertainty gate score [0.0 to 1.0]
  status: ItemStatus;
  assignedRoute: RouteId;
  provenance: Provenance;
  createdAt: string; // ISO 8601 timestamp
  notes?: string;
}

export interface Assumption {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  description: string;
  provenance: Provenance;
}

export interface EngineConfig {
  /** Operator adjustable threshold for diversion to inspection line [0.0 - 1.0] */
  threshold: number;
  /** Safety Floor: any item with hazardProbability >= safetyFloor cannot auto-route to compactor */
  safetyFloor: number;
  assumptions: Assumption[];
}

export type SortingLineStage =
  | 'intake'
  | 'scanning'
  | 'uncertainty_gate'
  | 'diverting'
  | 'routed';

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO 8601
  itemId: string;
  stage: SortingLineStage;
  action:
    | 'auto_route'
    | 'divert_inspection'
    | 'operator_override'
    | 'quarantine_hazard'
    | 'gate_eval';
  reason: string;
  actor: 'system' | 'operator' | 'uncertainty_gate';
  provenance: Provenance;
}

export interface ReplayBranch {
  id: string;
  label: string;
  threshold: number;
  safetyFloor: number;
  itemsRouted: number;
  hazardDivertedCount: number;
  escapeCount: number; // Hazardous items that incorrectly reached compactor
  inspectionLoadPct: number; // Percentage of items diverted to human review
  throughputPerMinute: number;
  provenance: Provenance;
}
