import { describe, it, expect } from 'vitest';
import {
  getTemplateExplanation,
  getBatchSummaryExplanation,
  UserProfile,
  EngineExplanationInput,
} from '@/lib/ai/explainTemplates';

const FORBIDDEN_WORDS = [
  'pneumatic',
  'actuated',
  'actuator',
  'hydraulic',
  'sensor array',
  'mechanical',
  'physical line',
];

const INVENTED_HOSTEL_WORDS = [
  'hall reception',
  'floor chutes',
  'common room',
  'drop boxes',
  'corridor recycling',
  'exchange racks',
  'dining hall wet waste',
];

const PROFILES: UserProfile[] = ['household', 'hostel', 'facility_operator'];

describe('Explain Templates Hardware Claims & Invented Details Check', () => {
  it('should not contain any forbidden hardware claims in any of the 12 profile templates', () => {
    const classes: ('recyclable' | 'reusable' | 'biodegradable' | 'hazardous')[] = [
      'hazardous',
      'recyclable',
      'reusable',
      'biodegradable',
    ];

    for (const primaryClass of classes) {
      for (const profile of PROFILES) {
        const input: EngineExplanationInput = {
          item: {
            id: 'item-test',
            name: 'Test Waste Item',
            primaryClass,
            hazardProbability: primaryClass === 'hazardous' ? 0.85 : 0.05,
            confidence: 0.95,
          },
          decision: {
            route: primaryClass === 'hazardous' ? 'hazard_hold' : `${primaryClass}_bay`,
            gateScore: primaryClass === 'hazardous' ? 0.75 : 0.12,
            threshold: 0.28,
            floorTriggered: primaryClass === 'hazardous',
          },
          profile,
        };

        const output = getTemplateExplanation(input);

        // Check for forbidden hardware words
        for (const word of FORBIDDEN_WORDS) {
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          expect(
            regex.test(output),
            `Found forbidden hardware word "${word}" in template for [${primaryClass}, ${profile}]: "${output}"`
          ).toBe(false);
        }

        // Check for invented hostel details
        if (profile === 'hostel') {
          for (const invented of INVENTED_HOSTEL_WORDS) {
            expect(
              output.toLowerCase().includes(invented.toLowerCase()),
              `Found invented hostel detail "${invented}" in: "${output}"`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('should not contain any forbidden hardware claims in batch summaries for all profiles', () => {
    for (const profile of PROFILES) {
      const summary = getBatchSummaryExplanation(10, 3, 30.0, profile);
      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        expect(
          regex.test(summary),
          `Found forbidden hardware word "${word}" in batch summary for [${profile}]: "${summary}"`
        ).toBe(false);
      }
    }
  });
});
