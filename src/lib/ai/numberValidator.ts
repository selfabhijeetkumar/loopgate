/**
 * src/lib/ai/numberValidator.ts
 * Deterministic number validator for GenAI outputs.
 * Extracts every number from the generated text and verifies that each one exists
 * in the structured input JSON (either directly, rounded, or as a percentage).
 * If any number was hallucinated / invented, rejects the text.
 */

import type { EngineExplanationInput } from './explainTemplates';

/**
 * Collects all allowed numbers from the structured input data.
 */
export function extractAllowedNumbers(input: EngineExplanationInput): Set<number> {
  const allowed = new Set<number>();

  function addNumberVariations(n: number) {
    if (isNaN(n)) return;
    allowed.add(n);
    // Integer truncation and roundings
    allowed.add(Math.round(n));
    allowed.add(Math.floor(n));
    allowed.add(Math.ceil(n));

    // Common fixed-decimal representations
    allowed.add(parseFloat(n.toFixed(1)));
    allowed.add(parseFloat(n.toFixed(2)));
    allowed.add(parseFloat(n.toFixed(3)));

    // Percentage representations (e.g. 0.942 -> 94.2, 94)
    if (n >= 0 && n <= 1) {
      const pct = n * 100;
      allowed.add(pct);
      allowed.add(Math.round(pct));
      allowed.add(parseFloat(pct.toFixed(1)));
      allowed.add(parseFloat(pct.toFixed(2)));
    }
  }

  // Item values
  addNumberVariations(input.item.hazardProbability);
  addNumberVariations(input.item.confidence);
  if (input.item.disagreement !== undefined) {
    addNumberVariations(input.item.disagreement);
  }

  // Decision values
  addNumberVariations(input.decision.gateScore);
  addNumberVariations(input.decision.threshold);

  // Parse any numbers embedded in item id (e.g. ITEM-08 -> 8, 08)
  const idNums = input.item.id.match(/\d+/g);
  if (idNums) {
    idNums.forEach((str) => {
      allowed.add(parseInt(str, 10));
    });
  }

  // Context values if present
  if (input.context) {
    if (input.context.batchItemCount !== undefined) addNumberVariations(input.context.batchItemCount);
    if (input.context.totalDiverted !== undefined) addNumberVariations(input.context.totalDiverted);
    if (input.context.diversionRate !== undefined) addNumberVariations(input.context.diversionRate);
  }

  return allowed;
}

/**
 * Extracts all numbers from text (integers, decimals, and negative numbers).
 */
export function extractNumbersFromText(text: string): number[] {
  // Match numbers. If preceded by a hyphen that is preceded by a letter/digit (e.g. ITEM-01),
  // it is an identifier suffix, so extract the positive number (1).
  // Only hyphens preceded by whitespace, opening brackets, or start of line are negative signs.
  const regex = /(?:(?<=[\s(\[{]|^)-)?\d+(?:\.\d+)?/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m.trim())).filter((n) => !isNaN(n));
}

export interface ValidationResult {
  valid: boolean;
  rejectedNumbers: number[];
  rejectionReasons: string[];
  text: string;
}

export const FORBIDDEN_WORDS_REGEX = /\b(prevents?|fire\s+risks?|guarantees?)\b/i;
export const SNAKE_CASE_REGEX = /\b[a-z0-9]+_[a-z0-9_]+\b/i;
export const CAMEL_CASE_REGEX = /\b[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*\b/;

/**
 * Checks for forbidden words: prevent, prevents, fire risk, fire risks, guarantee, guarantees.
 */
export function checkForbiddenWords(text: string): string[] {
  const matches = text.match(new RegExp(FORBIDDEN_WORDS_REGEX, 'gi'));
  return matches ? Array.from(new Set(matches.map((m) => m.toLowerCase()))) : [];
}

/**
 * Checks for raw programming identifiers: snake_case and camelCase words.
 */
export function checkIdentifiers(text: string): { snakeCase: string[]; camelCase: string[] } {
  const words = text.match(/\b[A-Za-z0-9_]+\b/g) || [];
  const snakeCase: string[] = [];
  const camelCase: string[] = [];

  for (const w of words) {
    if (w.includes('_') && SNAKE_CASE_REGEX.test(w)) {
      snakeCase.push(w);
    } else if (CAMEL_CASE_REGEX.test(w)) {
      camelCase.push(w);
    }
  }

  return {
    snakeCase: Array.from(new Set(snakeCase)),
    camelCase: Array.from(new Set(camelCase)),
  };
}

/**
 * Verifies that the explanation does NOT compare gateScore / gate score with the safety floor.
 * The safety floor applies to hazard probability, while the gate score is compared with the inspection threshold.
 */
export function checkGateScoreVsSafetyFloor(text: string): boolean {
  // Split into sentences / clauses
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    if (/gate[\s_]*score/i.test(s) && /safety[\s_]*floor/i.test(s)) {
      return true; // Invalid policy comparison detected
    }
  }
  return false;
}

/**
 * Validates that all numbers originate from engine input AND that no forbidden vocabulary,
 * raw identifiers, or policy misrepresentations are present.
 */
export function validateGeneratedExplanation(
  generatedText: string,
  input: EngineExplanationInput
): ValidationResult {
  const allowed = extractAllowedNumbers(input);
  const foundNumbers = extractNumbersFromText(generatedText);
  const rejectedNumbers: number[] = [];
  const rejectionReasons: string[] = [];

  // 1. Number Validation
  for (const num of foundNumbers) {
    if (allowed.has(num)) continue;

    let matched = false;
    for (const validNum of allowed) {
      if (Math.abs(validNum - num) < 0.05) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      rejectedNumbers.push(num);
    }
  }

  if (rejectedNumbers.length > 0) {
    rejectionReasons.push(`Hallucinated numbers detected: ${rejectedNumbers.join(', ')}`);
  }

  // 2. Forbidden Words Validation
  const forbidden = checkForbiddenWords(generatedText);
  if (forbidden.length > 0) {
    rejectionReasons.push(`Forbidden word(s) detected: ${forbidden.join(', ')}`);
  }

  // 3. Identifier Leak Validation
  const idents = checkIdentifiers(generatedText);
  if (idents.snakeCase.length > 0) {
    rejectionReasons.push(`Snake_case identifier(s) detected: ${idents.snakeCase.join(', ')}`);
  }
  if (idents.camelCase.length > 0) {
    rejectionReasons.push(`CamelCase identifier(s) detected: ${idents.camelCase.join(', ')}`);
  }

  // 4. Policy Comparison Validation
  if (checkGateScoreVsSafetyFloor(generatedText)) {
    rejectionReasons.push('Gate score incorrectly compared with safety floor in the same sentence');
  }

  return {
    valid: rejectedNumbers.length === 0 && rejectionReasons.length === 0,
    rejectedNumbers,
    rejectionReasons,
    text: generatedText,
  };
}
