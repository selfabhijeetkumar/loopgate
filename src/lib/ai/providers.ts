/**
 * src/lib/ai/providers.ts
 * Multi-provider LLM chain with automatic failover, 5-minute cooldown,
 * strict 6-second timeout per provider, and deterministic template fallback.
 *
 * Supported providers:
 * 1. Google Gemini (GEMINI_API_KEY, GEMINI_MODEL)
 * 2. Groq (GROQ_API_KEY, GROQ_MODEL)
 * 3. OpenRouter (OPENROUTER_API_KEY, OPENROUTER_MODEL)
 * 4. Generic OpenAI-Compatible (Dev only: AI_COMPAT_BASE_URL, AI_COMPAT_API_KEY, AI_COMPAT_MODEL)
 */

import type { EngineExplanationInput } from './explainTemplates';
import { getTemplateExplanation } from './explainTemplates';
import { validateGeneratedExplanation } from './numberValidator';

export interface ProviderResult {
  explanation: string;
  source: 'template' | 'ai';
  provider?: string;
  cached?: boolean;
  model?: string;
}

// In-memory 5-minute cooldown tracking
const providerCooldowns = new Map<string, number>();

export function isProviderCoolingDown(providerName: string): boolean {
  const cooldownUntil = providerCooldowns.get(providerName);
  if (!cooldownUntil) return false;
  if (Date.now() > cooldownUntil) {
    providerCooldowns.delete(providerName);
    return false;
  }
  return true;
}

export function setProviderCooldown(providerName: string, durationMs = 5 * 60 * 1000): void {
  providerCooldowns.set(providerName, Date.now() + durationMs);
}

export function resetProviderCooldowns(): void {
  providerCooldowns.clear();
}

/**
 * Builds the prompt instructions strictly bounding the model to engine data.
 */
function buildPrompt(input: EngineExplanationInput): string {
  const { item, decision, profile } = input;
  return `You are Loopgate's automated waste sorting explanation assistant.
Provide a concise, 2-to-3 sentence explanation of the sorting gate decision for the given item.

STRICT ACCURACY RULES:
1. ONLY quote or mention numbers present in the input JSON below. NEVER invent or hallucinate any number, percentage, or currency figure.
2. Adopt a tone suited to the requested user profile: "${profile}".
   - "household": clear, home waste segregation instructions, safety notes.
   - "hostel": common-area campus hostel bins, electronic drop stations.
   - "facility_operator": technical gate telemetry, diverter state, compactor protection.
3. Use "in this simulated scenario" phrasing. Never claim 100% fire prevention or real hardware measurements.
4. Output PLAIN TEXT ONLY. No markdown headers, no HTML tags, no emojis.

INPUT DATA:
${JSON.stringify({
  itemId: item.id,
  itemName: item.name,
  primaryClass: item.primaryClass,
  hazardProbability: Number(item.hazardProbability.toFixed(3)),
  hazardPercentage: Number((item.hazardProbability * 100).toFixed(1)),
  confidence: Number(item.confidence.toFixed(3)),
  confidencePercentage: Number((item.confidence * 100).toFixed(1)),
  gateScore: Number(decision.gateScore.toFixed(3)),
  gateThreshold: Number(decision.threshold.toFixed(2)),
  assignedRoute: decision.route,
  safetyFloorTriggered: decision.floorTriggered,
  profile,
}, null, 2)}`;
}

/**
 * Adapter 1: Google Gemini
 */
async function callGemini(input: EngineExplanationInput, timeoutMs = 6000): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = buildPrompt(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) throw new Error('No text returned from Gemini');

    return candidate.trim();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Adapter 2: OpenAI-compatible chat completions (Groq, OpenRouter, Generic)
 */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  input: EngineExplanationInput,
  timeoutMs = 6000
): Promise<string> {
  const prompt = buildPrompt(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://loopgate.vercel.app',
        'X-Title': 'Loopgate Waste Router',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`OpenAI-compatible provider error (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content returned from provider');

    return content.trim();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Execute multi-provider chain with failover and deterministic validator
 */
export async function generateExplanationWithChain(
  input: EngineExplanationInput
): Promise<ProviderResult> {
  const startTime = Date.now();
  const MAX_CHAIN_BUDGET_MS = 12000;

  // Build candidate provider chain based on configured keys
  interface ProviderCandidate {
    name: string;
    model: string;
    execute: () => Promise<string>;
  }

  const candidates: ProviderCandidate[] = [];

  // 1. Gemini
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    candidates.push({
      name: 'Google Gemini',
      model,
      execute: () => callGemini(input, 6000),
    });
  }

  // 2. Groq
  if (process.env.GROQ_API_KEY) {
    const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    candidates.push({
      name: 'Groq',
      model,
      execute: () =>
        callOpenAICompatible(
          'https://api.groq.com/openai/v1',
          process.env.GROQ_API_KEY!,
          model,
          input,
          6000
        ),
    });
  }

  // 3. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';
    candidates.push({
      name: 'OpenRouter',
      model,
      execute: () =>
        callOpenAICompatible(
          'https://openrouter.ai/api/v1',
          process.env.OPENROUTER_API_KEY!,
          model,
          input,
          6000
        ),
    });
  }

  // 4. Generic Localhost OpenAI Gateway (Dev only!)
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.AI_COMPAT_BASE_URL &&
    process.env.AI_COMPAT_API_KEY
  ) {
    const model = process.env.AI_COMPAT_MODEL || 'default';
    candidates.push({
      name: 'Generic Gateway',
      model,
      execute: () =>
        callOpenAICompatible(
          process.env.AI_COMPAT_BASE_URL!,
          process.env.AI_COMPAT_API_KEY!,
          model,
          input,
          6000
        ),
    });
  }

  // Iterate through available candidates
  for (const candidate of candidates) {
    // Check remaining total time budget
    if (Date.now() - startTime > MAX_CHAIN_BUDGET_MS) {
      break;
    }

    // Skip if cooling down
    if (isProviderCoolingDown(candidate.name)) {
      continue;
    }

    try {
      const rawText = await candidate.execute();

      // Deterministic Number Validation
      const validation = validateGeneratedExplanation(rawText, input);
      if (!validation.valid) {
        // Output invented numbers -> put on cooldown and failover
        setProviderCooldown(candidate.name);
        continue;
      }

      // Validated successfully
      return {
        explanation: rawText,
        source: 'ai',
        provider: candidate.name,
        model: candidate.model,
      };
    } catch {
      // Network/HTTP error or timeout -> cooldown and try next candidate
      setProviderCooldown(candidate.name);
    }
  }

  // Fallback: Deterministic Template Explanation
  return {
    explanation: getTemplateExplanation(input),
    source: 'template',
  };
}
