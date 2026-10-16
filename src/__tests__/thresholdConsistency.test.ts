import { describe, it, expect } from 'vitest';
import { getTemplateExplanation, EngineExplanationInput } from '@/lib/ai/explainTemplates';

describe('Threshold Consistency in Explanations', () => {
  it('strictly reflects the active UI threshold in the generated explanation', () => {
    const testThresholds = [0.28, 0.42, 0.55, 0.15];

    for (const threshold of testThresholds) {
      const input: EngineExplanationInput = {
        item: {
          id: 'item-01',
          name: 'PET Water Bottle',
          primaryClass: 'recyclable',
          hazardProbability: 0.02,
          confidence: 0.94,
        },
        decision: {
          route: 'recyclable_bay',
          gateScore: 0.12,
          threshold,
          floorTriggered: false,
        },
        profile: 'household',
      };

      const explanation = getTemplateExplanation(input);
      const threshStr = threshold.toFixed(2);
      expect(explanation).toContain(`${threshStr} inspection threshold`);
    }
  });

  it('uses 0.28 as standard default slider threshold', () => {
    const input: EngineExplanationInput = {
      item: {
        id: 'item-04',
        name: 'Swollen Lithium Battery',
        primaryClass: 'hazardous',
        hazardProbability: 0.94,
        confidence: 0.95,
      },
      decision: {
        route: 'hazard_hold',
        gateScore: 0.88,
        threshold: 0.28,
        floorTriggered: true,
      },
      profile: 'facility_operator',
    };

    const explanation = getTemplateExplanation(input);
    expect(explanation).toContain('0.28 inspection threshold');
    expect(explanation).not.toContain('0.55');
  });
});
