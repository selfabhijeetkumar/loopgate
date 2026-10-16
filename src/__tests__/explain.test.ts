/**
 * src/__tests__/explain.test.ts
 * Unit and integration tests for GenAI explanation chain, number validator,
 * 12 deterministic templates, failover order, cooldown, and security.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTemplateExplanation,
  getBatchSummaryExplanation,
  type EngineExplanationInput,
  type UserProfile,
} from '@/lib/ai/explainTemplates';
import { validateGeneratedExplanation } from '@/lib/ai/numberValidator';
import {
  generateExplanationWithChain,
  setProviderCooldown,
  isProviderCoolingDown,
  resetProviderCooldowns,
} from '@/lib/ai/providers';

describe('Deterministic Explanation Templates (12 Combinations)', () => {
  const classes: Array<EngineExplanationInput['item']['primaryClass']> = [
    'hazardous',
    'recyclable',
    'reusable',
    'biodegradable',
  ];
  const profiles: UserProfile[] = ['household', 'hostel', 'facility_operator'];

  classes.forEach((primaryClass) => {
    profiles.forEach((profile) => {
      it(`renders template correctly for class=${primaryClass} and profile=${profile}`, () => {
        const input: EngineExplanationInput = {
          item: {
            id: 'ITEM-01',
            name: 'Test Material Object',
            primaryClass,
            hazardProbability: primaryClass === 'hazardous' ? 0.85 : 0.05,
            confidence: 0.92,
          },
          decision: {
            route: primaryClass === 'hazardous' ? 'hazard_hold' : 'recyclable_bay',
            gateScore: primaryClass === 'hazardous' ? 0.85 : 0.05,
            threshold: 0.30,
            floorTriggered: primaryClass === 'hazardous',
          },
          profile,
        };

        const explanation = getTemplateExplanation(input);
        expect(explanation).toBeTruthy();
        expect(explanation.length).toBeGreaterThan(40);

        // Verify all numbers in the template come from the input
        const validation = validateGeneratedExplanation(explanation, input);
        expect(validation.valid).toBe(true);
      });
    });
  });

  it('renders batch summary template for all 3 profiles without hallucinated numbers', () => {
    profiles.forEach((profile) => {
      const summary = getBatchSummaryExplanation(10, 2, 80.0, profile);
      expect(summary).toContain('10');
      expect(summary).toContain('2');
      expect(summary).toContain('80.0');
    });
  });
});

describe('Deterministic Number Validator', () => {
  const sampleInput: EngineExplanationInput = {
    item: {
      id: 'ITEM-08',
      name: 'Vape Pen with Lithium Cell',
      primaryClass: 'hazardous',
      hazardProbability: 0.942,
      confidence: 0.88,
    },
    decision: {
      route: 'hazard_hold',
      gateScore: 0.942,
      threshold: 0.30,
      floorTriggered: true,
    },
    profile: 'household',
  };

  it('accepts text where all numbers match engine input values', () => {
    const validText =
      'ITEM-08 carries a 94.2% hazard probability and was scored at 0.942 exceeding the 0.30 threshold.';
    const result = validateGeneratedExplanation(validText, sampleInput);
    expect(result.valid).toBe(true);
    expect(result.rejectedNumbers).toHaveLength(0);
  });

  it('rejects text containing invented / hallucinated numbers', () => {
    // 99% accuracy or $45000 repair cost are not in the input!
    const hallucinatedText =
      'ITEM-08 has 94.2% hazard probability and Loopgate prevents 99% of fires saving 45000 dollars.';
    const result = validateGeneratedExplanation(hallucinatedText, sampleInput);
    expect(result.valid).toBe(false);
    expect(result.rejectedNumbers).toContain(99);
    expect(result.rejectedNumbers).toContain(45000);
  });
});

describe('Provider Chain Failover & Cooldown', () => {
  const sampleInput: EngineExplanationInput = {
    item: {
      id: 'ITEM-04',
      name: 'Coated Beverage Cup',
      primaryClass: 'recyclable',
      hazardProbability: 0.12,
      confidence: 0.75,
    },
    decision: {
      route: 'recyclable_bay',
      gateScore: 0.12,
      threshold: 0.30,
      floorTriggered: false,
    },
    profile: 'hostel',
  };

  const originalEnv = process.env;

  beforeEach(() => {
    resetProviderCooldowns();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns template explanation when zero provider keys are configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.AI_COMPAT_BASE_URL;

    const res = await generateExplanationWithChain(sampleInput);
    expect(res.source).toBe('template');
    expect(res.explanation).toBeTruthy();
  });

  it('skips a provider that is currently on 5-minute cooldown', () => {
    setProviderCooldown('Groq');
    expect(isProviderCoolingDown('Groq')).toBe(true);
    expect(isProviderCoolingDown('Google Gemini')).toBe(false);
  });

  it('fails over to Groq if Gemini fails with HTTP 429', async () => {
    process.env.GEMINI_API_KEY = 'mock_gemini_key';
    process.env.GROQ_API_KEY = 'mock_groq_key';

    // Mock fetch to simulate Gemini 429 then Groq 200
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('googleapis.com')) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        });
      }
      if (url.includes('groq.com')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content:
                      'ITEM-04 has 12% estimated hazard probability in this simulated scenario and was routed safely.',
                  },
                },
              ],
            }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const res = await generateExplanationWithChain(sampleInput);

    expect(res.source).toBe('ai');
    expect(res.provider).toBe('Groq');
    expect(isProviderCoolingDown('Google Gemini')).toBe(true);
  });

  it('falls back to template if provider output fails number validation', async () => {
    process.env.GEMINI_API_KEY = 'mock_gemini_key';
    delete process.env.GROQ_API_KEY;

    // Gemini returns invented number 99.9%
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: 'This item has 99.9% probability and stops 50000 fires.' }],
              },
            },
          ],
        }),
    });

    const res = await generateExplanationWithChain(sampleInput);

    // Rejected by number validator, falls back to template
    expect(res.source).toBe('template');
    expect(isProviderCoolingDown('Google Gemini')).toBe(true);
  });

  it('disables generic localhost provider when NODE_ENV is production', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.AI_COMPAT_BASE_URL = 'http://localhost:20128/v1';
    process.env.AI_COMPAT_API_KEY = 'mock_key';

    const res = await generateExplanationWithChain(sampleInput);
    // Generic provider must NOT run in production, falling directly to template
    expect(res.source).toBe('template');
  });
});
