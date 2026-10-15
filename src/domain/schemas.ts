import { z } from 'zod';

export const MaterialClassSchema = z.enum([
  'recyclable',
  'reusable',
  'biodegradable',
  'hazardous',
]);

export const ProvenanceSchema = z.enum([
  'Observed',
  'Model-inferred',
  'Human-verified',
  'Configured',
  'Simulated',
  'Calculated',
  'AI-generated',
]);

export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const DetectionSchema = z.object({
  id: z.string().min(1),
  box: BoundingBoxSchema.nullable(),
  label: z.string().min(1),
  materialClass: MaterialClassSchema,
  hazardProbability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1),
  provenance: ProvenanceSchema,
});

export const RouteIdSchema = z.enum([
  'compactor',
  'inspection_line',
  'recyclable_bay',
  'reusable_bay',
  'biodegradable_bay',
  'hazard_hold',
]);

export const ItemStatusSchema = z.enum([
  'pending',
  'scanning',
  'diverted',
  'routed',
]);

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  barcode: z.string().optional(),
  detections: z.array(DetectionSchema),
  primaryClass: MaterialClassSchema,
  hazardProbability: z.number().min(0).max(1),
  overallConfidence: z.number().min(0).max(1),
  gateScore: z.number().min(0).max(1),
  status: ItemStatusSchema,
  assignedRoute: RouteIdSchema,
  provenance: ProvenanceSchema,
  createdAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  notes: z.string().optional(),
});

export const AssumptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  description: z.string().min(1),
  provenance: ProvenanceSchema,
});

export const EngineConfigSchema = z.object({
  threshold: z.number().min(0).max(1),
  safetyFloor: z.number().min(0).max(1),
  assumptions: z.array(AssumptionSchema),
});

export const SortingLineStageSchema = z.enum([
  'intake',
  'scanning',
  'uncertainty_gate',
  'diverting',
  'routed',
]);

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/)),
  itemId: z.string().min(1),
  stage: SortingLineStageSchema,
  action: z.enum([
    'auto_route',
    'divert_inspection',
    'operator_override',
    'quarantine_hazard',
    'gate_eval',
  ]),
  reason: z.string().min(1),
  actor: z.enum(['system', 'operator', 'uncertainty_gate']),
  provenance: ProvenanceSchema,
});

export const ReplayBranchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  threshold: z.number().min(0).max(1),
  safetyFloor: z.number().min(0).max(1),
  itemsRouted: z.number().int().nonnegative(),
  hazardDivertedCount: z.number().int().nonnegative(),
  escapeCount: z.number().int().nonnegative(),
  inspectionLoadPct: z.number().min(0).max(100),
  throughputPerMinute: z.number().nonnegative(),
  provenance: ProvenanceSchema,
});
