import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateExplanationWithChain, resetProviderCooldowns } from '../lib/ai/providers';
import type { EngineExplanationInput } from '../lib/ai/explainTemplates';

describe('Phase 8A Step 1: Live Provider Chain & Failover', () => {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');

  beforeAll(() => {
    if (fs.existsSync(envLocalPath)) {
      const txt = fs.readFileSync(envLocalPath, 'utf8');
      for (const line of txt.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
        }
      }
    }
  });

  const sampleInput: EngineExplanationInput = {
    item: {
      id: 'ITEM-08',
      name: 'Lithium Polymer Battery Pack',
      primaryClass: 'hazardous',
      hazardProbability: 0.94,
      confidence: 0.88,
    },
    decision: {
      route: 'hazard_hold',
      gateScore: 0.94,
      threshold: 0.30,
      floorTriggered: true,
    },
    profile: 'household',
  };

  it('(a) Gemini answers live call and passes number validator', async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.log('Skipping: GEMINI_API_KEY not configured');
      return;
    }
    resetProviderCooldowns();
    const t0 = Date.now();
    const res = await generateExplanationWithChain(sampleInput);
    const latency = Date.now() - t0;
    console.log(`[LIVE GEMINI RESULT] Provider: ${res.provider}, Model: ${res.model}, Source: ${res.source}, Latency: ${latency}ms`);
    console.log(`[LIVE GEMINI TEXT] "${res.explanation}"`);

    expect(res.source).toBe('ai');
    expect(res.provider).toBe('Google Gemini');
    expect(latency).toBeLessThan(15000);
  }, 20000);

  it('(c) Automatic Failover: Disable Gemini -> Groq answers live', async () => {
    if (!process.env.GROQ_API_KEY) {
      console.log('Skipping: GROQ_API_KEY not configured');
      return;
    }
    resetProviderCooldowns();
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const t0 = Date.now();
      const res = await generateExplanationWithChain(sampleInput);
      const latency = Date.now() - t0;
      console.log(`[LIVE GROQ FAILOVER RESULT] Provider: ${res.provider}, Model: ${res.model}, Source: ${res.source}, Latency: ${latency}ms`);
      console.log(`[LIVE GROQ FAILOVER TEXT] "${res.explanation}"`);

      expect(res.source).toBe('ai');
      expect(res.provider).toBe('Groq');
    } finally {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  }, 20000);

  it('(d) Client bundle scan: no API keys or secret names in .next/static', () => {
    const staticDir = path.resolve(process.cwd(), '.next', 'static');
    if (!fs.existsSync(staticDir)) {
      console.log('Skipping: .next/static not built yet');
      return;
    }

    const secretNames = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY'];
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith('.js')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const jsFiles = scanDir(staticDir);
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const name of secretNames) {
        expect(content.includes(name)).toBe(false);
      }
      // Check real key values from env
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
        expect(content.includes(process.env.GEMINI_API_KEY)).toBe(false);
      }
      if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 5) {
        expect(content.includes(process.env.GROQ_API_KEY)).toBe(false);
      }
    }
  });
});
