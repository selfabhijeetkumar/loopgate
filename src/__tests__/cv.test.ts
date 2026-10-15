/**
 * src/__tests__/cv.test.ts
 * Unit tests for the CV pipeline: NMS, toItems mapping, and Gemini "raise-only" rule.
 */

import { describe, it, expect } from 'vitest';
import { calculateIoU, nonMaxSuppression } from '@/cv/nms';
import {
  mapDetectionToItem,
  mapDetectionsToItems,
  calculateModelDisagreement,
  DETECTOR_LABEL_CLASS_MAP,
} from '@/cv/toItems';
import type { NormalizedDetection, RawDetectorResult } from '@/cv/types';
import { SAFETY_FLOOR } from '@/engine/gate';

describe('CV Pipeline: Non-Maximum Suppression (NMS)', () => {
  it('computes IoU correctly for identical, disjoint, and intersecting boxes', () => {
    const boxA = { xmin: 0, ymin: 0, xmax: 10, ymax: 10 };
    const boxIdentical = { xmin: 0, ymin: 0, xmax: 10, ymax: 10 };
    const boxDisjoint = { xmin: 20, ymin: 20, xmax: 30, ymax: 30 };
    const boxHalf = { xmin: 0, ymin: 0, xmax: 10, ymax: 5 }; // area 50 vs 100, intersection 50, union 100 -> 0.5

    expect(calculateIoU(boxA, boxIdentical)).toBe(1.0);
    expect(calculateIoU(boxA, boxDisjoint)).toBe(0.0);
    expect(calculateIoU(boxA, boxHalf)).toBe(0.5);
  });

  it('suppresses lower-scoring overlapping boxes above IoU threshold', () => {
    const proposals: RawDetectorResult[] = [
      { score: 0.85, label: 'bottle', box: { xmin: 10, ymin: 10, xmax: 100, ymax: 200 } },
      { score: 0.70, label: 'bottle', box: { xmin: 12, ymin: 12, xmax: 98, ymax: 198 } }, // heavy overlap with 0.85
      { score: 0.90, label: 'can', box: { xmin: 300, ymin: 100, xmax: 400, ymax: 250 } }, // distinct
      { score: 0.05, label: 'noise', box: { xmin: 50, ymin: 50, xmax: 80, ymax: 80 } }, // below score threshold
    ];

    const result = nonMaxSuppression(proposals, 0.45, 0.12);

    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(0.90);
    expect(result[0].label).toBe('can');
    expect(result[1].score).toBe(0.85);
    expect(result[1].label).toBe('bottle');
  });
});

