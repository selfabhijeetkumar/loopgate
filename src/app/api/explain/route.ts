/**
 * src/app/api/explain/route.ts
 * GenAI Explanation API endpoint with deterministic fallback,
 * multi-provider failover, SHA-256 caching, and strict IP rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import type { EngineExplanationInput } from '@/lib/ai/explainTemplates';
import { generateExplanationWithChain, ProviderResult } from '@/lib/ai/providers';

// In-memory cache by SHA-256 of the input JSON
const explanationCache = new Map<string, ProviderResult & { timestamp: number }>();

// In-memory per-IP rate limiting (5/min, 100/day)
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

const RequestSchema = z.object({
  item: z.object({
    id: z.string().max(64),
    name: z.string().max(256),
    primaryClass: z.enum(['recyclable', 'reusable', 'biodegradable', 'hazardous']),
    hazardProbability: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    disagreement: z.number().min(0).max(1).optional(),
  }),
  decision: z.object({
    route: z.string().max(64),
    gateScore: z.number().min(0).max(10),
    threshold: z.number().min(0).max(10),
    floorTriggered: z.boolean(),
  }),
  context: z
    .object({
      batchItemCount: z.number().optional(),
      totalDiverted: z.number().optional(),
      diversionRate: z.number().optional(),
    })
    .optional(),
  profile: z.enum(['household', 'hostel', 'facility_operator']),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // 1. Rate Limit Check
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Maximum 5 requests per minute allowed on free tier.',
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter || 60) } }
      );
    }

    // 2. Validate Payload
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input payload schema', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const inputData: EngineExplanationInput = parseResult.data;

    // 3. Cache lookup by SHA-256 hash of input data
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(inputData))
      .digest('hex');

    const cached = explanationCache.get(inputHash);
    if (cached && Date.now() - cached.timestamp < 3600_000) {
      // 1 hour cache validity
      return NextResponse.json({
        ...cached,
        cached: true,
      });
    }

    // 4. Multi-provider execution with deterministic template fallback
    const result = await generateExplanationWithChain(inputData);

    // Save in cache
    explanationCache.set(inputHash, {
      ...result,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      explanation: result.explanation,
      source: result.source,
      provider: result.provider,
      cached: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: 'Failed to generate explanation', details: msg },
      { status: 500 }
    );
  }
}
