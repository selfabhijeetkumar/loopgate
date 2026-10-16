/**
 * src/cv/toItems.ts
 * Deterministic mapping from raw CV detections and zero-shot CLIP classifications
 * to pure domain Items conforming to Loopgate engine contracts.
 */

import type { Item, Detection, MaterialClass, RouteId, Provenance } from '@/domain/types';
import type { NormalizedDetection } from './types';
import { evaluateGate, DEFAULT_GATE_POLICY, type GatePolicy, SAFETY_FLOOR } from '@/engine/gate';

/**
 * Canonical expected material class per detector label.
 * Used for deterministic cross-model disagreement calculation.
 */
export const DETECTOR_LABEL_CLASS_MAP: Record<string, MaterialClass> = {
  bottle: 'recyclable',
  can: 'recyclable',
  'cardboard box': 'recyclable',
  'jacket or cloth': 'reusable',
  mouse: 'reusable',
  'food scrap': 'biodegradable',
  'power bank': 'hazardous',
  phone: 'hazardous',
  'earbuds case': 'hazardous',
  'vape pen': 'hazardous',
  'aerosol can': 'hazardous',
  battery: 'hazardous',
  'remote control': 'hazardous',
  charger: 'hazardous',
  'electronic device': 'hazardous',
};

export interface MapDetectionOptions {
  provenance?: Provenance;
  geminiHazardEstimate?: number;
  policy?: GatePolicy;
  manualClass?: MaterialClass;
}

/**
 * Calculates deterministic disagreement score between detector label and CLIP class.
 * Returns value in range [0.0, 1.0].
 */
export function calculateModelDisagreement(
  detectorLabel: string,
  detectorScore: number,
  clipPrimaryClass: MaterialClass,
  clipConfidence: number,
  geminiHazardProbability?: number,
  clipHazardProbability?: number
): number {
  const normalizedLabel = detectorLabel.toLowerCase().trim();
  const expectedClass = DETECTOR_LABEL_CLASS_MAP[normalizedLabel];

  let baseDisagreement = 0.05;

  if (expectedClass && expectedClass !== clipPrimaryClass) {
    // Cross-modal conflict between detector semantics and CLIP visual crop
    const scoreDivergence = Math.abs(detectorScore - clipConfidence);
    baseDisagreement = Math.min(0.85, 0.35 + scoreDivergence * 0.5);
  } else {
    // Semantic agreement: disagreement reflects confidence divergence only
    baseDisagreement = Math.min(0.25, Math.abs(detectorScore - clipConfidence) * 0.3);
  }

  // Gemini second opinion: may only RAISE caution (increase disagreement / uncertainty)
  if (
    geminiHazardProbability !== undefined &&
    clipHazardProbability !== undefined &&
    geminiHazardProbability > clipHazardProbability + 0.15
  ) {
    const geminiDelta = geminiHazardProbability - clipHazardProbability;
    baseDisagreement = Math.min(0.95, baseDisagreement + geminiDelta * 0.4);
  }

  return Number(baseDisagreement.toFixed(4));
}

/**
 * Maps a single normalized CV detection into a pure domain Item.
 */
