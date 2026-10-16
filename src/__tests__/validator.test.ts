/**
 * src/__tests__/validator.test.ts
 * Tests for Phase 8C extended validator rejection rules.
 */

import { describe, it, expect } from 'vitest';
import { validateGeneratedExplanation } from '@/lib/ai/numberValidator';
import type { EngineExplanationInput } from '@/lib/ai/explainTemplates';

const mockInput: EngineExplanationInput = {
  item: {
    id: 'ITEM-01',
    name: 'Lithium Battery',
    primaryClass: 'hazardous',
    hazardProbability: 0.94,
    confidence: 0.87,
  },
  decision: {
    route: 'hazard_hold',
    gateScore: 0.94,
    threshold: 0.30,
    floorTriggered: true,
  },
  profile: 'household',
};

describe('GenAI Explainer Extended Validator (Phase 8C)', () => {
  it('accepts compliant text with valid numbers and clean vocabulary', () => {
    const text =
      'In this simulated scenario, your Lithium Battery carries an estimated 94.0% hazard probability, which meets the 0.30 safety floor and diverts it to Hazard hold. Separately, its gate score of 0.94 exceeds the 0.30 inspection threshold. Please bring discarded batteries to an authorized community e-waste collection center.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
  });

  it('rejects hallucinated / invented numbers', () => {
    const text =
      'In this simulated scenario, the item has a 99.9% hazard rate and a gate score of 12.5.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Hallucinated numbers'))).toBe(true);
  });

  it('rejects forbidden word "prevent"', () => {
    const text =
      'In this simulated scenario, diverting this item helps prevent damage to facility equipment.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Forbidden word(s)'))).toBe(true);
  });

  it('rejects forbidden word "prevents"', () => {
    const text =
      'In this simulated scenario, the gate prevents downstream compactor jams.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Forbidden word(s)'))).toBe(true);
  });

  it('rejects forbidden phrase "fire risk"', () => {
    const text =
      'In this simulated scenario, this diversion mitigates fire risk on the sorting belt.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Forbidden word(s)'))).toBe(true);
  });

  it('rejects forbidden word "guarantee"', () => {
    const text =
      'In this simulated scenario, our algorithms guarantee complete safety.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Forbidden word(s)'))).toBe(true);
  });

  it('rejects snake_case programming identifiers like hazard_hold or inspection_line', () => {
    const text =
      'In this simulated scenario, the item is routed to the hazard_hold destination.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('Snake_case identifier(s)'))).toBe(true);
  });

  it('rejects camelCase programming identifiers like gateScore or hazardPercentage', () => {
    const text =
      'In this simulated scenario, the gateScore was evaluated at 0.94.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('CamelCase identifier(s)'))).toBe(true);
  });

  it('rejects comparing gate score with the safety floor in the same sentence', () => {
    const text =
      'In this simulated scenario, the gate score of 0.94 exceeded the safety floor.';
    const result = validateGeneratedExplanation(text, mockInput);
    expect(result.valid).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('safety floor'))).toBe(true);
  });
});
