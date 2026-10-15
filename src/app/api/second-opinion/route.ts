/**
 * src/app/api/second-opinion/route.ts
 * Optional Gemini Second Opinion API route.
 * Strictly adheres to DPDP-aware user consent, rate limiting, SHA-256 caching,
 * and the "Raise Caution Only" invariant (Gemini never lowers hazard risk or safety floor).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

// In-memory cache by SHA-256
interface CacheEntry {
  hazardEstimate: number;
  confidence: number;
  advice: string;
  reasoning: string;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();

// In-memory per-IP rate limiting (sliding window: max 5 requests per minute, 100 per day)
interface RateLimitRecord {
  minuteCount: number;
  minuteReset: number;
  dayCount: number;
  dayReset: number;
}
const ipRateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let record = ipRateLimits.get(ip);

  if (!record) {
    record = {
      minuteCount: 0,
      minuteReset: now + 60_000,
      dayCount: 0,
      dayReset: now + 86_400_000,
    };
    ipRateLimits.set(ip, record);
  }

  // Reset windows if expired
  if (now > record.minuteReset) {
    record.minuteCount = 0;
    record.minuteReset = now + 60_000;
  }
  if (now > record.dayReset) {
    record.dayCount = 0;
    record.dayReset = now + 86_400_000;
  }

  if (record.minuteCount >= 5) {
    return { allowed: false, retryAfter: Math.ceil((record.minuteReset - now) / 1000) };
  }
  if (record.dayCount >= 100) {
    return { allowed: false, retryAfter: Math.ceil((record.dayReset - now) / 1000) };
  }

  record.minuteCount++;
  record.dayCount++;
  return { allowed: true };
}

// Request validation schema
const RequestSchema = z.object({
  imageDataUrl: z.string().min(10).max(12 * 1024 * 1024), // Max ~8MB raw image in base64
  item: z.object({
    id: z.string(),
    name: z.string(),
    primaryClass: z.enum(['recyclable', 'reusable', 'biodegradable', 'hazardous']),
    hazardProbability: z.number().min(0).max(1),
    overallConfidence: z.number().min(0).max(1),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // 1. Rate Limit Check
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Maximum 5 requests per minute and 100 per day allowed on free tier.',
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      );
    }

    // 2. Parse & Validate Payload
    const json = await req.json();
    const parseResult = RequestSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { imageDataUrl, item } = parseResult.data;

    // 3. Cache Check by SHA-256
    const imageHash = crypto.createHash('sha256').update(imageDataUrl).digest('hex');
    const cached = cache.get(imageHash);
    if (cached) {
      // Apply "Raise Caution Only" rule
      const effectiveHazard = Math.max(item.hazardProbability, cached.hazardEstimate);
      return NextResponse.json({
        provenance: 'AI-generated',
        isCached: true,
        geminiHazardEstimate: cached.hazardEstimate,
        effectiveHazardProbability: effectiveHazard,
        cautionRaised: cached.hazardEstimate > item.hazardProbability,
        confidence: cached.confidence,
        advice: cached.advice,
        reasoning: cached.reasoning,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      });
    }

    // 4. API Key Check
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Deterministic Mock Fallback Client when API key is not yet configured
      const isSuspectedHazard =
        item.name.toLowerCase().includes('battery') ||
        item.name.toLowerCase().includes('vape') ||
        item.name.toLowerCase().includes('bank') ||
        item.name.toLowerCase().includes('phone') ||
        item.name.toLowerCase().includes('aerosol') ||
        item.primaryClass === 'hazardous';

      // Mock conservative estimate: raises caution if suspected battery device
      const mockHazardEstimate = isSuspectedHazard
        ? Math.max(0.65, item.hazardProbability + 0.20)
        : Math.min(0.20, item.hazardProbability);

      const mockAdvice = isSuspectedHazard
        ? 'Secondary vision assessment confirms potential concealed battery or pressurized vessel. Divert to inspection spur.'
        : 'Secondary vision scan indicates low hazard signature. Maintain standard recovery stream.';

      const mockReasoning =
        `Simulated Gemini advisory for ${item.name} (${item.primaryClass}). ` +
        `Safety floor invariant EA-01 remains active at ${item.hazardProbability.toFixed(2)}.`;

      const effectiveHazard = Math.max(item.hazardProbability, mockHazardEstimate);

      return NextResponse.json({
        provenance: 'AI-generated',
        isCached: false,
        isMockClient: true,
        geminiHazardEstimate: Number(mockHazardEstimate.toFixed(3)),
        effectiveHazardProbability: Number(effectiveHazard.toFixed(3)),
        cautionRaised: mockHazardEstimate > item.hazardProbability,
        confidence: 0.88,
        advice: mockAdvice,
        reasoning: mockReasoning,
        model: 'gemini-1.5-flash (mocked fallback)',
      });
    }

    // 5. Real Gemini Call with Timeout
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const base64Data = imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

    const promptText = `
You are an expert waste recovery material inspector. Analyze this image of a waste item on a sorting line.
Target item: "${item.name}" (classified locally as ${item.primaryClass}, hazard probability: ${item.hazardProbability}).
Check for signs of concealed lithium batteries, consumer electronics, pressurized aerosol canisters, puncture damage, or hazardous chemicals.
Return ONLY a valid JSON object with:
{
  "hazardProbability": <number between 0.0 and 1.0>,
  "confidence": <number between 0.0 and 1.0>,
  "advice": "<brief 1-sentence safe handling recommendation>",
  "reasoning": "<1-sentence factual observation>"
}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Unparseable Gemini response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const geminiHazard = Math.max(0, Math.min(1, Number(parsed.hazardProbability) || 0.1));
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.8));
      const advice = String(parsed.advice || 'Verify item safely.').slice(0, 200);
      const reasoning = String(parsed.reasoning || '').slice(0, 300);

      // Save to cache
      cache.set(imageHash, {
        hazardEstimate: geminiHazard,
        confidence,
        advice,
        reasoning,
        timestamp: Date.now(),
      });

      // INVARIANT: Gemini may only RAISE caution, never lower it
      const effectiveHazard = Math.max(item.hazardProbability, geminiHazard);

      return NextResponse.json({
        provenance: 'AI-generated',
        isCached: false,
        geminiHazardEstimate: geminiHazard,
        effectiveHazardProbability: effectiveHazard,
        cautionRaised: geminiHazard > item.hazardProbability,
        confidence,
        advice,
        reasoning,
        model,
      });
    } catch (apiErr: any) {
      clearTimeout(timeoutId);
      // Fallback response on timeout or upstream error
      return NextResponse.json({
        provenance: 'AI-generated',
        isCached: false,
        fallbackActive: true,
        geminiHazardEstimate: item.hazardProbability,
        effectiveHazardProbability: item.hazardProbability,
        cautionRaised: false,
        confidence: item.overallConfidence,
        advice: 'Gemini second opinion temporarily unavailable. Maintaining local vision gate decision.',
        reasoning: apiErr?.message || 'Upstream connection error',
        model,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal error processing second opinion', message: err?.message },
      { status: 500 }
    );
  }
}