export function mapDetectionToItem(
  detection: NormalizedDetection,
  index: number,
  options: MapDetectionOptions = {}
): Item {
  const provenance: Provenance = options.provenance || detection.provenance || 'Model-inferred';
  const normalizedLabel = detection.label.toLowerCase().trim();
  const expectedClass = DETECTOR_LABEL_CLASS_MAP[normalizedLabel];
  const isHuman = provenance === 'Human-verified';

  let primaryClass: MaterialClass = 'recyclable';
  let overallConfidence = 0.85;
  let hazardProbability = 0.02;
  let modelDisagreement = 0.0;
  let detectionsList: Detection[] = [];

  const itemId = detection.id || `photo-item-${String(index + 1).padStart(2, '0')}`;
  const itemName = detection.label
    ? detection.label.charAt(0).toUpperCase() + detection.label.slice(1)
    : `Detected Item ${index + 1}`;

  // HONESTY: If this is a human box and CLIP did not run on the crop,
  // class and hazard are derived deterministically from the human choice.
  if (isHuman && !detection.clipProbabilities) {
    primaryClass = options.manualClass || expectedClass || 'recyclable';
    overallConfidence = 1.0;
    hazardProbability = primaryClass === 'hazardous' ? 0.85 : 0.02;
    modelDisagreement = 0.0;

    detectionsList = [
      {
        id: `${itemId}-det-human`,
        box: detection.box,
        label: detection.label || 'Human Box',
        materialClass: primaryClass,
        hazardProbability,
        confidence: 1.0,
        source: 'Human Operator',
        provenance: 'Human-verified',
      },
    ];
  } else {
    const probs = detection.clipProbabilities || {
      recyclable: 0.25,
      reusable: 0.25,
      biodegradable: 0.25,
      hazardous: 0.25,
      batteryRisk: 0.0,
    };

    // 1. Identify primary class (highest probability among standard 4 classes)
    const candidateClasses: MaterialClass[] = ['recyclable', 'reusable', 'biodegradable', 'hazardous'];
    let topProb = -1;

    for (const cls of candidateClasses) {
      const p = probs[cls] ?? 0;
      if (p > topProb) {
        topProb = p;
        primaryClass = cls;
      }
    }

    overallConfidence = Number(Math.max(0, Math.min(1, topProb)).toFixed(4));

    // 2. Summed hazard group: hazardous class prob + weighted battery risk
    const rawHazard = (probs.hazardous || 0) + (probs.batteryRisk ? probs.batteryRisk * 0.45 : 0);
    hazardProbability = Number(Math.max(0, Math.min(1, rawHazard)).toFixed(4));

    // If detector explicitly recognized an intrinsically hazardous entity (e.g. power bank, battery, vape pen, phone),
    // prevent a confused crop classifier from allowing it to bypass the safety floor.
    if (expectedClass === 'hazardous' && hazardProbability < SAFETY_FLOOR) {
      hazardProbability = SAFETY_FLOOR;
    }

    // 3. Gemini "Raise Only" Rule: Gemini may increase hazardProbability, never lower it
    if (options.geminiHazardEstimate !== undefined) {
      if (options.geminiHazardEstimate > hazardProbability) {
        hazardProbability = Number(Math.min(1.0, options.geminiHazardEstimate).toFixed(4));
      }
    }

    // 4. Model Disagreement
    modelDisagreement = calculateModelDisagreement(
      detection.label,
      detection.score,
      primaryClass,
      overallConfidence,
      options.geminiHazardEstimate,
      hazardProbability
    );

    detectionsList = [
      {
        id: `${itemId}-det-detr`,
        box: detection.box,
        label: detection.label,
        materialClass: expectedClass || primaryClass,
        hazardProbability,
        confidence: Number(detection.score.toFixed(4)),
        source: 'detr-resnet-50',
        provenance,
      },
      {
        id: `${itemId}-det-clip`,
        box: detection.box,
        label: `${primaryClass} (${(overallConfidence * 100).toFixed(0)}%)`,
        materialClass: primaryClass,
        hazardProbability,
        confidence: overallConfidence,
        source: 'clip-vit-base-patch32',
        provenance,
      },
    ];
  }

  // 6. Pre-calculate gate score and route with pure engine gate
  const policy = options.policy || DEFAULT_GATE_POLICY;
  const decision = evaluateGate(
    {
      hazardProbability,
      confidence: overallConfidence,
      modelDisagreement,
      predictedClass: primaryClass,
    },
    policy
  );

  const initialItem: Item = {
    id: itemId,
    name: itemName,
    detections: detectionsList,
    primaryClass,
    hazardProbability,
    overallConfidence,
    gateScore: Number(decision.gateScore.toFixed(4)),
    modelDisagreement,
    status: 'pending',
    assignedRoute: decision.route,
    provenance,
    createdAt: new Date().toISOString(),
    notes: detection.cropDataUrl || undefined,
  };

  return initialItem;
}

/**
 * Maps an array of normalized CV detections into pure domain Items.
 */
export function mapDetectionsToItems(
  detections: NormalizedDetection[],
  options: MapDetectionOptions = {}
): Item[] {
  return detections.map((det, idx) => mapDetectionToItem(det, idx, options));
}