describe('CV Pipeline: toItems Mapping', () => {
  const mockDetection: NormalizedDetection = {
    id: 'det-01',
    label: 'bottle',
    score: 0.92,
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    clipProbabilities: {
      recyclable: 0.85,
      reusable: 0.05,
      biodegradable: 0.05,
      hazardous: 0.05,
      batteryRisk: 0.0,
    },
    provenance: 'Model-inferred',
  };

  it('maps detection into valid domain Item conforming to contracts', () => {
    const item = mapDetectionToItem(mockDetection, 0);

    expect(item.id).toBe('det-01');
    expect(item.name).toBe('Bottle');
    expect(item.primaryClass).toBe('recyclable');
    expect(item.overallConfidence).toBe(0.85);
    expect(item.hazardProbability).toBe(0.05);
    expect(item.provenance).toBe('Model-inferred');
    expect(item.detections).toHaveLength(2);
    expect(item.detections[0].source).toBe('owlvit-base-patch32');
    expect(item.detections[1].source).toBe('clip-vit-base-patch32');
  });

  it('calculates summed hazard probability including battery risk', () => {
    const batteryDetection: NormalizedDetection = {
      id: 'det-02',
      label: 'power bank',
      score: 0.88,
      box: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
      clipProbabilities: {
        recyclable: 0.10,
        reusable: 0.05,
        biodegradable: 0.05,
        hazardous: 0.45,
        batteryRisk: 0.40,
      },
      provenance: 'Model-inferred',
    };

    const item = mapDetectionToItem(batteryDetection, 1);

    expect(item.primaryClass).toBe('hazardous');
    // raw hazard = 0.45 + 0.40 * 0.45 = 0.63
    expect(item.hazardProbability).toBeCloseTo(0.63, 2);
    expect(item.hazardProbability).toBeGreaterThanOrEqual(SAFETY_FLOOR);
    // Should route to hazard hold or inspection line (never compactor)
    expect(['hazard_hold', 'inspection_line']).toContain(item.assignedRoute);
  });

  it('calculates higher model disagreement when detector and CLIP diverge', () => {
    // Detector says "bottle" (expected recyclable), but CLIP says "hazardous"
    const highDisagreement = calculateModelDisagreement('bottle', 0.90, 'hazardous', 0.85);
    // Detector says "bottle", CLIP says "recyclable"
    const lowDisagreement = calculateModelDisagreement('bottle', 0.90, 'recyclable', 0.85);

    expect(highDisagreement).toBeGreaterThan(0.35);
    expect(lowDisagreement).toBeLessThan(0.10);
  });

  it('supports Human-verified provenance override', () => {
    const item = mapDetectionToItem(mockDetection, 0, { provenance: 'Human-verified' });
    expect(item.provenance).toBe('Human-verified');
    expect(item.detections[0].provenance).toBe('Human-verified');
  });

  it('guarantees safety floor when detector labels item hazardous but crop classifier reports low hazard', () => {
    // Detector identified a power bank, but CLIP confused the crop with recyclable material (5% hazard)
    const ambiguousPowerBank: NormalizedDetection = {
      id: 'det-ambiguous-pb',
      label: 'power bank',
      score: 0.84,
      box: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
      clipProbabilities: {
        recyclable: 0.85,
        reusable: 0.05,
        biodegradable: 0.05,
        hazardous: 0.05,
        batteryRisk: 0.0,
      },
      provenance: 'Model-inferred',
    };

    const item = mapDetectionToItem(ambiguousPowerBank, 2);

    // Hazard probability must NOT stay at 0.05 -- safety floor enforces minimum 0.30
    expect(item.hazardProbability).toBe(SAFETY_FLOOR);
    expect(item.modelDisagreement).toBeGreaterThan(0.35); // Cross-modal conflict
    expect(item.assignedRoute).toBe('inspection_line'); // Diverted from compactor
  });
});

describe('CV Pipeline: Gemini "Raise Only" Rule', () => {
  const baseDetection: NormalizedDetection = {
    id: 'det-gem-01',
    label: 'vape pen',
    score: 0.80,
    box: { x: 0.2, y: 0.2, width: 0.1, height: 0.3 },
    clipProbabilities: {
      recyclable: 0.10,
      reusable: 0.10,
      biodegradable: 0.10,
      hazardous: 0.35, // base hazard 0.35
      batteryRisk: 0.0,
    },
    provenance: 'Model-inferred',
  };

  it('RAISES hazard probability when Gemini suggests higher risk', () => {
    const itemRaised = mapDetectionToItem(baseDetection, 0, {
      geminiHazardEstimate: 0.65, // Gemini is higher
    });

    expect(itemRaised.hazardProbability).toBe(0.65);
    expect(itemRaised.hazardProbability).toBeGreaterThan(0.35);
  });

  it('NEVER LOWERS hazard probability when Gemini suggests lower risk', () => {
    const itemNotLowered = mapDetectionToItem(baseDetection, 0, {
      geminiHazardEstimate: 0.10, // Gemini is lower than 0.35
    });

    // Invariant: Gemini may only raise caution, never lower it!
    expect(itemNotLowered.hazardProbability).toBe(0.35);
  });

  it('never overrides the safety floor downward', () => {
    const floorItem: NormalizedDetection = {
      id: 'det-floor-01',
      label: 'battery',
      score: 0.95,
      box: { x: 0, y: 0, width: 0.2, height: 0.2 },
      clipProbabilities: {
        recyclable: 0.0,
        reusable: 0.0,
        biodegradable: 0.0,
        hazardous: 0.55,
        batteryRisk: 0.5,
      },
      provenance: 'Model-inferred',
    };

    const item = mapDetectionToItem(floorItem, 0, {
      geminiHazardEstimate: 0.05, // Attempting to lower
    });

    expect(item.hazardProbability).toBeGreaterThanOrEqual(SAFETY_FLOOR);
    expect(item.assignedRoute).not.toBe('compactor');
  });
});
