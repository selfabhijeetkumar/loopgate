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

export interface ProviderDiagnostic {
  name: string;
  model: string;
  configured: boolean;
  attempted: boolean;
  result: 'ok' | 'rejected_by_validator' | 'timeout' | 'not_configured' | 'cooling_down' | 'not_attempted' | string;
}

export interface ProviderResult {
  explanation: string;
  source: 'template' | 'ai';
  provider?: string;
  cached?: boolean;
  model?: string;
  diagnostics?: ProviderDiagnostic[];
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

import { formatRouteLabel } from './explainTemplates';

function mapProfileLabel(p: string): string {
  switch (p) {
    case 'household':
      return 'Household resident';
    case 'hostel':
      return 'Campus hostel resident';
    case 'facility_operator':
      return 'Facility operator';
    default:
      return p;
  }
}

function mapClassLabel(c: string): string {
  switch (c) {
    case 'hazardous':
      return 'Hazardous material';
    case 'recyclable':
      return 'Recyclable material';
    case 'reusable':
      return 'Reusable material';
    case 'biodegradable':
      return 'Biodegradable material';
    default:
      return c;
  }
}

/**
 * Builds the prompt instructions strictly bounding the model to engine data.
 * All route names and keys are human-readable, with zero programming identifiers.
 */
function buildPrompt(input: EngineExplanationInput): string {
  const { item, decision, profile } = input;
  const hazPct = Number((item.hazardProbability * 100).toFixed(1));
  const confPct = Number((item.confidence * 100).toFixed(1));
  const gateScoreVal = Number(decision.gateScore.toFixed(3));
  const threshVal = Number(decision.threshold.toFixed(2));
  const routeName = formatRouteLabel(decision.route);

  return `You are Loopgate's explanatory assistant for simulated materials recovery.
Explain the automated routing decision for the item in exactly 2 to 3 plain sentences.

CRITICAL POLICY & LANGUAGE RULES:
1. Always begin or frame with "In this simulated scenario". Never claim real-world physical outcomes, fire prevention, or warranties.
2. FORBIDDEN WORDS: NEVER use the words "prevent", "prevents", "fire risk", "guarantee".
3. NO PROGRAMMING IDENTIFIERS: NEVER use camelCase words, snake_case words, code variables, or raw field names (for example, never write gateScore, hazard_hold, hazardPercentage, primaryClass, etc.). Use human terms only: "Hazard hold", "Inspection bay", "Recyclable bin", "Reusable bin", "Biodegradable bin".
4. ACCURATE POLICY EXPLANATION:
   - The safety floor is a hard limit comparing the item's estimated hazard probability with 0.30.
   - The gate score is a separate value compared with the inspection threshold.
   - NEVER compare gate score with the safety floor, and never say gate score triggered the safety floor.
5. NUMBERS: Quote ONLY the exact numbers provided in the input data below (or their exact decimal equivalents). Never invent or hallucinate any numbers.
6. PROFILE-SPECIFIC ADVICE:
   - Household: guidance for home segregation and local e-waste drop-off.
   - Campus Hostel: guidance for hostel floor sorting and campus reception drop-off.
   - Facility Operator: operational state of the diverter and stream management.
7. Return PLAIN TEXT only. Exactly 2 to 3 plain sentences.

INPUT DATA:
${JSON.stringify({
  "Item": item.name,
  "Material Class": mapClassLabel(item.primaryClass),
  "Estimated Hazard Probability": hazPct,
  "Detector Confidence": confPct,
  "Gate Score": gateScoreVal,
  "Inspection Threshold": threshVal,
  "Safety Floor Limit": 0.30,
  "Safety Floor Activated": decision.floorTriggered ? "Yes" : "No",
  "Assigned Route": routeName,
  "Target Profile": mapProfileLabel(profile),
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
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://loopgate-rose.vercel.app',
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

  // Safe Diagnostics tracking (names and models only, ZERO keys logged or returned)
  const diagnostics: ProviderDiagnostic[] = [
    {
      name: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
      configured: Boolean(process.env.GEMINI_API_KEY),
      attempted: false,
      result: process.env.GEMINI_API_KEY ? 'not_attempted' : 'not_configured',
    },
    {
      name: 'Groq',
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
      configured: Boolean(process.env.GROQ_API_KEY),
      attempted: false,
      result: process.env.GROQ_API_KEY ? 'not_attempted' : 'not_configured',
    },
    {
      name: 'OpenRouter',
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      attempted: false,
      result: process.env.OPENROUTER_API_KEY ? 'not_attempted' : 'not_configured',
    },
  ];

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
    const diag = diagnostics.find((d) => d.name === candidate.name);

    // Check remaining total time budget
    if (Date.now() - startTime > MAX_CHAIN_BUDGET_MS) {
      if (diag && !diag.attempted) diag.result = 'timeout';
      break;
    }

    // Skip if cooling down
    if (isProviderCoolingDown(candidate.name)) {
      if (diag) diag.result = 'cooling_down';
      continue;
    }

    if (diag) diag.attempted = true;

    try {
      const rawText = await candidate.execute();

      // Deterministic Number Validation
      const validation = validateGeneratedExplanation(rawText, input);
      if (!validation.valid) {
        if (diag) diag.result = 'rejected_by_validator';
        setProviderCooldown(candidate.name);
        continue;
      }

      if (diag) diag.result = 'ok';
      console.log('[Loopgate Explainer Diagnostics]', JSON.stringify(diagnostics));

      // Validated successfully
      return {
        explanation: rawText,
        source: 'ai',
        provider: candidate.name,
        model: candidate.model,
        diagnostics,
      };
    } catch (err: unknown) {
      if (diag) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('timeout') || errorMsg.includes('abort')) {
          diag.result = 'timeout';
        } else {
          const statusMatch = errorMsg.match(/HTTP (\d+)/i) || errorMsg.match(/(\d{3})/);
          diag.result = statusMatch ? `http_${statusMatch[1]}` : 'error';
        }
      }
      // Network/HTTP error or timeout -> cooldown and try next candidate
      setProviderCooldown(candidate.name);
    }
  }

  console.log('[Loopgate Explainer Diagnostics]', JSON.stringify(diagnostics));

  // Fallback: Deterministic Template Explanation
  return {
    explanation: getTemplateExplanation(input),
    source: 'template',
    diagnostics,
  };
}
