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
  text: string;
}

/**
 * Validates that all numbers in the generated explanation originate from the engine input.
 */
export function validateGeneratedExplanation(
  generatedText: string,
  input: EngineExplanationInput
): ValidationResult {
  const allowed = extractAllowedNumbers(input);
  const foundNumbers = extractNumbersFromText(generatedText);
  const rejectedNumbers: number[] = [];

  for (const num of foundNumbers) {
    // Check if directly in set
    if (allowed.has(num)) continue;

    // Check with loose floating point epsilon tolerance (0.05)
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

  return {
    valid: rejectedNumbers.length === 0,
    rejectedNumbers,
    text: generatedText,
  };
}
